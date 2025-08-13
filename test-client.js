// Test script to verify buildClient configuration
const axios = require('axios');

// Simulate buildClient function
const buildClient = (context) => {
  if(typeof window === 'undefined'){
    // Server-side rendering - use API Gateway
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return axios.create({
      baseURL: baseURL,
      headers: context.req ? context.req.headers : {}
    })
  }else{
    // Client-side - use API Gateway  
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocal) {
      // Local development - use API Gateway
      return axios.create({
        baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      })
    } else {
      // Production - use relative URLs (ingress will handle routing)
      return axios.create({
        baseURL: '/'
      })
    }
  }
}

// Test API calls
async function testAPI() {
  console.log('Testing API Gateway connectivity...');
  
  const client = buildClient({});
  
  try {
    // Test listings endpoint
    console.log('Testing GET /api/listings...');
    const listingsResponse = await client.get('/api/listings');
    console.log('✅ Listings API response:', listingsResponse.status, listingsResponse.data);
    
    // Test current user endpoint
    console.log('Testing GET /api/auth/current-user...');
    const currentUserResponse = await client.get('/api/auth/current-user');
    console.log('✅ Current user API response:', currentUserResponse.status, currentUserResponse.data);
    
    console.log('🎉 All API tests passed!');
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testAPI();
