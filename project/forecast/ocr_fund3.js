const Tesseract = require('tesseract.js');

const imagePath = '/tmp/fund_hires.png';

async function main() {
  console.log('Starting OCR with chi_sim...');
  
  try {
    const { data: { text } } = await Tesseract.recognize(
      imagePath,
      'chi_sim',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            process.stdout.write(`\rOCR: ${Math.round(m.progress * 100)}%`);
          } else if (m.status) {
            console.log(`  [${m.status}] ${m.progress ? Math.round(m.progress*100)+'%' : ''}`);
          }
        }
      }
    );
    
    console.log('\n\n=== OCR Result ===\n');
    console.log(text);
  } catch(e) {
    console.error('Error:', e.message);
  }
}

main();
