require('dotenv').config();
const powensService = require('./src/services/powens/powensService');

console.log('=== Powens URL Debug ===');
console.log('Environment variables:');
console.log('POWENS_CLIENT_ID:', process.env.POWENS_CLIENT_ID ? '[SET]' : '[NOT SET]');
console.log('POWENS_CLIENT_SECRET:', process.env.POWENS_CLIENT_SECRET ? '[SET]' : '[NOT SET]');
console.log('POWENS_REDIRECT_URI:', process.env.POWENS_REDIRECT_URI);
console.log('POWENS_DOMAIN:', process.env.POWENS_DOMAIN);

// Try to initialize user first
console.log('\n=== Initializing User ===');
powensService.initializeUser()
  .then(authToken => {
    console.log('✅ User initialization successful');
    console.log('Auth token preview:', authToken.substring(0, 10) + '...');
    
    // Generate auth URL
    console.log('\n=== Generating Auth URL ===');
    const authData = powensService.generateAuthUrl('test-user-id');
    console.log('Full auth URL:', authData.authUrl);
    console.log('State:', authData.state);
    
    // Parse the URL to show parameters
    console.log('\n=== URL Parameters ===');
    const url = new URL(authData.authUrl);
    console.log('Base URL:', url.origin + url.pathname);
    url.searchParams.forEach((value, key) => {
      console.log(`${key}: ${value}`);
    });
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
    
    // Try without initialization
    console.log('\n=== Trying without initialization ===');
    try {
      const authData = powensService.generateAuthUrl('test-user-id');
      console.log('Auth URL (without init):', authData.authUrl);
    } catch (urlError) {
      console.error('URL generation also failed:', urlError.message);
    }
  });
