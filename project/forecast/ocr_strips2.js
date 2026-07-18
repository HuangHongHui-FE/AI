const Tesseract = require('tesseract.js');
const fs = require('fs');

const strips = JSON.parse(fs.readFileSync('/tmp/strips.json', 'utf8'));

async function ocrOne(strip) {
  const [n, y, h, path] = strip;
  try {
    const { data: { text } } = await Tesseract.recognize(path, 'chi_sim+eng', {
      logger: () => {}
    });
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return { n, y, text: cleaned };
  } catch (e) {
    return { n, y, text: '', error: e.message };
  }
}

async function main() {
  console.log(`Processing ${strips.length} strips...\n`);
  
  // Process in batches of 4
  const results = [];
  for (let i = 0; i < strips.length; i += 4) {
    const batch = strips.slice(i, i + 4);
    const batchResults = await Promise.all(batch.map(ocrOne));
    results.push(...batchResults);
    process.stdout.write(`\rProgress: ${Math.min(i+4, strips.length)}/${strips.length}`);
  }
  
  console.log('\n\n=== Strips with content ===\n');
  for (const r of results) {
    if (r.text && r.text.length > 5) {
      console.log(`[Strip ${r.n} y=${r.y}]: ${r.text}`);
    }
  }
  
  // Save full results
  fs.writeFileSync('/tmp/ocr_results.json', JSON.stringify(results, null, 2));
  console.log('\nSaved full results to /tmp/ocr_results.json');
}

main().catch(err => console.error('Error:', err));
