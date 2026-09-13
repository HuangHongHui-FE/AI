// build_imgs_20260913.cjs — 把用户筛完的候选图落成 cover.jpg/imgN.jpg，并按 2.35:1 裁封面 + 登记 used_images.txt
const fs = require('fs');
const path = require('path');
const sharp = require('/Users/zcy1/code_self/AI/project/wechat-img/node_modules/sharp');

const BATCH = '/Users/zcy1/code_self/AI/project/wechat/文章包/20260913';

// 每篇：封面候选 + 文中图候选（顺序即 img1/img2...）
const ARTICLES = [
  { dir: '01-公司让我给十年老同事做离职面谈', cover: 'cand_4', imgs: ['cand_1'] },
  { dir: '02-中秋我妈打电话问我回不回来我说看情况', cover: 'cand_4', imgs: ['cand_0', 'cand_2'] },
];

// 查候选图原始 URL（manifest.json 里按文件名反查，供去重登记）
function urlOf(manifest, file) {
  const hit = manifest.find((m) => m.file === file);
  return hit ? hit.url : '';
}

(async () => {
  const lines = [];
  for (const art of ARTICLES) {
    const artDir = path.join(BATCH, art.dir);
    const candDir = path.join(artDir, '候选图');
    const manifest = JSON.parse(fs.readFileSync(path.join(candDir, 'manifest.json'), 'utf8'));
    const parts = [];

    // 封面：裁成微信要求的 900x383（2.35:1），attention 让 sharp 自动保主体
    const coverSrc = path.join(candDir, `${art.cover}.jpg`);
    await sharp(coverSrc).resize(900, 383, { fit: 'cover', position: 'attention' }).jpeg({ quality: 88 }).toFile(path.join(artDir, 'cover.jpg'));
    parts.push(`cover=${urlOf(manifest, `${art.cover}.jpg`)}`);
    console.log(`✅ ${art.dir}/cover.jpg ← ${art.cover}.jpg`);

    // 文中图：原样转标准 JPEG 落成 imgN.jpg
    art.imgs.forEach((c, i) => {
      const n = i + 1;
      const src = path.join(candDir, `${c}.jpg`);
      fs.copyFileSync(src, path.join(artDir, `img${n}.jpg`));
      parts.push(`img${n}=${urlOf(manifest, `${c}.jpg`)}`);
      console.log(`✅ ${art.dir}/img${n}.jpg ← ${c}.jpg`);
    });

    lines.push(`${art.dir}: ${parts.join(', ')}`);
  }
  fs.writeFileSync(path.join(BATCH, 'used_images.txt'), lines.join('\n') + '\n');
  console.log('\n✅ used_images.txt 已登记');
})();
