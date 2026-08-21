import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT_DIR = "comics/capybara-lulu/concepts";
mkdirSync(OUT_DIR, { recursive: true });

// 表情五官（需配合头轮廓使用）
function face({ emo = "calm" }) {
  const faces = {
    calm: `
      <circle cx="350" cy="265" r="9" fill="#3a3a3a"/>
      <circle cx="450" cy="265" r="9" fill="#3a3a3a"/>
      <path d="M 325 250 Q 350 238 375 250" stroke="#4a4a4a" stroke-width="3.5" fill="none"/>
      <path d="M 425 250 Q 450 238 475 250" stroke="#4a4a4a" stroke-width="3.5" fill="none"/>
      <path d="M 385 315 Q 400 325 415 315" stroke="#4a4a4a" stroke-width="3.5" fill="none"/>
    `,
    tired: `
      <ellipse cx="350" cy="268" rx="14" ry="10" fill="#d0c8c0" opacity="0.6"/>
      <ellipse cx="450" cy="268" rx="14" ry="10" fill="#d0c8c0" opacity="0.6"/>
      <circle cx="350" cy="268" r="6" fill="#3a3a3a"/>
      <circle cx="450" cy="268" r="6" fill="#3a3a3a"/>
      <path d="M 385 320 Q 400 330 415 320" stroke="#4a4a4a" stroke-width="3.5" fill="none"/>
    `,
    cozy: `
      <path d="M 335 262 Q 350 252 365 262" stroke="#4a4a4a" stroke-width="4" fill="none"/>
      <path d="M 435 262 Q 450 252 465 262" stroke="#4a4a4a" stroke-width="4" fill="none"/>
      <circle cx="340" cy="280" r="7" fill="#f5a3a3" opacity="0.5"/>
      <circle cx="460" cy="280" r="7" fill="#f5a3a3" opacity="0.5"/>
      <path d="M 385 318 Q 400 330 415 318" stroke="#4a4a4a" stroke-width="3.5" fill="none"/>
    `,
    think: `
      <circle cx="350" cy="265" r="8" fill="#3a3a3a"/>
      <path d="M 435 260 Q 450 252 465 260" stroke="#4a4a4a" stroke-width="3.5" fill="none"/>
      <path d="M 388 315 Q 400 323 412 315" stroke="#4a4a4a" stroke-width="3.5" fill="none"/>
    `,
    foodie: `
      <ellipse cx="360" cy="275" rx="16" ry="13" fill="#f0ece5" stroke="#4a4a4a" stroke-width="3"/>
      <ellipse cx="440" cy="275" rx="16" ry="13" fill="#f0ece5" stroke="#4a4a4a" stroke-width="3"/>
      <circle cx="360" cy="272" r="5" fill="#3a3a3a"/>
      <circle cx="440" cy="272" r="5" fill="#3a3a3a"/>
      <path d="M 390 325 Q 400 335 410 325" stroke="#4a4a4a" stroke-width="3.5" fill="none"/>
    `,
  };
  return faces[emo] || faces.calm;
}

// 头轮廓+耳朵+鼻子嘴（固定位置）
function capyHead({ faceSvg, headExtra = "" }) {
  return `
    <g stroke="#4a4a4a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="285" cy="260" rx="22" ry="32" fill="#f0ece5" stroke-width="3.5"/>
      <ellipse cx="515" cy="260" rx="22" ry="32" fill="#f0ece5" stroke-width="3.5"/>
      <ellipse cx="400" cy="300" rx="120" ry="105" fill="#f0ece5"/>
      <path d="M 350 335 Q 400 395 450 335 Q 458 308 440 295 Q 400 282 360 295 Q 342 308 350 335" fill="#e8e0d6" stroke-width="3.5"/>
      <ellipse cx="400" cy="332" rx="26" ry="20" fill="#3a3a3a" stroke="none"/>
      <path d="M 400 355 L 400 380" stroke="#4a4a4a" stroke-width="3.5"/>
      <path d="M 370 375 Q 400 398 430 375" stroke="#4a4a4a" stroke-width="3.5"/>
      ${faceSvg}
      ${headExtra}
    </g>
  `;
}

const concepts = [
  {
    name: "01-base",
    svg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
        <rect width="800" height="800" fill="#faf8f5"/>
        <g stroke="#4a4a4a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="400" cy="720" rx="140" ry="25" fill="#e8e4de" stroke="none"/>
          <ellipse cx="400" cy="530" rx="185" ry="140" fill="#f0ece5"/>
          <rect x="305" y="620" width="55" height="95" rx="22" fill="#f0ece5" stroke-width="3.5"/>
          <rect x="440" y="620" width="55" height="95" rx="22" fill="#f0ece5" stroke-width="3.5"/>
          <rect x="360" y="645" width="38" height="70" rx="14" fill="#f0ece5" stroke-width="3.5"/>
          <rect x="402" y="645" width="38" height="70" rx="14" fill="#f0ece5" stroke-width="3.5"/>
          <ellipse cx="575" cy="520" rx="18" ry="11" fill="#f0ece5" stroke-width="3"/>
          ${capyHead({ faceSvg: face({ emo: "calm" }), headExtra: `
            <circle cx="400" cy="175" r="42" fill="#f5a623" stroke="#c47a0f" stroke-width="3"/>
            <path d="M 400 133 L 406 110 L 394 110 Z" fill="#4a7c2a" stroke="#3a5a1f" stroke-width="2"/>
          ` })}
        </g>
      </svg>
    `,
  },
  {
    name: "02-worker",
    svg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
        <rect width="800" height="800" fill="#f4f6f8"/>
        <g stroke="#4a4a4a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="400" cy="720" rx="140" ry="25" fill="#e0e4e8" stroke="none"/>
          <rect x="280" y="460" width="240" height="30" rx="6" fill="#8a9aaa" stroke="#5a6a7a" stroke-width="3"/>
          <rect x="310" y="490" width="20" height="170" fill="#8a9aaa" stroke="#5a6a7a" stroke-width="3"/>
          <rect x="470" y="490" width="20" height="170" fill="#8a9aaa" stroke="#5a6a7a" stroke-width="3"/>
          <ellipse cx="400" cy="540" rx="195" ry="125" fill="#f0ece5"/>
          <rect x="285" y="630" width="58" height="100" rx="24" fill="#f0ece5" stroke-width="3.5"/>
          <rect x="457" y="630" width="58" height="100" rx="24" fill="#f0ece5" stroke-width="3.5"/>
          <rect x="350" y="650" width="40" height="72" rx="16" fill="#f0ece5" stroke-width="3.5"/>
          <rect x="410" y="650" width="40" height="72" rx="16" fill="#f0ece5" stroke-width="3.5"/>
          ${capyHead({ faceSvg: face({ emo: "tired" }), headExtra: `
            <circle cx="350" cy="278" r="24" fill="none" stroke="#2a2a2a" stroke-width="3.5"/>
            <circle cx="450" cy="278" r="24" fill="none" stroke="#2a2a2a" stroke-width="3.5"/>
            <line x1="374" y1="278" x2="426" y2="278" stroke="#2a2a2a" stroke-width="3.5"/>
            <line x1="326" y1="278" x2="292" y2="258" stroke="#2a2a2a" stroke-width="3"/>
            <line x1="474" y1="278" x2="508" y2="258" stroke="#2a2a2a" stroke-width="3"/>
          ` })}
          <rect x="560" y="510" width="140" height="90" rx="8" fill="#d0d8e0" stroke="#9aaab8" stroke-width="3"/>
          <rect x="580" y="470" width="100" height="60" rx="4" fill="#3a4a5a" stroke="#2a3a4a" stroke-width="3"/>
          <rect x="590" y="480" width="80" height="40" rx="2" fill="#7ac9ff" stroke="none"/>
          <rect x="560" y="600" width="20" height="90" fill="#9aaab8" stroke="#7a8a98" stroke-width="3"/>
          <rect x="680" y="600" width="20" height="90" fill="#9aaab8" stroke="#7a8a98" stroke-width="3"/>
          <path d="M 220 630 L 220 680 Q 220 695 245 695 L 255 695 Q 280 695 280 680 L 280 630 Z" fill="#8a6a4a" stroke="#5a4a3a" stroke-width="3"/>
          <path d="M 280 645 Q 300 645 300 660 Q 300 675 280 675" fill="none" stroke="#5a4a3a" stroke-width="3"/>
        </g>
      </svg>
    `,
  },
  {
    name: "03-cozy",
    svg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
        <rect width="800" height="800" fill="#fff8f0"/>
        <g stroke="#4a4a4a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="400" cy="720" rx="160" ry="28" fill="#f0e8dc" stroke="none"/>
          <ellipse cx="400" cy="580" rx="225" ry="115" fill="#f0ece5"/>
          <path d="M 210 545 Q 400 500 590 545 Q 615 600 590 645 Q 400 690 210 645 Q 185 600 210 545" fill="#c9e6f5" stroke="#7aaabf" stroke-width="3.5" opacity="0.85"/>
          <ellipse cx="170" cy="560" rx="55" ry="35" fill="#f5d0c5" stroke="#c49a8a" stroke-width="3"/>
          <rect x="525" y="640" width="50" height="80" rx="18" fill="#f0ece5" stroke-width="3.5"/>
          <rect x="585" y="630" width="50" height="85" rx="18" fill="#f0ece5" stroke-width="3.5"/>
          <ellipse cx="615" cy="570" rx="18" ry="10" fill="#f0ece5" stroke-width="3"/>
          ${capyHead({ faceSvg: face({ emo: "cozy" }), headExtra: `
            <path d="M 325 235 Q 400 200 475 235 Q 490 258 475 278 Q 400 250 325 278 Q 310 258 325 235" fill="#b8d4e3" stroke="#7a9aaa" stroke-width="3"/>
          ` })}
        </g>
      </svg>
    `,
  },
  {
    name: "04-thinker",
    svg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
        <rect width="800" height="800" fill="#f5f7f4"/>
        <g stroke="#4a4a4a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="400" cy="720" rx="150" ry="26" fill="#e0e6dc" stroke="none"/>
          <ellipse cx="400" cy="600" rx="190" ry="105" fill="#f0ece5"/>
          <path d="M 285 650 Q 250 685 285 705 Q 325 715 345 680" fill="#f0ece5" stroke-width="3.5"/>
          <path d="M 515 650 Q 550 685 515 705 Q 475 715 455 680" fill="#f0ece5" stroke-width="3.5"/>
          <ellipse cx="285" cy="470" rx="30" ry="20" fill="#f7d9b8" stroke-width="3"/>
          ${capyHead({ faceSvg: face({ emo: "think" }), headExtra: `
            <text x="540" y="220" font-size="70" fill="#7a6a8a" stroke="none" font-family="sans-serif" font-weight="700">?</text>
            <path d="M 400 240 Q 400 200 375 180" fill="none" stroke="#6a9a4a" stroke-width="3"/>
            <ellipse cx="375" cy="180" rx="9" ry="5" fill="#7aae5a" stroke="#5a8a3a" stroke-width="2" transform="rotate(-30, 375, 180)"/>
          ` })}
          <path d="M 520 665 L 620 645 L 620 685 L 520 705 Z" fill="#f5e6a8" stroke="#d4b85a" stroke-width="3"/>
          <path d="M 520 665 L 520 705" stroke="#d4b85a" stroke-width="3"/>
          <line x1="535" y1="670" x2="535" y2="700" stroke="#d4b85a" stroke-width="2"/>
          <line x1="550" y1="665" x2="550" y2="695" stroke="#d4b85a" stroke-width="2"/>
        </g>
      </svg>
    `,
  },
  {
    name: "05-foodie",
    svg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
        <rect width="800" height="800" fill="#fffaf5"/>
        <g stroke="#4a4a4a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="400" cy="720" rx="150" ry="26" fill="#f0e8dc" stroke="none"/>
          <ellipse cx="400" cy="550" rx="200" ry="135" fill="#f0ece5"/>
          <rect x="300" y="650" width="55" height="90" rx="22" fill="#f0ece5" stroke-width="3.5"/>
          <rect x="445" y="650" width="55" height="90" rx="22" fill="#f0ece5" stroke-width="3.5"/>
          <rect x="360" y="670" width="38" height="62" rx="14" fill="#f0ece5" stroke-width="3.5"/>
          <rect x="402" y="670" width="38" height="62" rx="14" fill="#f0ece5" stroke-width="3.5"/>
          ${capyHead({ faceSvg: face({ emo: "foodie" }), headExtra: `
            <line x1="450" y1="340" x2="510" y2="310" stroke="#c9a44a" stroke-width="3"/>
          ` })}
          <path d="M 280 560 Q 400 625 520 560 L 500 625 Q 400 670 300 625 Z" fill="#f8f0e0" stroke="#c4a47a" stroke-width="3.5"/>
          <ellipse cx="400" cy="560" rx="115" ry="32" fill="#e8d8b8" stroke="#c4a47a" stroke-width="3"/>
          <path d="M 345 550 Q 400 580 455 550" fill="#e85a71" stroke="none" opacity="0.8"/>
          <line x1="520" y1="510" x2="460" y2="550" stroke="#8a6a4a" stroke-width="4"/>
          <line x1="540" y1="520" x2="470" y2="555" stroke="#8a6a4a" stroke-width="4"/>
          <rect x="560" y="590" width="60" height="80" rx="6" fill="#f5e6a8" stroke="#d4b85a" stroke-width="3"/>
          <circle cx="580" cy="620" r="8" fill="#e85a71" opacity="0.8" stroke="none"/>
          <circle cx="600" cy="620" r="6" fill="#7aae5a" opacity="0.8" stroke="none"/>
          <circle cx="590" cy="645" r="7" fill="#4a7ac9" opacity="0.8" stroke="none"/>
        </g>
      </svg>
    `,
  },
];

for (const c of concepts) {
  const svg = c.svg();
  const path = `${OUT_DIR}/${c.name}.png`;
  await sharp(Buffer.from(svg)).png().toFile(path);
  console.log(`✓ ${path}`);
}

console.log("\n全身形象生成完成");
