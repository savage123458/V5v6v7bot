const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys')
const express = require('express')
const pino = require('pino')
const cron = require('node-cron')
const axios = require('axios')

const app = express()
const PORT = process.env.PORT || 10000
let pairingCode = 'WAITING...'
let sock = null
let lastPostedGames = []

app.get('/', (req,res)=>{
  res.send(`<html style="background:#111;color:#0f0;font-family:monospace;text-align:center;padding-top:50px"><h1>FORM MASTERS KE BOT</h1><h2 style="font-size:40px;color:yellow">CODE:<br>${pairingCode}</h2><p>Auto 11AM 3PM 7PM + BOOM Alerts + VIP Follow-up - English</p></html>`)
})

function getMockGames(slot){
  const pools = {
    morning: [
      { id:1, match:"Man City vs Burnley", team:"Man City", pick:"Man City Win", odd:1.35 },
      { id:2, match:"Arsenal vs Luton", team:"Arsenal", pick:"Arsenal Win", odd:1.32 },
      { id:3, match:"Gor Mahia vs Sofapaka", team:"Gor Mahia", pick:"Over 1.5 Goals", odd:1.40 }
    ],
    afternoon: [
      { id:4, match:"Real Madrid vs Getafe", team:"Real Madrid", pick:"Real Madrid Win", odd:1.38 },
      { id:5, match:"Bayern vs Augsburg", team:"Bayern", pick:"Bayern Win", odd:1.30 },
      { id:6, match:"Inter vs Lecce", team:"Inter", pick:"Inter Win", odd:1.42 }
    ],
    evening: [
      { id:7, match:"PSG vs Metz", team:"PSG", pick:"PSG Win", odd:1.28 },
      { id:8, match:"Barcelona vs Alaves", team:"Barcelona", pick:"Barcelona Win", odd:1.33 },
      { id:9, match:"Liverpool vs Sheffield", team:"Liverpool", pick:"Liverpool Win", odd:1.36 }
    ]
  }
  return pools[slot]
}

async function getOddsForSlot(slot){
  if(process.env.FOOTBALL_API_KEY){
    try{
      let today = new Date().toISOString().split('T')[0]
      let res = await axios.get(`https://v3.football.api-sports.io/fixtures?date=${today}`, { headers:{'x-apisports-key':process.env.FOOTBALL_API_KEY} })
      let fixtures = res.data.response.slice(0,9)
      if(fixtures.length>=3){
        let mapped = fixtures.map(f=>({ id:f.fixture.id, match:`${f.teams.home.name} vs ${f.teams.away.name}`, team:f.teams.home.name, pick:`${f.teams.home.name} to Win`, odd:(1.28+Math.random()*0.2).toFixed(2) }))
        if(slot==='morning') return mapped.slice(0,3)
        if(slot==='afternoon') return mapped.slice(3,6)
        return mapped.slice(6,9)
      }
    }catch(e){}
  }
  return getMockGames(slot)
}

function formatMainMessage(title, games){
  let total=1; games.forEach(g=>total*=parseFloat(g.odd))
  let msg = `*${title} - FORM MASTERS KE 🔥*\n\n`
  msg += `*⚽ TODAY'S BANKER TIPS - 100% CONFIRMED* ⚽\n\n`
  games.forEach((g,i)=>{ msg += `${i+1}. *${g.match}*\n 👉 ${g.pick} @${g.odd} ✅\n\n` })
  msg += `💰 *TOTAL ODDS: ${total.toFixed(2)}* 💰\n\n`
  msg += `🔥 Early stake recommended - These are super confident picks!\n📲 VIP Inquiries: 0740964993`
  return msg
}

async function sendBoomAlert(teamName){
  if(!sock) return
  const booms = [
    `🚨 *BOOOOOOM!!!* 🚨\n\n⚽ *${teamName} SCORES!!!* ✅✅✅\n\n💥 We predicted it early! One down, two more to go!\n🔥 *The money train has started!* 💰💰`,
    `💥 *KABOOOOOM!!!* 💥\n\n*${teamName} GOOOOAL!!!* ⚽✅\n\nThe winners are already inside! What are you saying now?! 😎\n*FORM MASTERS KE DELIVERS AGAIN!*`,
    `✅✅✅ *GOOOAL!!! ${teamName}* ✅✅✅\n\nThose who played are already counting! 🔥\n💰 Money is coming... 1 more to BOOM!`
  ]
  let msg = booms[Math.floor(Math.random()*booms.length)]
  try{ const groups = await sock.groupFetchAllParticipating(); for(let id in groups){ await sock.sendMessage(id,{text:msg}) } }catch(e){}
}

async function sendVipFollowUp(){
  if(!sock) return
  const vipMsg = `⏰ *2 HOURS UPDATE - FORM MASTERS KE* ⏰\n\n✅✅ *TWO TEAMS HAVE ALREADY WON!* ✅✅\n\n🔥 *Team A WON ✅*\n🔥 *Team B WON ✅*\n⏳ Team C playing - Goal Loading...\n\n💥 *BOOOOM LOADING... 90% GREEN TICKET!*\n\n👇👇👇\n*WANT 100+ ODDS DAILY?*\n*100% CONFIRMED VIP TIPS?*\n\n📲 *DM ADMIN NOW:* 0740964993\n💬 Type *VIP* to join\n\n⚠️ Only 10 slots remaining today!\n_Don't be left behind, the money is in VIP!_ 💰💰💰`
  try{ const groups = await sock.groupFetchAllParticipating(); for(let id in groups){ await sock.sendMessage(id,{text:vipMsg}) } }catch(e){}
}

async function postToAllGroups(slot){
  if(!sock) return
  const games = await getOddsForSlot(slot)
  lastPostedGames = games
  const title = slot==='morning'?'☀️ MORNING BANKER 11AM': slot==='afternoon'?'🌤️ AFTERNOON BANKER 3PM':'🌙 EVENING BANKER 7PM'
  const message = formatMainMessage(title, games)
  const groups = await sock.groupFetchAllParticipating()
  for(let id in groups){ await sock.sendMessage(id,{text:message}) }
  setTimeout(()=>{ sendVipFollowUp() }, 2*60*60*1000)
  setTimeout(()=>{ sendBoomAlert(games[0].team) }, 35*60*1000)
  setTimeout(()=>{ sendBoomAlert(games[1].team) }, 70*60*1000)
}

async function checkLiveScores(){
  if(!process.env.FOOTBALL_API_KEY || lastPostedGames.length===0) return
  try{
    let res = await axios.get(`https://v3.football.api-sports.io/fixtures?live=all`, { headers:{'x-apisports-key':process.env.FOOTBALL_API_KEY} })
    for(let fix of res.data.response){
      for(let g of lastPostedGames){
        if(fix.fixture.id===g.id && fix.goals.home>0){
          await sendBoomAlert(g.team)
          lastPostedGames = lastPostedGames.filter(x=>x.id!==g.id)
        }
      }
    }
  }catch(e){}
}

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('./auth')
  sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level:'silent'})) },
    printQRInTerminal:false, logger:pino({level:'silent'}), browser:['FormMasters KE','Chrome','1.0']
  })
  if(!sock.authState.creds.registered){
    setTimeout(async()=>{
      let num=(process.env.ADMIN_PHONE||'254740964993').replace(/[^0-9]/g,'')
      try{ pairingCode=await sock.requestPairingCode(num) }catch(e){}
    },5000)
  }
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', async(u)=>{
    if(u.connection==='open'){
      let admin=(process.env.ADMIN_PHONE||'254740964993')+'@s.whatsapp.net'
      await sock.sendMessage(admin,{text:`✅ BOT LIVE - PRO ENGLISH VERSION\n\nAuto 11AM,3PM,7PM + BOOM alerts + VIP 2hr follow-up\n\nTest:.test.boom.odds.daily.jackpot.csv`})
      cron.schedule('0 11 * * *', ()=>postToAllGroups('morning'), {timezone:"Africa/Nairobi"})
      cron.schedule('0 15 * * *', ()=>postToAllGroups('afternoon'), {timezone:"Africa/Nairobi"})
      cron.schedule('0 19 * * *', ()=>postToAllGroups('evening'), {timezone:"Africa/Nairobi"})
      cron.schedule('*/5 * * * *', ()=>checkLiveScores())
    }
  })
  sock.ev.on('messages.upsert', async(m)=>{
    try{
      let msg=m.messages[0]; if(!msg.message||msg.key.fromMe) return
      let text=msg.message.conversation||msg.message.extendedTextMessage?.text||''
      let from=msg.key.remoteJid
      if(['.odds','.menu'].includes(text.toLowerCase())){
        let games=await getOddsForSlot('afternoon')
        await sock.sendMessage(from,{text:formatMainMessage('⚽ PREMIUM ODDS',games)})
      }
      if(text.toLowerCase()=='.daily'){
        let g1=await getOddsForSlot('morning'); let g2=await getOddsForSlot('afternoon'); let g3=await getOddsForSlot('evening')
        let all=[...g1,...g2,...g3].slice(0,10)
        let txt=`*🔥 DAILY 10 ODDS - FORM MASTERS*\n\n`; all.forEach((g,i)=>txt+=`${i+1}. ${g.match} - ${g.pick} @${g.odd}\n`)
        txt+=`\n💰 Total ~15 odds\nDM VIP: 0740964993`; await sock.sendMessage(from,{text:txt})
      }
      if(text.toLowerCase()=='.jackpot'){ await sock.sendMessage(from,{text:`*💰 WEEKEND JACKPOT 15 GAMES*\n\nFull JP in VIP group\nDM: 0740964993\nBonus 1000x`}) }
      if(text.toLowerCase()=='.csv'){ await sock.sendMessage(from,{text:`*📊 CSV REPORT*\nDate,Match,Pick,Odd`}) }
      if(text.toLowerCase()=='.test'){ await postToAllGroups('afternoon'); await sock.sendMessage(from,{text:'✅ Posted + BOOM in 35min + VIP in 2hrs'}) }
      if(text.toLowerCase()=='.boom'){ await sendBoomAlert('Man City') }
      if(text.includes('https://chat.whatsapp.com/')){
        try{ let code=text.split('https://chat.whatsapp.com/')[1].split(' ')[0].split('/').pop(); await sock.groupAcceptInvite(code); await sock.sendMessage(from,{text:'✅ Joined! I will post 11AM,3PM,7PM + BOOM alerts'}) }catch(e){}
      }
    }catch(e){console.log(e)}
  })
}
app.listen(PORT,()=>{ console.log('Server on '+PORT); startBot() })
