const fetch = require('node-fetch');

async function testSaveCapacity() {
  const url = 'https://line-booking-api-116429620992.asia-northeast1.run.app/api/admin';
  
  const data = {
    action: 'saveCapacity',
    store_id: 'default-store',
    settings: {
      rules: [
        {
          date: '2025-09-07',
          startTime: '18:00',
          endTime: '21:00',
          maxGroups: 1
        },
        {
          date: '2025-09-08',
          startTime: '19:00',
          endTime: '21:30',
          maxGroups: 2
        }
      ]
    }
  };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    console.log('Response:', result);
    
    // Now fetch the saved rules
    const getResponse = await fetch(url + '?action=capacity&store_id=default-store');
    const getResult = await getResponse.json();
    console.log('Saved rules:', JSON.stringify(getResult, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSaveCapacity();