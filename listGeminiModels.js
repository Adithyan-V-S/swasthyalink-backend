const { GoogleAuth } = require('google-auth-library');
const fetch = require('node-fetch');
const path = require('path');

// Set the credentials path
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'swasthyalink-468105-143623eabdaa.json');

async function listModels() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/generative-language'],
  });

  const client = await auth.getClient();
  const url = 'https://generativelanguage.googleapis.com/v1beta/models';

  const res = await client.request({ url });
  const models = res.data.models || [];

  console.log('Available Gemini Models:');
  models.forEach((model) => {
    console.log(`- Name: ${model.name}`);
    console.log(`  Display Name: ${model.displayName}`);
    console.log(`  Supported Methods: ${model.supportedGenerationMethods.join(', ')}`);
    console.log('---');
  });
}

listModels().catch((err) => {
  console.error('Error listing Gemini models:', err);
});
