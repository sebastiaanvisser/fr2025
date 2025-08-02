const fs = require('fs');

// Configuration
const INPUT_FILE = 'poi.json';
const OUTPUT_FILE = 'poi_with_images.json';

// Environment variable configuration
const MOCK_MODE = process.env.MOCK === 'true';
const NO_LIMIT = process.env.NOLIMIT === 'true';
const MAX_ITEMS = NO_LIMIT ? Infinity : 5;

// Function to generate a mock image URL for testing
function generateMockImageUrl(name, location) {
  const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const sanitizedLocation = location.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `https://example.com/images/${sanitizedName}-${sanitizedLocation}.jpg`;
}

// Function to create backup filename with datetime
function createBackupFilename() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `poi_with_images.json.backup-${timestamp}`;
}

// Function to process POI entries
async function processPOIEntries() {
  try {
    // Read the POI data
    const poiData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    const processedEntries = [];
    let skippedCount = 0;
    let processedCount = 0;
    let limitedCount = 0;
    
    console.log(`Processing ${poiData.length} POI entries...`);
    console.log(`Mode: ${MOCK_MODE ? 'MOCK (fake URLs)' : 'REAL (calling Google API)'}`);
    console.log(`Limit: ${NO_LIMIT ? 'No limit' : `Max ${MAX_ITEMS} processed items (skipped entries don't count)`}`);
    console.log('=' .repeat(60));
    
    for (let index = 0; index < poiData.length; index++) {
      const entry = poiData[index];
      
      // Skip entries that already have an image URL
      if (entry.image && entry.image !== null) {
        console.log(`[${index + 1}] SKIPPED: "${entry.name}" - already has image URL`);
        processedEntries.push(entry);
        skippedCount++;
        continue;
      }
      
      // Check if we've reached the limit (only counts entries that need processing)
      if (limitedCount >= MAX_ITEMS) {
        console.log(`[${index + 1}] SKIPPED: "${entry.name}" - limit reached (${MAX_ITEMS} processed items)`);
        processedEntries.push(entry);
        continue;
      }
      
      // Create search query from name and location
      const searchQuery = `${entry.name} ${entry.location}`;
      
      if (MOCK_MODE) {
        // Mock mode: generate fake URL
        const mockImageUrl = generateMockImageUrl(entry.name, entry.location);
        const updatedEntry = { ...entry, image: mockImageUrl };
        processedEntries.push(updatedEntry);
        
        console.log(`[${index + 1}] MOCK: "${entry.name}" -> ${mockImageUrl}`);
        processedCount++;
        limitedCount++;
      } else {
        // Real mode: call the Google image search API
        try {
          console.log(`[${index + 1}] SEARCHING: "${entry.name}"...`);
          
          // Import and call the Google image search function
          const { getFirstGoogleImage } = require('./google_image_search.js');
          const imageUrl = await getFirstGoogleImage(searchQuery);
          
          if (imageUrl) {
            const updatedEntry = { ...entry, image: imageUrl };
            processedEntries.push(updatedEntry);
            console.log(`[${index + 1}] FOUND: "${entry.name}" -> ${imageUrl}`);
            processedCount++;
            limitedCount++;
          } else {
            console.log(`[${index + 1}] NO IMAGE: "${entry.name}" - no image found`);
            processedEntries.push(entry);
          }
        } catch (error) {
          console.error(`[${index + 1}] ERROR: "${entry.name}" - ${error.message}`);
          processedEntries.push(entry);
        }
      }
    }
    
    // Write the updated data to output file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(processedEntries, null, 2));
    
    // Create backup of original file
    const backupFilename = createBackupFilename();
    fs.copyFileSync(INPUT_FILE, backupFilename);
    console.log(`Backup created: ${backupFilename}`);
    
    // Copy processed file over the original
    fs.copyFileSync(OUTPUT_FILE, INPUT_FILE);
    console.log(`Updated: ${INPUT_FILE}`);
    
    // Remove the temporary output file
    fs.unlinkSync(OUTPUT_FILE);
    console.log(`Cleaned up: ${OUTPUT_FILE}`);
    
    console.log('=' .repeat(60));
    console.log(`Processing complete!`);
    console.log(`- Total entries: ${poiData.length}`);
    console.log(`- Skipped (already have images): ${skippedCount}`);
    console.log(`- Processed: ${processedCount}`);
    console.log(`- Limited by quota: ${limitedCount >= MAX_ITEMS ? 'Yes' : 'No'}`);
    console.log(`- Backup file: ${backupFilename}`);
    
    if (!MOCK_MODE) {
      console.log('\n📝 API Usage:');
      console.log(`- Used ${limitedCount} Google API calls`);
      console.log(`- Remaining quota: ${100 - limitedCount} calls today`);
    }
    
  } catch (error) {
    console.error('Error processing POI entries:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  processPOIEntries().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { processPOIEntries, generateMockImageUrl }; 