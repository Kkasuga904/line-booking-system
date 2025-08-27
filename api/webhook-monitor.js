// Webhook Monitoring and Error Prevention
export default async function handler(req, res) {
  const startTime = Date.now();
  console.log('=== Webhook Monitor Start ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  
  // Early response to prevent timeout
  res.status(200).json({ status: 'ok', timestamp: startTime });
  
  // Log request details for debugging
  try {
    const webhookLog = {
      timestamp: new Date().toISOString(),
      method: req.method,
      headers: req.headers,
      body: req.body,
      processingTime: Date.now() - startTime
    };
    
    console.log('Webhook Log:', JSON.stringify(webhookLog, null, 2));
    
    // Check if webhook is healthy
    if (req.body?.events) {
      console.log('Events received:', req.body.events.length);
      
      for (const event of req.body.events) {
        console.log('Event type:', event.type);
        console.log('Event source:', event.source?.type);
        
        // Verify LINE token is configured
        if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
          console.error('ERROR: LINE_CHANNEL_ACCESS_TOKEN not configured');
        }
        
        // Verify LIFF ID is configured
        if (!process.env.LIFF_ID) {
          console.warn('WARNING: LIFF_ID not configured, using default');
        }
      }
    }
    
  } catch (error) {
    console.error('Monitor Error:', error);
  }
}