export default async function handler(req, res) {
  // Handle GET request (for LINE Verify)
  if (req.method === 'GET') {
    return res.status(200).send('OK');
  }
  
  // Handle POST request (LINE Webhook - simplified)
  if (req.method === 'POST') {
    console.log('Webhook received:', req.body);
    
    // Simply return success for now
    return res.status(200).json({ success: true });
  }
  
  return res.status(405).send('Method Not Allowed');
}