const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const fs = require('fs');

const IMAGE_PATH = '/Users/zcy1/.claude/image-cache/5b115092-a613-4a15-8433-cac1eba82f1f/1.jpeg';

// Based on content block analysis, fund entries are ~40-47px tall
// with 6-7px gaps between them
// The pattern repeats roughly every 50-60px
const FUND_STRIP_HEIGHT = 55; // Each fund entry ~55px
const STRIP_OVERLAP = 5; // Overlap between strips

async function extractStrips() {
  const metadata = await sharp(IMAGE_PATH).metadata();
  const { width, height } = metadata;
  console.log(`Image: ${width}x${height}`);
  
  const strips = [];
  let y = 0;
  let stripNum = 0;
  
  // Skip header (~34px blue bar + some padding)
  y = 40;
  
  while (y < height - 20) {
    const stripHeight = Math.min(FUND_STRIP_HEIGHT, height - y);
    const stripPath = `/tmp/fund_strip_${stripNum}.png`;
    
    await sharp(IMAGE_PATH)
      .extract({ left: 0, top: y, width, height: stripHeight })
      .resize({ width: 1200, fit: 'inside' })
      .grayscale()
      .normalize()
      .sharpen()
      .toFile(stripPath);
    
    strips.push({ path: stripPath, y, height: stripHeight, num: stripNum });
    stripNum++;
    y += FUND_STRIP_HEIGHT - STRIP_OVERLAP;
  }
  
  console.log(`Created ${strips.length} strips`);
  return strips;
}

async function ocrStrip(strip) {
  try {
    const { data: { text } } = await Tesseract.recognize(
      strip.path,
      'chi_sim+eng',
      { logger: () => {} }
    );
    return { ...strip, text: text.trim() };
  } catch (e) {
    return { ...strip, text: '', error: e.message };
  }
}

async function main() {
  const strips = await extractStrips();
  
  console.log('\n=== OCR Results (processing strips in batches) ===\n');
  
  // Process in batches of 5
  for (let i = 0; i < strips.length; i += 5) {
    const batch = strips.slice(i, i + 5);
    const results = await Promise.all(batch.map(ocrStrip));
    
    for (const r of results) {
      if (r.text && r.text.length > 3) {
        // Clean up the text
        const cleaned = r.text.replace(/\s+/g, ' ').trim();
        console.log(`[Strip ${r.num} (y=${r.y})]: ${cleaned}`);
      }
    }
    process.stdout.write(`\rProcessed ${Math.min(i+5, strips.length)}/${strips.length} strips`);
  }
  
  console.log('\n\nDone.');
}

main().catch(err => console.error('Error:', err));
