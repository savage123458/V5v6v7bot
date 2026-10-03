const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys')
const express = require('express')
const pino = require('pino')
const cron = require('node-cron')
const axios = require('axios')

const app = express()
const PORT = process.env.PORT || 10000
let pairingCode = 'STARTING... Please refresh page in 10 sec'
let sock = null
let lastPostedGames = []

app.get('/', (req,res)=>{
  res.send(`<html style="background:#111;color:#0f0;font-family:monospace;text-align:center;padding-top:30px"><h1>FORM MASTERS KE BOT</h1><h2 style="font-size:35px;color:yellow;border:3px solid yellow;padding:20px">CODE:<br>${pairingCode}</h2><p>Code refreshes every 30 sec - Enter FAST in WhatsApp</p><p>Steps: WhatsApp > Linked devices > Link device > Link with phone number</p><p>Auto 11AM 3PM 7PM + BOOM Alerts + VIP Follow-up</p><script>setTimeout(()=>location.reload(),25000)</script></html>`)
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
  let msg = `*${title} - FORM MASTERS KE 🔥*\n\n*⚽ TODAY'S BANKER TIPS - 100% CONFIRMED* ⚽\n\n`
  games.forEach((g,i)=>{ msg += `${i+1}. *${g.match}*\n 👉 ${g.pick} @${g.odd} ✅\n\n` })
  msg += `💰 *TOTAL ODDS: ${total.toFixed(2)}* 💰\n\n🔥 Early stake recommended!\n📲 VIP: 0740964993`
  return msg
}

async function sendBoomAlert(teamName){
  if(!sock) return
  const booms = [
    `🚨 *BOOOOOOM!!!* 🚨\n\n⚽ *${teamName} SCORES!!!* ✅✅✅\n\n💥 We predicted it early!`,
    `💥 *KABOOOOOM!!!* 💥\n\n*${teamName} GOOOOAL!!!* ⚽✅\n\nFORM MASTERS KE DELIVERS!`
  ]
  let msg = booms[Math.floor(Math.random()*booms.length)]
  try{ const groups = await sock.groupFetchAllParticipating()
    for(let id in groups){ await sock.sendMessage(id,{text:msg}) }
  }catch(e){}
}

async function postToAllGroups(slot){
  if(!sock) return
  const games = await getOddsForSlot(slot)
  lastPostedGames = games
  const title = slot==='morning'?'☀️ MORNING BANKER 11AM': slot==='afternoon'?'🌤️ AFTERNOON BANKER 3PM':'🌙 EVENING BANKER 7PM'
  const message = formatMainMessage(title, games)
  try{
    const groups = await sock.groupFetchAllParticipating()
    for(let id in groups){ await sock.sendMessage(id,{text:message}) }
  }catch(e){}
}

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('./auth')
  sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level:'silent'})) },
    printQRInTerminal:false, logger:pino({level:'silent'}), browser:['FormMasters KE','Chrome','1.0']
  })

  // FIXED PAIRING LOGIC - REFRESH EVERY 30 SEC
  if(!sock.authState.creds.registered){
    const generateCode = async () => {
      let num=(process.env.ADMIN_PHONE||'254740964993').replace(/[^0-9]/g,'')
      try{
        pairingCode = await sock.requestPairingCode(num)
        console.log('NEW PAIRING CODE:', pairingCode, 'for', num)
      }catch(e){ console.log('Pairing error:', e.message); pairingCode='Error - retrying...' }
    }
    setTimeout(generateCode, 8000)
    setInterval(generateCode, 30000) // new code every 30 sec
  } else {
    pairingCode = 'BOT ALREADY LINKED ✅'
  }

  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', async(u)=>{
    console.log('Connection update:', u)
    if(u.connection==='open'){
      pairingCode = 'BOT LINKED SUCCESS ✅ - You can close this'
      console.log('BOT LINKED SUCCESS')
      try{
        let admin=(process.env.ADMIN_PHONE||'254740964993').replace(/[^0-9]/g,'')+'@s.whatsapp.net'
        await sock.sendMessage(admin,{text:`✅ BOT LIVE\n\n11AM,3PM,7PM auto working`})
      }catch(e){}
      cron.schedule('0 11 * * *', ()=>postToAllGroups('morning'), {timezone:"Africa/Nairobi"})
      cron.schedule('0 15 * * *', ()=>postToAllGroups('afternoon'), {timezone:"Africa/Nairobi"})
      cron.schedule('0 19 * * *', ()=>postToAllGroups('evening'), {timezone:"Africa/Nairobi"})
    }
  })

  sock.ev.on('messages.upsert', async(m)=>{
    try{
      let msg=m.messages[0]; if(!msg.message||msg.key.fromMe) return
      let text=msg.message.conversation||msg.message.extendedTextMessage?.text||''
      let from=msg.key.remoteJid
      if(text.toLowerCase()=='.test'){ await postToAllGroups('afternoon'); await sock.sendMessage(from,{text:'✅ Posted'}) }
      if(text.toLowerCase()=='.boom'){ await sendBoomAlert('Man City') }
      if(text.includes('https://chat.whatsapp.com/')){
        try{ let code=text.split('https://chat.whatsapp.com/')[1].split(' ')[0].split('/').pop(); await sock.groupAcceptInvite(code); await sock.sendMessage(from,{text:'✅ Joined!'}) }catch(e){}
      }
    }catch(e){}
  })
}

app.listen(PORT,()=>{ console.log('Server on '+PORT); startBot() })
