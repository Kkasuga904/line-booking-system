const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://faenvzzeguvlconvrqgp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjE3NDI5OCwiZXhwIjoyMDcxNzUwMjk4fQ.xKN7DHEV0iQ0XPx6x6BwqE9k1fGjMhh-Sj8OZPJ7vLc';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQL() {
  const sql = `
    -- Drop existing table if needed
    DROP TABLE IF EXISTS capacity_rules CASCADE;

    -- Create capacity_rules table for storing capacity restrictions with time ranges
    CREATE TABLE IF NOT EXISTS capacity_rules (
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
    CREATE INDEX IF NOT EXISTS idx_capacity_rules_store_date 
    ON capacity_rules(store_id, date);

    -- Enable Row Level Security
    ALTER TABLE capacity_rules ENABLE ROW LEVEL SECURITY;

    -- Create policy to allow all operations
    CREATE POLICY "Allow all operations on capacity_rules" ON capacity_rules
      FOR ALL USING (true) WITH CHECK (true);

    -- Insert sample data for testing (18:00-21:00 with max_capacity=1)
    INSERT INTO capacity_rules (store_id, date, start_time, end_time, max_capacity)
    VALUES 
      ('default-store', '2025-09-07', '18:00:00', '21:00:00', 1),
      ('default-store', '2025-09-08', '18:00:00', '21:00:00', 1)
    ON CONFLICT (store_id, date, start_time, end_time) DO UPDATE
    SET max_capacity = EXCLUDED.max_capacity,
        updated_at = CURRENT_TIMESTAMP;
  `;

  try {
    // Execute SQL using Supabase admin client
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      console.error('Error executing SQL:', error);
      
      // Try executing statements one by one
      const statements = sql.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          console.log('Executing:', stmt.substring(0, 50) + '...');
          try {
            await supabase.rpc('exec_sql', { query: stmt });
            console.log('Success');
          } catch (e) {
            console.error('Failed:', e.message);
          }
        }
      }
    } else {
      console.log('SQL executed successfully');
    }
    
    // Check if table was created
    const { data: tables } = await supabase
      .from('capacity_rules')
      .select('*')
      .limit(5);
    
    console.log('Table data:', tables);
  } catch (error) {
    console.error('Error:', error);
  }
}

runSQL();