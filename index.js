const express = require('express');
const app = express();
app.use(express.json());

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const SYSTEM_PROMPT = '你是大雄的機器人助手，請用繁體中文回覆，語氣親切自然。';

async function askClaude(userMessage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await res.json();
  console.log('Claude API 回應:', JSON.stringify(data));
  if (!data.content) throw new Error(JSON.stringify(data));
  return data.content[0].text;
}

async function replyToLine(replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });
}

const users = {};

app.post('/webhook', (req, res) => {
  const events = req.body.events || [];
  events.forEach(event => {
    if (event.source && event.source.userId) {
      const userId = event.source.userId;
      if (!users[userId]) {
        users[userId] = {
          userId,
          firstSeen: new Date().toISOString(),
          eventCount: 0
        };
      }
      users[userId].eventCount++;
      users[userId].lastSeen = new Date().toISOString();
      users[userId].lastEventType = event.type;
      console.log(`收到事件：${event.type}，User ID：${userId}`);

      // 如果是文字訊息，用 Claude 回覆
      if (event.type === 'message' && event.message.type === 'text') {
        const userText = event.message.text;
        askClaude(userText)
          .then(reply => replyToLine(event.replyToken, reply))
          .catch(err => console.error('Claude 回覆失敗:', err));
      }
    }
  });
  res.status(200).json({ status: 'ok' });
});

app.get('/', (req, res) => {
  const userList = Object.values(users);
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>LINE Bot User IDs</title>
  <style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px}
  h1{color:#06C755}table{width:100%;border-collapse:collapse;margin-top:20px}
  th{background:#06C755;color:white;padding:10px;text-align:left}
  td{padding:10px;border-bottom:1px solid #eee}tr:hover{background:#f0faf4}
  .empty{color:#999;margin-top:20px}
  .copy-btn{background:#06C755;color:white;border:none;padding:5px 10px;cursor:pointer;border-radius:4px}
  .copy-btn:hover{background:#019A41}</style></head><body>
  <h1>🤖 LINE Bot - User ID 列表</h1>
  <p>當有人傳訊息給你的 Bot，他們的 User ID 就會出現在這裡。</p>`;
  if (userList.length === 0) {
    html += `<p class="empty">⏳ 還沒有人傳訊息過，等朋友傳訊息給 Bot 後重新整理此頁面。</p>`;
  } else {
    html += `<table><tr><th>User ID</th><th>第一次互動</th><th>最後互動</th><th>互動次數</th><th>複製</th></tr>`;
    userList.forEach(u => {
      html += `<tr><td><code>${u.userId}</code></td>
      <td>${u.firstSeen.replace('T',' ').substring(0,19)}</td>
      <td>${u.lastSeen.replace('T',' ').substring(0,19)}</td>
      <td>${u.eventCount}</td>
      <td><button class="copy-btn" onclick="navigator.clipboard.writeText('${u.userId}')">複製</button></td></tr>`;
    });
    html += `</table>`;
  }
  html += `<p style="margin-top:30px;color:#999;font-size:12px;">⚠️ 伺服器重啟後資料會清空，請複製需要的 User ID 保存好。</p></body></html>`;
  res.send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`伺服器啟動，Port: ${PORT}`));
