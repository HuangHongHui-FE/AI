const fs = require('fs');
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');

const ACCESS_TOKEN = '107_NRjsykXSudfZ3CyQdFI55L7R9ux54JsMYAPUgkUyqX-z5ig6hI6IFVC1ivHEPkYV8ovkGNZ5EstAsdYy_IWWiX7i-iu-tu4Lp9gn93xtbXIYEOx2oz7LmFTalq8JEPfAGARMX';

// 支持 --draft <file> 指定草稿 JSON，--dir <dir> 指定正文图目录（默认项目根目录）
const args = process.argv.slice(2);
const draftIdx = args.indexOf('--draft');
const DRAFT_JSON = draftIdx !== -1 && args[draftIdx + 1] ? args[draftIdx + 1] : '贴图草稿-20250708.json';
const dirIdx = args.indexOf('--dir');
const IMG_DIR = dirIdx !== -1 && args[dirIdx + 1] ? args[dirIdx + 1] : '.';

// 读取贴图草稿配置
const draft = JSON.parse(fs.readFileSync(DRAFT_JSON, 'utf8'));

// 列目录内图片文件（排除 manifest/隐藏文件），按文件名自然排序
function listImages(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png)$/i.test(f) && !f.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, 'zh', { numeric: true }));
}

// 上传本地图片到微信永久素材库，返回 media_id
function uploadImage(filePath) {
  const cmd = `curl -s -F "media=@${filePath};type=image/jpeg" "https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${ACCESS_TOKEN}&type=image"`;
  const res = JSON.parse(execSync(cmd, { encoding: 'utf8' }));
  if (!res.media_id) throw new Error(`上传失败: ${JSON.stringify(res)}`);
  console.log(`uploaded ${filePath} -> ${res.media_id}`);
  return res.media_id;
}

// 发起 HTTPS POST 请求并解析 JSON 响应
function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'api.weixin.qq.com',
        port: 443,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve(JSON.parse(body)));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // 上传封面为永久素材（cover.placeholder 可为完整路径或相对 --dir 的文件名）
  const coverPath = draft.cover.placeholder.includes('/')
    ? draft.cover.placeholder
    : path.join(IMG_DIR, draft.cover.placeholder);
  const thumbMediaId = uploadImage(coverPath);

  // 正文图：从 --dir 目录按文件名排序取前 images.length 张（用户删图后剩下的）
  const imgFiles = listImages(IMG_DIR);
  if (imgFiles.length < draft.images.length) {
    throw new Error(`正文图不足: 需要 ${draft.images.length} 张，目录只有 ${imgFiles.length} 张`);
  }
  const imageList = [];
  for (let i = 0; i < draft.images.length; i++) {
    imageList.push({ image_media_id: uploadImage(path.join(IMG_DIR, imgFiles[i])) });
  }

  // 拼接贴图纯文本 content：优先用 body（整篇一段讲透主题，不逐图），兼容旧逐图草稿
  let content;
  if (draft.body) {
    // 新规范：文本只讲共同主题，不逐图配文
    content = draft.body;
  } else {
    const parts = [draft.summary];
    draft.images.forEach((item, idx) => {
      parts.push(`${idx + 1}. ${item.caption}\n${item.text}`);
    });
    parts.push(draft.ending);
    content = parts.join('\n\n');
  }

  const payload = {
    articles: [
      {
        article_type: 'newspic', // 图片消息（贴图/小绿书）
        title: draft.title,
        author: '',
        digest: draft.summary,
        content,
        content_source_url: '',
        thumb_media_id: thumbMediaId,
        show_cover_pic: 0,
        need_open_comment: 1,
        only_fans_can_comment: 0,
        image_info: { image_list: imageList },
      },
    ],
  };

  const res = await postJson(`/cgi-bin/draft/add?access_token=${ACCESS_TOKEN}`, payload);
  console.log(JSON.stringify(res, null, 2));
  fs.writeFileSync('draft_response.json', JSON.stringify(res, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
