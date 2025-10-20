const fetch = require('node-fetch');

async function testNotifications() {
  try {
    console.log('🧪 Testing notification endpoints...');

    // Test health endpoint
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:3001/api/health');
    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);

    // Test notification test endpoint
    console.log('\n2. Testing notification test endpoint...');
    const testResponse = await fetch('http://localhost:3001/api/notifications/test');
    const testData = await testResponse.json();
    console.log('Notification test:', testData);

    // Test creating a notification
    console.log('\n3. Testing notification creation...');
    const createResponse = await fetch('http://localhost:3001/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientId: 'test-user-123',
        type: 'test_notification',
        title: 'Test Notification',
        message: 'This is a test notification',
        priority: 'normal'
      })
    });
    const createData = await createResponse.json();
    console.log('Create notification:', createData);

    // Test getting notifications
    console.log('\n4. Testing notification retrieval...');
    const getResponse = await fetch('http://localhost:3001/api/notifications/test-user-123');
    const getData = await getResponse.json();
    console.log('Get notifications:', getData);

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Export the function instead of calling it automatically
module.exports = { testNotifications };

// Only run if this file is executed directly (not imported)
// if (require.main === module) {
//   testNotifications();
// }
