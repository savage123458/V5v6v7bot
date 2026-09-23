import os, requests, asyncio, telegram
from flask import Flask
from threading import Thread
from datetime import datetime

# === YOUR BOT - READY TO DEPLOY ===
TOKEN = "8786808719:AAFOMD3Rw2RgdBpv_ntZaFGFc0zSKKYMN6Y"
CHAT = "8434950069"
# ===================================

bot = telegram.Bot(token=TOKEN)
app = Flask(__name__)

@app.route("/")
def home(): return "V5 V6 V7 BOT LIVE 8434950069"

def get_stats(eid):
    try:
        r=requests.get(f"https://api.sofascore.com/api/v1/event/{eid}/statistics", headers={"User-Agent":"Mozilla/5.0"}, timeout=10).json()
        da_h=da_a=sot_h=sot_a=cor=poss_h=poss_a=0
        red_h=red_a=False
        for b in r.get('statistics',[]):
            for g in b.get('groups',[]):
                for s in g.get('statisticsItems',[]):
                    n=s.get('name','').lower()
                    if 'dangerous' in n: da_h=s.get('home',0); da_a=s.get('away',0)
                    if 'shot on target' in n: sot_h=s.get('home',0); sot_a=s.get('away',0)
                    if 'corner' in n: cor=s.get('home',0)+s.get('away',0)
                    if 'possession' in n: poss_h=s.get('home',0); poss_a=s.get('away',0)
                    if 'red card' in n:
                        if s.get('home',0)>=1: red_h=True
                        if s.get('away',0)>=1: red_a=True
        return da_h,da_a,sot_h,sot_a,cor,poss_h,poss_a,red_h,red_a
    except: return 0,0,0,0,0,0,0,False,False

async def run_all():
    sent=set()
    # Test message
    try:
        await bot.send_message(chat_id=CHAT, text="✅ BOT STARTED V5 V6 V7\nPhone deploy success!")
    except: pass
    
    while True:
        try:
            today=datetime.now().strftime("%Y-%m-%d")
            try:
                rr=requests.get(f"https://api.sofascore.com/api/v1/sport/football/scheduled-events/{today}", headers={"User-Agent":"Mozilla/5.0"}, timeout=15).json()
                for ev in rr.get('events',[])[:30]:
                    eid=ev.get('id')
                    if f"V5{eid}" in sent: continue
                    h2h=requests.get(f"https://api.sofascore.com/api/v1/event/{eid}/h2h/events", headers={"User-Agent":"Mozilla/5.0"}, timeout=10).json()
                    games=h2h.get('events',[])[:10]
                    draws=sum(1 for g in games if g.get('homeScore',{}).get('current')==g.get('awayScore',{}).get('current'))
                    if draws<=1 and len(games)>=5:
                        h=ev.get('homeTeam',{}).get('name',''); a=ev.get('awayTeam',{}).get('name','')
                        await bot.send_message(chat_id=CHAT, text=f"💰 V5 1&2 ARB\n{h} vs {a}\nH2H {draws} draws in 10 = hardly draw\nBET 12 FAST 1000 KES")
                        sent.add(f"V5{eid}")
            except: pass

            live=requests.get("https://api.sofascore.com/api/v1/sport/football/events/live", headers={"User-Agent":"Mozilla/5.0"}, timeout=15).json()
            for ev in live.get('events',[]):
                m=ev.get('time',{}).get('minute',0) or 0
                eid=ev.get('id')
                h=ev.get('homeTeam',{}).get('name',''); a=ev.get('awayTeam',{}).get('name','')
                hs=ev.get('homeScore',{}).get('current',0); aw=ev.get('awayScore',{}).get('current',0)
                da_h,da_a,sot_h,sot_a,cor,poss_h,poss_a,red_h,red_a=get_stats(eid)

                if m>=60 and f"V6{eid}{m}" not in sent:
                    if red_h and poss_a>=60:
                        await bot.send_message(chat_id=CHAT, text=f"🟥 V6 RED CARD\n{h} RED {m}'\n{a} now dominating poss {poss_a}% DA:{da_a}\n{h} {hs}-{aw} {a}\n👉 BET Away")
                        sent.add(f"V6{eid}{m}")
                    if red_a and poss_h>=60:
                        await bot.send_message(chat_id=CHAT, text=f"🟥 V6 RED CARD\n{a} RED {m}'\n{h} now dominating poss {poss_h}% DA:{da_h}\n{h} {hs}-{aw} {a}\n👉 BET Home")
                        sent.add(f"V6{eid}{m}")

                if 70<=m<=92 and f"V7{eid}{m}" not in sent:
                    if (da_h+da_a)>=80 and cor>=6:
                        await bot.send_message(chat_id=CHAT, text=f"🎯 V7 95% CORNER BOTH PRESSURE\n{h} vs {a} {m}' {hs}-{aw}\nHome DA:{da_h} Away DA:{da_a} Total:{da_h+da_a} COR:{cor}\n👉 BET Next Corner 2.5+ $5")
                        sent.add(f"V7{eid}{m}")
        except Exception as e: print(e)
        await asyncio.sleep(40)

def start():
    asyncio.run(run_all())

if __name__=="__main__":
    Thread(target=start, daemon=True).start()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT",10000)))
