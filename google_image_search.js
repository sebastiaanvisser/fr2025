const https = require('https');
const fs = require('fs');

// ⚠️  IMPORTANT: Google Custom Search API has a quota of 100 free queries per day
// Use this script sparingly to avoid hitting the limit

// Function to read Google credentials from .google file
function readGoogleCredentials() {
  try {
    const googleConfig = fs.readFileSync('.google', 'utf8');
    const credentials = {};
    
    googleConfig.split('\n').forEach(line => {
      if (line.startsWith('export ')) {
        // Handle export statements
        const exportLine = line.substring(7); // Remove 'export '
        const [key, value] = exportLine.split('=');
        if (key && value) {
          credentials[key.trim()] = value.trim();
        }
      } else {
        // Handle direct key=value format
        const [key, value] = line.split('=');
        if (key && value) {
          credentials[key.trim()] = value.trim();
        }
      }
    });
    
    return credentials;
  } catch (error) {
    console.error('Error reading .google file:', error.message);
    return null;
  }
}

// Read Google credentials
const credentials = readGoogleCredentials();
const GOOGLE_API_KEY = credentials?.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY';
const SEARCH_ENGINE_ID = credentials?.SEARCH_ENGINE_ID || 'YOUR_SEARCH_ENGINE_ID';

async function getFirstGoogleImage(query) {
  return new Promise((resolve, reject) => {
    // Use image search parameters
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&searchType=image&num=1&imgType=photo`;
    
    console.log('Searching Google Images for:', query);
    
    const options = {
      hostname: 'www.googleapis.com',
      path: `/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&searchType=image&num=1&imgType=photo`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        
        try {
          const response = JSON.parse(data);
          
          // Check for API errors
          if (response.error) {
            console.error('Google API Error:', response.error.message);
            resolve(null);
            return;
          }
          
          // Check if we have search results
          if (response.items && response.items.length > 0) {
            const item = response.items[0];
            
            // Look for image URL in various possible locations
            let imageUrl = item.link;
            
            // Check if there's a specific image URL in pagemap
            if (item.pagemap && item.pagemap.cse_image && item.pagemap.cse_image[0]) {
              imageUrl = item.pagemap.cse_image[0].src;
            }
            
            // Check if there's a thumbnail that might be better
            if (item.pagemap && item.pagemap.cse_thumbnail && item.pagemap.cse_thumbnail[0]) {
              imageUrl = item.pagemap.cse_thumbnail[0].src;
            }
            
            console.log('Found image:', imageUrl);
            resolve(imageUrl);
          } else {
            console.log('No images found');
            resolve(null);
          }
        } catch (error) {
          console.error('Error parsing response:', error.message);
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error.message);
      resolve(null);
    });

    req.end();
  });
}

// CLI usage
if (require.main === module) {
  const query = process.argv[2];
  
  if (!query) {
    console.log('Usage: node google_image_search.js "your search query"');
    console.log('');
    console.log('Setup required:');
    console.log('1. Get Google API key from: https://console.cloud.google.com/');
    console.log('2. Create Custom Search Engine: https://cse.google.com/');
    console.log('3. Create a .google file with your credentials:');
    console.log('   GOOGLE_API_KEY=your_api_key_here');
    console.log('   SEARCH_ENGINE_ID=your_search_engine_id_here');
    console.log('');
    console.log('The .google file should be in the same directory as this script.');
    process.exit(1);
  }
  
  // Check if API credentials are configured
  if (GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY' || SEARCH_ENGINE_ID === 'YOUR_SEARCH_ENGINE_ID') {
    console.error('Error: Google API credentials not configured');
    console.log('');
    console.log('Please set up your Google Custom Search API:');
    console.log('1. Get API key from: https://console.cloud.google.com/');
    console.log('2. Create Custom Search Engine: https://cse.google.com/');
    console.log('3. Create a .google file with your credentials');
    console.log('');
    console.log('Example .google file:');
    console.log('GOOGLE_API_KEY=your_api_key_here');
    console.log('SEARCH_ENGINE_ID=your_search_engine_id_here');
    process.exit(1);
  }
  
  getFirstGoogleImage(query)
    .then(imageUrl => {
      if (imageUrl) {
        console.log(imageUrl);
      } else {
        console.log('No image found');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

module.exports = { getFirstGoogleImage }; 