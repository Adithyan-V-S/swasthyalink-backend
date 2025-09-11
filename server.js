const express = require('express');
const cors = require('cors');
const { SessionsClient } = require('@google-cloud/dialogflow');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Dialogflow configuration
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'YOUR_PROJECT_ID';
const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json';
const languageCode = 'en';

// Initialize Dialogflow client
let sessionClient;
try {
  sessionClient = new SessionsClient({
    keyFilename: path.join(__dirname, keyFilename),
    projectId: projectId,
  });
  console.log('✅ Dialogflow client initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Dialogflow client:', error.message);
  console.log('🔧 Using simulated responses instead');
  sessionClient = null;
}

// Helper function to detect intent
async function detectIntent(message, sessionId) {
  if (!sessionClient) {
    // Return simulated response if Dialogflow client is not available
    return simulateDialogflowResponse(message);
  }

  try {
    const sessionPath = sessionClient.projectLocationAgentSessionPath(
      projectId,
      'global',
      sessionId
    );

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: message,
          languageCode: languageCode,
        },
      },
    };

    const [response] = await sessionClient.detectIntent(request);
    const result = response.queryResult;

    return {
      success: true,
      response: result.fulfillmentText,
      intent: result.intent?.displayName || 'default',
      sessionId: sessionId
    };
  } catch (error) {
    console.error('Dialogflow detect intent error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get response from Dialogflow'
    };
  }
}

// Simulate Dialogflow responses for demonstration
function simulateDialogflowResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  // Simple keyword matching to simulate Dialogflow responses
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return {
      success: true,
      response: "Hello! I'm your health assistant powered by Dialogflow. How can I help you today?",
      intent: 'greeting',
      sessionId: 'simulated-session-id'
    };
  }
  
  if (lowerMessage.includes('help')) {
    return {
      success: true,
      response: "I can help you with health information, finding doctors, booking appointments, and answering medical questions. What would you like to know?",
      intent: 'help',
      sessionId: 'simulated-session-id'
    };
  }
  
  if (lowerMessage.includes('doctor')) {
    return {
      success: true,
      response: "You can find a list of doctors in the Doctors section of your dashboard or book an appointment directly from there.",
      intent: 'doctor_info',
      sessionId: 'simulated-session-id'
    };
  }
  
  if (lowerMessage.includes('appointment')) {
    return {
      success: true,
      response: "To book an appointment, go to your dashboard and click 'Book Appointment'. You can select a doctor, date, and time that works for you.",
      intent: 'appointment_info',
      sessionId: 'simulated-session-id'
    };
  }
  
  if (lowerMessage.includes('medicine') || lowerMessage.includes('prescription')) {
    return {
      success: true,
      response: "Always follow your doctor's prescription. If you have questions about your medication, consult your healthcare provider.",
      intent: 'medicine_info',
      sessionId: 'simulated-session-id'
    };
  }
  
  if (lowerMessage.includes('emergency')) {
    return {
      success: true,
      response: "If this is a medical emergency, please call your local emergency number immediately or go to the nearest emergency room.",
      intent: 'emergency_info',
      sessionId: 'simulated-session-id'
    };
  }
  
  if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
    return {
      success: true,
      response: "Goodbye! Take care of your health. Feel free to come back if you have more questions.",
      intent: 'goodbye',
      sessionId: 'simulated-session-id'
    };
  }
  
  // Default response for health-related queries
  const healthTips = [
    "Remember to stay hydrated throughout the day!",
    "Regular exercise is important for maintaining good health.",
    "A balanced diet with plenty of fruits and vegetables is essential.",
    "Getting adequate sleep helps your body recover and function properly.",
    "Regular health checkups can help detect issues early.",
    "Managing stress is important for both mental and physical health.",
    "Washing your hands frequently helps prevent the spread of germs."
  ];
  
  return {
    success: true,
    response: healthTips[Math.floor(Math.random() * healthTips.length)],
    intent: 'default',
    sessionId: 'simulated-session-id'
  };
}

// API endpoint for chatbot messages
app.post('/api/chatbot', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }
    
    const response = await detectIntent(message, sessionId || 'default-session');
    res.json(response);
  } catch (error) {
    console.error('Chatbot endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// New Gemini API proxy endpoint
const { GoogleAuth } = require('google-auth-library');
const fetch = require('node-fetch');

app.post('/api/gemini', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

const path = require('path');
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'swasthyalink-468105-143623eabdaa.json');

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/generative-language'],
});
const client = await auth.getClient();

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

    const body = {
      contents: [{
        parts: [{
          text: message
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 256,
        topP: 0.8,
        topK: 40,
      }
    };

    const response = await client.request({
      url,
      method: 'POST',
      data: body,
    });

    if (response.status !== 200) {
      return res.status(response.status).json({ success: false, error: 'Gemini API error' });
    }

    const data = response.data;
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

    res.json({ success: true, response: generatedText });
  } catch (error) {
    console.error('Gemini API proxy error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    dialogflow: sessionClient ? 'connected' : 'simulated'
  });
});

const { v4: uuidv4 } = require('uuid');

// In-memory data stores
const familyRequests = [];
const familyNetworks = {};
const mockUsers = [
  { 
    email: 'john.doe@example.com', 
    name: 'John Doe', 
    phone: '+91 98765 43210',
    address: '123 Main Street, New York, NY 10001',
    city: 'New York',
    state: 'NY',
    zipCode: '10001'
  },
  { 
    email: 'jane.smith@example.com', 
    name: 'Jane Smith', 
    phone: '+91 98765 43211',
    address: '456 Oak Avenue, Los Angeles, CA 90001',
    city: 'Los Angeles',
    state: 'CA',
    zipCode: '90001'
  },
  { 
    email: 'mike.johnson@example.com', 
    name: 'Mike Johnson', 
    phone: '+91 98765 43212',
    address: '789 Pine Road, Chicago, IL 60601',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60601'
  },
  { 
    email: 'sarah.wilson@example.com', 
    name: 'Sarah Wilson', 
    phone: '+91 98765 43213',
    address: '321 Elm Street, Houston, TX 77001',
    city: 'Houston',
    state: 'TX',
    zipCode: '77001'
  },
  { 
    email: 'emma.brown@example.com', 
    name: 'Emma Brown', 
    phone: '+91 98765 43214',
    address: '654 Maple Drive, Phoenix, AZ 85001',
    city: 'Phoenix',
    state: 'AZ',
    zipCode: '85001'
  },
  { 
    email: 'david.davis@example.com', 
    name: 'David Davis', 
    phone: '+91 98765 43215',
    address: '987 Cedar Lane, Philadelphia, PA 19101',
    city: 'Philadelphia',
    state: 'PA',
    zipCode: '19101'
  }
];

// API to search users by email or name
app.get('/api/users/search', (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query parameter is required' });
  }

  const searchTerm = query.toLowerCase();
  const results = mockUsers.filter(user => 
    user.email.toLowerCase().includes(searchTerm) || 
    user.name.toLowerCase().includes(searchTerm)
  );

  res.json({ success: true, results });
});

// Enhanced search API with address support
app.get('/api/users/search/advanced', (req, res) => {
  const { query, searchType = 'all' } = req.query;
  
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query parameter is required' });
  }

  const searchTerm = query.toLowerCase();
  let results = [];

  switch (searchType) {
    case 'email':
      results = mockUsers.filter(user => 
        user.email.toLowerCase().includes(searchTerm)
      );
      break;
    case 'name':
      results = mockUsers.filter(user => 
        user.name.toLowerCase().includes(searchTerm)
      );
      break;
    case 'address':
      results = mockUsers.filter(user => 
        user.address.toLowerCase().includes(searchTerm) ||
        user.city.toLowerCase().includes(searchTerm) ||
        user.state.toLowerCase().includes(searchTerm) ||
        user.zipCode.includes(searchTerm)
      );
      break;
    case 'all':
    default:
      results = mockUsers.filter(user => 
        user.email.toLowerCase().includes(searchTerm) || 
        user.name.toLowerCase().includes(searchTerm) ||
        user.address.toLowerCase().includes(searchTerm) ||
        user.city.toLowerCase().includes(searchTerm) ||
        user.state.toLowerCase().includes(searchTerm) ||
        user.zipCode.includes(searchTerm)
      );
      break;
  }

  res.json({ success: true, results });
});

// API to send family request
app.post('/api/family/request', (req, res) => {
  const { fromEmail, toEmail, toName, relationship } = req.body;

  if (!fromEmail || (!toEmail && !toName) || !relationship) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  // Check if request already exists
  const existingRequest = familyRequests.find(req =>
    req.fromEmail === fromEmail &&
    (req.toEmail === toEmail || req.toName === toName) &&
    req.relationship === relationship &&
    req.status === 'pending'
  );

  if (existingRequest) {
    return res.status(409).json({ success: false, error: 'Request already pending' });
  }

  // Check if already family
  const existingFamily = familyNetworks[fromEmail]?.some(member => 
    member.email === toEmail || member.email === toName
  );

  if (existingFamily) {
    return res.status(409).json({ success: false, error: 'Already in family network' });
  }

  const newRequest = {
    id: uuidv4(),
    fromEmail,
    toEmail,
    toName,
    relationship,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  familyRequests.push(newRequest);

  res.json({ success: true, request: newRequest });
});

// API to accept family request
app.post('/api/family/request/:id/accept', (req, res) => {
  const { id } = req.params;
  const request = familyRequests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, error: 'Request not found' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'Request already processed' });
  }

  request.status = 'accepted';
  request.respondedAt = new Date().toISOString();

  // Add to family network for both parties
  if (!familyNetworks[request.fromEmail]) {
    familyNetworks[request.fromEmail] = [];
  }
  if (!familyNetworks[request.toEmail]) {
    familyNetworks[request.toEmail] = [];
  }

  familyNetworks[request.fromEmail].push({
    email: request.toEmail || request.toName,
    name: mockUsers.find(u => u.email === request.toEmail)?.name || request.toName,
    relationship: request.relationship,
    status: 'accepted',
    addedAt: new Date().toISOString()
  });

  familyNetworks[request.toEmail].push({
    email: request.fromEmail,
    name: mockUsers.find(u => u.email === request.fromEmail)?.name || request.fromEmail,
    relationship: getInverseRelationship(request.relationship),
    status: 'accepted',
    addedAt: new Date().toISOString()
  });

  res.json({ success: true, request });
});

// API to reject family request
app.post('/api/family/request/:id/reject', (req, res) => {
  const { id } = req.params;
  const request = familyRequests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, error: 'Request not found' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'Request already processed' });
  }

  request.status = 'declined';
  request.respondedAt = new Date().toISOString();

  res.json({ success: true, request });
});

// API to get family network for an email
app.get('/api/family/network', (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Email query parameter is required' });
  }

  const network = familyNetworks[email] || [];

  res.json({ success: true, network });
});

// API to get pending requests for a user
app.get('/api/family/requests', (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Email query parameter is required' });
  }

  const sentRequests = familyRequests.filter(req => req.fromEmail === email);
  const receivedRequests = familyRequests.filter(req => 
    (req.toEmail === email || req.toName === email) && req.status === 'pending'
  );

  res.json({ 
    success: true, 
    sent: sentRequests,
    received: receivedRequests 
  });
});

// Helper function to get inverse relationship
function getInverseRelationship(relationship) {
  const inverseMap = {
    'Spouse': 'Spouse',
    'Parent': 'Child',
    'Child': 'Parent',
    'Sibling': 'Sibling',
    'Grandparent': 'Grandchild',
    'Grandchild': 'Grandparent',
    'Uncle': 'Niece/Nephew',
    'Aunt': 'Niece/Nephew',
    'Cousin': 'Cousin',
    'Friend': 'Friend',
    'Caregiver': 'Patient'
  };
  return inverseMap[relationship] || 'Related';
}

// API to get both families when relationship is accepted
app.get('/api/family/mutual-network', (req, res) => {
  const { email1, email2 } = req.query;

  if (!email1 || !email2) {
    return res.status(400).json({ success: false, error: 'Both email1 and email2 are required' });
  }

  const network1 = familyNetworks[email1] || [];
  const network2 = familyNetworks[email2] || [];

  // Find the relationship between email1 and email2
  const relationship1 = network1.find(member => member.email === email2);
  const relationship2 = network2.find(member => member.email === email1);

  res.json({ 
    success: true, 
    user1: {
      email: email1,
      family: network1
    },
    user2: {
      email: email2,
      family: network2
    },
    relationship: relationship1 || relationship2
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💬 Chatbot endpoint: http://localhost:${PORT}/api/chatbot`);
});

module.exports = app;
