const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://faenvzzeguvlconvrqgp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjE3NDI5OCwiZXhwIjoyMDcxNzUwMjk4fQ.xKN7DHEV0iQ0XPx6x6BwqE9k1fGjMhh-Sj8OZPJ7vLc';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTable() {
  console.log('Creating capacity_rules table with time range structure...');
  
  try {
    // First check if table exists and drop it
    const { error: dropError } = await supabase
      .from('capacity_rules')
      .delete()
      .neq('id', 0); // This will fail if table doesn't exist, which is fine
    
    console.log('Attempting to clear existing table...');
    
    // Now insert sample data - if table doesn't exist with right structure, this will fail
    const { data, error } = await supabase
      .from('capacity_rules')
      .insert([
        {
          store_id: 'default-store',
          date: '2025-09-07',
          start_time: '18:00:00',
          end_time: '21:00:00',
          max_capacity: 1
        },
        {
          store_id: 'default-store',
          date: '2025-09-08',
          start_time: '18:00:00',
          end_time: '21:00:00',
          max_capacity: 1
        }
      ])
      .select();
    
    if (error) {
      console.error('Error inserting data:', error);
      console.log('\nPlease run the following SQL in Supabase SQL Editor:');
      console.log(`
-- Drop existing table if needed
DROP TABLE IF EXISTS capacity_rules CASCADE;

-- Create capacity_rules table for storing capacity restrictions with time ranges
CREATE TABLE capacity_rules (
  id SERIAL PRIMARY KEY,
  store_id VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_capacity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, date, start_time, end_time)
);

-- Create index for faster queries
CREATE INDEX idx_capacity_rules_store_date 
ON capacity_rules(store_id, date);

-- Enable Row Level Security
ALTER TABLE capacity_rules ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on capacity_rules" ON capacity_rules
  FOR ALL USING (true) WITH CHECK (true);

-- Insert sample data
INSERT INTO capacity_rules (store_id, date, start_time, end_time, max_capacity)
VALUES 
  ('default-store', '2025-09-07', '18:00:00', '21:00:00', 1),
  ('default-store', '2025-09-08', '18:00:00', '21:00:00', 1);
      `);
    } else {
      console.log('Successfully inserted sample data:', data);
    }
    
    // Try to fetch data to verify
    const { data: checkData, error: checkError } = await supabase
      .from('capacity_rules')
      .select('*');
    
    if (checkError) {
      console.error('Error fetching data:', checkError);
    } else {
      console.log('Current capacity rules:', checkData);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTable();