module.exports = async function handler(req, res) {
  // LINEのWebhook検証リクエストに対して常に200を返す
  return res.status(200).json({ success: true });
};