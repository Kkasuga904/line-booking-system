export default function handler(req, res) {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LINE予約管理画面</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: sans-serif; background: #f5f5f5; padding: 20px; }
        .header { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .container { background: white; border-radius: 10px; padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #e9ecef; }
        td { padding: 12px; border-bottom: 1px solid #e9ecef; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .status.pending { background: #fff3cd; color: #856404; }
        .status.confirmed { background: #d4edda; color: #155724; }
        .loading { text-align: center; padding: 40px; }
        .refresh-btn { background: #2563eb; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📱 LINE予約管理システム</h1>
        <button class="refresh-btn" onclick="loadReservations()">🔄 更新</button>
    </div>
    
    <div class="container">
        <div id="loading" class="loading">読み込み中...</div>
        <table id="reservationsTable" style="display: none;">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>日付</th>
                    <th>時間</th>
                    <th>人数</th>
                    <th>メッセージ</th>
                    <th>ステータス</th>
                </tr>
            </thead>
            <tbody id="reservationsBody"></tbody>
        </table>
    </div>
    
    <script>
        async function loadReservations() {
            const loading = document.getElementById('loading');
            const table = document.getElementById('reservationsTable');
            loading.style.display = 'block';
            table.style.display = 'none';
            
            try {
                const response = await fetch('/api/admin');
                const reservations = await response.json();
                
                const tbody = document.getElementById('reservationsBody');
                tbody.innerHTML = '';
                
                if (reservations.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">予約がありません</td></tr>';
                } else {
                    reservations.forEach(res => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = \`
                            <td>#\${res.id}</td>
                            <td>\${res.date}</td>
                            <td>\${res.time ? res.time.slice(0, 5) : '-'}</td>
                            <td>\${res.people}名</td>
                            <td>\${res.message || '-'}</td>
                            <td><span class="status \${res.status}">\${res.status}</span></td>
                        \`;
                        tbody.appendChild(tr);
                    });
                }
                
                loading.style.display = 'none';
                table.style.display = 'table';
            } catch (err) {
                loading.innerHTML = 'エラー: ' + err.message;
            }
        }
        
        // 初回読み込み
        loadReservations();
        
        // 30秒ごとに自動更新
        setInterval(loadReservations, 30000);
    </script>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}