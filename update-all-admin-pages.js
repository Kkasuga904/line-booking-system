// 全管理画面を admin-full-featured.html にリダイレクトするスクリプト
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const adminFiles = [
    'admin.html',
    'admin-calendar.html',
    'admin-calendar-enhanced.html',
    'admin-calendar-fixed.html',
    'admin-calendar-main.html',
    'admin-calendar-v2.html',
    'admin-complete.html',
    'admin-integrated.html',
    'admin-latest.html',
    'admin-mobile.html',
    'admin-mobile-latest.html',
    'admin-mobile-responsive.html',
    'admin-mobile-v2.html',
    'admin-responsive.html',
    'admin-secure.html'
];

const redirectHTML = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>リダイレクト中...</title>
    <meta http-equiv="refresh" content="0; url=/admin-full-featured.html">
    <script>
        window.location.href = '/admin-full-featured.html';
    </script>
</head>
<body>
    <p>管理画面にリダイレクトしています...</p>
    <p>自動的に移動しない場合は <a href="/admin-full-featured.html">こちら</a> をクリックしてください。</p>
</body>
</html>`;

// 各adminファイルをリダイレクトHTMLで上書き
adminFiles.forEach(file => {
    const filePath = path.join(publicDir, file);
    if (fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, redirectHTML, 'utf8');
        console.log(`Updated: ${file}`);
    } else {
        console.log(`Skipped (not found): ${file}`);
    }
});

console.log('\n✅ 全ての管理画面ファイルを統一しました。');
console.log('すべて /admin-full-featured.html にリダイレクトされます。');