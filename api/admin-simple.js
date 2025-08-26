export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET: 予約一覧取得（ダミーデータ）
  if (req.method === 'GET') {
    const dummyData = [
      {
        id: 1,
        store_id: 'restaurant-001',
        user_id: 'test_user',
        message: 'テストデータ',
        people: 2,
        date: '2025-08-26',
        time: '18:00:00',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
    return res.status(200).json(dummyData);
  }
  
  return res.status(405).send('Method Not Allowed');
}