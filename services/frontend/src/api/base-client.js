import axios from 'axios';

const buildClient = (context) => {
  if(typeof window === 'undefined'){
    // Server-side rendering - use environment variable or fallback to local services
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return axios.create({
      baseURL: baseURL,
      headers: context.req.headers
    })
  }else{
    // Client-side - check if we're in local development
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocal) {
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

export default buildClient;