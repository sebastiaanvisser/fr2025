# Google Custom Search API Setup Guide

This script uses the Google Custom Search API to search for images. You get 100 free queries per day.

## Step 1: Get Google API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the "Custom Search API":
   - Go to "APIs & Services" > "Library"
   - Search for "Custom Search API"
   - Click "Enable"
4. Create credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy your API key

## Step 2: Create Custom Search Engine

1. Go to [Google Custom Search](https://cse.google.com/)
2. Click "Create a search engine"
3. Configure your search engine:
   - **Sites to search**: Leave blank for web-wide search
   - **Name**: Give it a name (e.g., "Image Search")
   - **Language**: English
   - **Image search**: Check "Enable image search"
   - **SafeSearch**: Choose your preference
4. Click "Create"
5. Copy your Search Engine ID (cx parameter)
6. **Important**: Make sure "Image search" is enabled in your search engine settings

## Step 3: Configure the Script

### Option A: Environment Variables (Recommended)

```bash
export GOOGLE_API_KEY="your_api_key_here"
export SEARCH_ENGINE_ID="your_search_engine_id_here"
```

### Option B: Direct in Script

Edit `google_image_search.js` and replace:

```javascript
const GOOGLE_API_KEY = "YOUR_GOOGLE_API_KEY";
const SEARCH_ENGINE_ID = "YOUR_SEARCH_ENGINE_ID";
```

## Step 4: Test the Script

```bash
node google_image_search.js "Château de Beynac"
```

## Usage Examples

```bash
# Search for castles
node google_image_search.js "Château de Beynac"

# Search for canoe locations
node google_image_search.js "canoe Dordogne France"

# Search for museums
node google_image_search.js "Musée du Louvre Paris"
```

## API Limits

- **Free tier**: 100 queries per day
- **Paid tier**: $5 per 1000 queries
- **Rate limit**: 10 queries per second

## Troubleshooting

### "API key not valid" error

- Check your API key is correct
- Ensure Custom Search API is enabled
- Verify billing is set up (even for free tier)

### "Search engine not found" error

- Check your Search Engine ID
- Ensure image search is enabled
- Verify the search engine is configured for web-wide search

### "Requests to this API customsearch method are blocked" error

- **Enable the Custom Search API** in Google Cloud Console
- Go to APIs & Services > Library > Search for "Custom Search API" > Enable
- **Set up billing** (required even for free tier)
- **Check API key restrictions** - make sure it's not restricted to specific APIs
- **Verify project** - ensure you're using the correct Google Cloud project

### "Quota exceeded" error

- You've used your 100 free queries
- Wait until tomorrow or upgrade to paid tier

## Security Notes

- Keep your API key secure
- Don't commit it to version control
- Use environment variables in production
- Monitor your usage to avoid unexpected charges
