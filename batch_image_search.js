const fs = require('fs');

// Configuration
const INPUT_FILE = 'poi.json';
const OUTPUT_FILE = 'poi_with_images.json';
const MOCK_MODE = true; // Set to false to generate real commands

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
function processPOIEntries() {
  try {
    // Read the POI data
    const poiData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    const processedEntries = [];
    let skippedCount = 0;
    let processedCount = 0;
    
    console.log(`Processing ${poiData.length} POI entries...`);
    console.log(`Mode: ${MOCK_MODE ? 'MOCK (fake URLs)' : 'REAL (will print commands)'}`);
    console.log('=' .repeat(60));
    
    poiData.forEach((entry, index) => {
      // Skip entries that already have an image URL
      if (entry.image && entry.image !== null) {
        console.log(`[${index + 1}] SKIPPED: "${entry.name}" - already has image URL`);
        processedEntries.push(entry);
        skippedCount++;
        return;
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
      } else {
        // Real mode: print the command that would be run
        const command = `node google_image_search.js "${searchQuery}"`;
        console.log(`[${index + 1}] COMMAND: ${command}`);
        
        // Keep the original entry (no image URL added yet)
        processedEntries.push(entry);
        processedCount++;
      }
    });
    
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
    console.log(`- Backup file: ${backupFilename}`);
    
    if (!MOCK_MODE) {
      console.log('\n📝 Next steps:');
      console.log('1. Review the commands above');
      console.log('2. Run them one by one to get image URLs');
      console.log('3. Update the JSON manually with the results');
      console.log('4. Or modify this script to actually call the API');
    }
    
  } catch (error) {
    console.error('Error processing POI entries:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  processPOIEntries();
}

module.exports = { processPOIEntries, generateMockImageUrl }; 