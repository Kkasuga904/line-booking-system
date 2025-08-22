export default function handler(req, res) {
  res.status(200).json({
    status: 'OK',
    method: req.method,
    message: 'Webhook is working',
    timestamp: new Date().toISOString()
  });
}