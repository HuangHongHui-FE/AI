// publish.js — 一键发布公众号文章
// 用法: node publish.js <文章目录路径>
// 示例: node publish.js C:/Users/31672/AI/project/wechat/文章包/20260609/01-xxx
//
// 文章目录需包含:
//   - payload_template.json  (用 {{THUMB}} {{IMG0}} {{IMG1}} ... 占位)
//   - cover.jpg              (封面图)
//   - img1.jpg, img2.jpg...  (文中配图，数量与模板中的占位符一致)
//
// 模板示例:
// {
//   "articles": [{
//     "title": "标题",
//     "author": "",
//     "digest": "摘要64字以内",
//     "content": "...<img src=\"{{IMG0}}\"...",
//     "content_source_url": "",
//     "thumb_media_id": "{{THUMB}}",
//     "need_open_comment": 1,
//     "only_fans_can_comment": 0
//   }]
// }

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const articleDir = process.argv[2];
if (!articleDir) {
  console.log('用法: node publish.js <文章目录路径>');
  process.exit(1);
}

console.log('📦 文章目录:', articleDir);

// 1. 读取凭证
const envPath = path.join(__dirname, '.env');
const env = fs.readFileSync(envPath, 'utf8');
const appid = env.match(/WECHAT_APPID=(.+)/)[1];
const secret = env.match(/WECHAT_APPSECRET=(.+)/)[1];

// 2. 获取 access_token
console.log('[1/4] 获取 access_token...');
const tokenRes = JSON.parse(execSync(
  `curl -s "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}"`,
  { encoding: 'utf8' }
));
const TOKEN = tokenRes.access_token;
if (!TOKEN) {
  console.log('❌ 获取 token 失败:', JSON.stringify(tokenRes));
  process.exit(1);
}
console.log('  ✅', TOKEN.substring(0, 20) + '...');

// 3. 上传图片
console.log('[2/4] 上传图片...');

// 上传封面（永久素材）
const coverPath = path.join(articleDir, 'cover.jpg');
if (!fs.existsSync(coverPath)) {
  console.log('❌ 缺少 cover.jpg');
  process.exit(1);
}
const coverRes = JSON.parse(execSync(
  `curl -s -F "media=@${coverPath}" "https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${TOKEN}&type=image"`,
  { encoding: 'utf8' }
));
const thumb_media_id = coverRes.media_id;
console.log('  封面:', thumb_media_id);

// 上传文中配图
const imgUrls = [];
let i = 1;
while (fs.existsSync(path.join(articleDir, `img${i}.jpg`))) {
  const imgPath = path.join(articleDir, `img${i}.jpg`);
  const imgRes = JSON.parse(execSync(
    `curl -s -F "media=@${imgPath}" "https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${TOKEN}"`,
    { encoding: 'utf8' }
  ));
  imgUrls.push(imgRes.url);
  console.log(`  配图${i}:`, imgRes.url.substring(0, 55) + '...');
  i++;
}

// 4. 读取模板，替换占位符，创建草稿
console.log('[3/4] 构建草稿...');
const templatePath = path.join(articleDir, 'payload_template.json');
if (!fs.existsSync(templatePath)) {
  console.log('❌ 缺少 payload_template.json');
  process.exit(1);
}

let payload = fs.readFileSync(templatePath, 'utf8');
payload = payload.replace(/\{\{THUMB\}\}/g, thumb_media_id);
imgUrls.forEach((url, idx) => {
  payload = payload.replace(new RegExp(`\\{\\{IMG${idx}\\}\\}`, 'g'), url);
});

// 5. 创建草稿
console.log('[4/4] 创建草稿...');
const payloadPath = path.join(articleDir, 'payload.json');
fs.writeFileSync(payloadPath, payload);

const result = JSON.parse(execSync(
  `curl -s -X POST "https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${TOKEN}" -H "Content-Type: application/json; charset=utf-8" -d @${payloadPath}`,
  { encoding: 'utf8' }
));

if (result.media_id) {
  console.log('\n✅ 草稿创建成功！');
  console.log('草稿ID:', result.media_id);
  console.log('请在订阅号助手 App → 草稿箱 → 预览 → 发布');
  // 更新模板，写入真实 URL 供后续查阅
  fs.writeFileSync(payloadPath, payload);
} else {
  console.log('\n❌ 创建失败:', JSON.stringify(result, null, 2));
  process.exit(1);
}