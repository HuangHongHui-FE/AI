const Tesseract = require('tesseract.js');

const imagePath = '/tmp/fund_wide.png';

async function main() {
  console.log('Starting OCR on wide image...');
  
  const { data: { text } } = await Tesseract.recognize(
    imagePath,
    'chi_sim',
    {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\rOCR: ${Math.round(m.progress * 100)}%`);
        } else if (m.status === 'initializing api') {
          console.log('  [initialized]');
        }
      }
    }
  );
  
  console.log('\n\n=== OCR Result ===\n');
  console.log(text);
}

main().catch(err => console.error('Error:', err.message));
