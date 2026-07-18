const Tesseract = require('tesseract.js');

const imagePath = '/Users/zcy1/.claude/image-cache/5b115092-a613-4a15-8433-cac1eba82f1f/1.jpeg';

async function main() {
  console.log('Starting OCR on fund holdings image...');
  
  const { data: { text } } = await Tesseract.recognize(
    imagePath,
    'chi_sim+eng',
    {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\rOCR progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    }
  );
  
  console.log('\n\n=== OCR Result ===\n');
  console.log(text);
}

main().catch(err => {
  console.error('OCR failed:', err.message);
  process.exit(1);
});
