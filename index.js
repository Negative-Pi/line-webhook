const express = require('express');
const app = express();
app.use(express.json());

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
