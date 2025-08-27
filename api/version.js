// Version check endpoint for deployment verification
const WEBHOOK_VERSION = '1.0.1';
const DEPLOY_DATE = '2025-08-27';
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || 'local';

export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    system: 'line-booking-system (Account 1)',
    webhook_version: WEBHOOK_VERSION,
    deploy_date: DEPLOY_DATE,
    build_id: BUILD_ID.substring(0, 7),
    timestamp: new Date().toISOString(),
    cache_prevention: Math.random().toString(36).substring(7)
  });
}