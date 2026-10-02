const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys')
const express = require('express')
const fs = require('fs')
const pino = require('pino')
const app = express()
const PORT = process.env.PORT || 3000
let pairingCode = 'WAITING...'
let sock = null

app.get('/', (req,res)=>{
  res.send(`<html style="background:#111;color:#0f0;font-family:monospace;text-align:center;padding-top:50px"><h1>FORM MASTERS KE BOT</h1><h2 style="font-size:40px;color:yellow">PAIRING CODE:<br>${pairingCode}</h2><p>Go to WhatsApp > Linked Devices > Link with phone number > Enter code</p><p>Bot by +254740964993</p></html>`)
})

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('./auth')
  sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level:'silent'})) },
    printQRInTerminal: false,
    logger: pino({level:'silent'}),
    browser: ['FormMasters KE','Chrome','1.0']
  })

  if(!sock.authState.creds.registered){
    setTimeout(async()=>{
      let num = (process.env.ADMIN_PHONE||'254740964993').replace(/[^0-9]/g,'')
      try{ pairingCode = await sock.requestPairingCode(num); console.log('CODE:',pairingCode) }catch(e){ console.log(e) }
    },5000)
  }

  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', async(u)=>{
    const { connection } = u
    if(connection==='open'){
      console.log('CONNECTED')
      let admin = (process.env.ADMIN_PHONE||'254740964993')+'@s.whatsapp.net'
      await sock.sendMessage(admin,{text:`✅ *FORM MASTERS KE BOT CONNECTED!*\n\nYour bot is live!\n\nCommands:\n.odds - get odds\n.daily - 10 tips\n.jackpot - weekend JP\n.csv - get CSV report\n\nGroup: Send group link to add`})
    }
  })

  sock.ev.on('messages.upsert', async(m)=>{
    try{
      let msg = m.messages[0]
      if(!msg.message || msg.key.fromMe) return
      let text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
      let from = msg.key.remoteJid
      let isGroup = from.endsWith('@g.us')
      if(text.toLowerCase()=='.menu' || text.toLowerCase()=='.odds'){
        let reply = `*⚽ FORM MASTERS KE - PREMIUM ODDS*\n\n📊 *TODAY'S ODDS:*\n1. Man City vs Arsenal - 1X (1.45)\n2. Gor vs AFC - Over 1.5 (1.32)\n3. Real vs Barca - BTTS Yes (1.55)\n\nTotal: 2.96 odds\n\nType.daily for 10 games\nType.jackpot for JP tips\n\nWhatsApp: 0740964993`
        await sock.sendMessage(from,{text:reply})
      }
      if(text.toLowerCase()=='.daily'){
        await sock.sendMessage(from,{text:`*🔥 DAILY 10 ODDS - FORM MASTERS*\n\n1. Over 1.5 goals - 1.30\n2. Home win - 1.45\n3. BTTS - 1.60\n... full list coming in group\n\nJoin VIP: 0740964993`})
      }
      if(text.toLowerCase().includes('http') && text.includes('whatsapp.com')){
        await sock.sendMessage(from,{text:'Adding to group... Send admin to bot'})
        try{ await sock.groupAcceptInvite(text.split('/').pop()); }catch(e){}
      }
    }catch(e){console.log(e)}
  })
}

app.listen(PORT,()=>{ console.log('Server on '+PORT); startBot() })
