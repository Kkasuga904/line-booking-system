import { createClient } from '@supabase/supabase-js';

// Supabase初期化
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Line-Signature');
  
  // OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET request - health check
  if (req.method === 'GET') {
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    return res.status(200).json({
      status: 'active',
      webhook_url: 'https://line-booking-account2.vercel.app/webhook',
      recent_reservations: data || []
    });
  }
  
  // POST request - handle webhook
  if (req.method === 'POST') {
    try {
      // Log the raw request for debugging
      console.log('Webhook received:', {
        headers: req.headers,
        body: req.body
      });
      
      // Handle verification (empty events)
      if (!req.body || !req.body.events || req.body.events.length === 0) {
        console.log('Verification request received');
        return res.status(200).send('OK');
      }
      
      const events = req.body.events;
      console.log(`Processing ${events.length} events`);
      
      // Process each event
      for (const event of events) {
        // Only process text messages
        if (event.type === 'message' && event.message && event.message.type === 'text') {
          const text = event.message.text;
          const userId = event.source?.userId || 'unknown';
          
          console.log(`Message from ${userId}: ${text}`);
          
          // Check if it's a reservation message
          if (text && text.includes('予約')) {
            // Default values
            let people = 2;
            let date = new Date().toISOString().split('T')[0];
            let time = '19:00';
            
            // Extract number of people
            const peopleMatch = text.match(/(\d+)[人名]/);
            if (peopleMatch) {
              people = parseInt(peopleMatch[1]);
            }
            
            // Extract time
            const timeMatch = text.match(/(\d{1,2})時/);
            if (timeMatch) {
              const hour = timeMatch[1].padStart(2, '0');
              time = `${hour}:00`;
            }
            
            // Extract date
            if (text.includes('明日')) {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              date = tomorrow.toISOString().split('T')[0];
            } else if (text.includes('今日')) {
              date = new Date().toISOString().split('T')[0];
            }
            
            // Save to database
            const { data: reservation, error } = await supabase
              .from('reservations')
              .insert([{
                store_id: process.env.STORE_ID || 'restaurant-001',
                user_id: userId,
                message: text,
                people: people,
                date: date,
                time: time + ':00',
                status: 'pending'
              }])
              .select()
              .single();
            
            if (error) {
              console.error('Database error:', error);
            } else {
              console.log('Reservation saved:', reservation);
            }
          }
        }
      }
      
      // Always return 200 for LINE
      return res.status(200).send('OK');
      
    } catch (error) {
      console.error('Error processing webhook:', error);
      // Return 200 even on error (LINE requirement)
      return res.status(200).send('OK');
    }
  }
  
  // Other methods
  return res.status(405).json({ error: 'Method not allowed' });
}