import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// 生成默认播客封面（900×383，2.35:1）
async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outputPath = resolve(root, "assets", "default-cover.jpg");

  const svg = `<svg width="900" height="383" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1a1a2e"/>
        <stop offset="100%" stop-color="#16213e"/>
      </linearGradient>
    </defs>
    <rect width="900" height="383" fill="url(#bg)"/>
    <circle cx="780" cy="110" r="90" fill="#e94560" opacity="0.12"/>
    <circle cx="850" cy="290" r="130" fill="#0f3460" opacity="0.25"/>
    <text x="70" y="185" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="64" fill="#ffffff" font-weight="bold">商业财经</text>
    <text x="70" y="250" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="40" fill="#e94560">单人播客</text>
    <text x="70" y="310" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="22" fill="#aaaaaa">每期 10 分钟，听懂一个商业信号</text>
  </svg>`;

  await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toFile(outputPath);
  console.log(`✓ 默认封面已生成：${outputPath}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
