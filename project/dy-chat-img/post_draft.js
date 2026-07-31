const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const ACCESS_TOKEN = '106_b5r2wLoySmjyvTB8fDeFfXr8iGhatUAGBdh8DU-XHaGasVasZRhy7qicgRdnjiOQEfUOI1drbfB6pqF2_LabGQotiKMui-8Qf4IR3EAHMdC2BC-2F-_LU0iAw6MDFYgAFANPI';

// 支持 --draft <file> 指定草稿 JSON，默认用示例文件
const args = process.argv.slice(2);
const draftIdx = args.indexOf('--draft');
const DRAFT_JSON = draftIdx !== -1 && args[draftIdx + 1] ? args[draftIdx + 1] : '贴图草稿-20250708.json';

// 读取贴图草稿配置
const draft = JSON.parse(fs.readFileSync(DRAFT_JSON, 'utf8'));

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
  // 上传封面和正文图片为永久素材
  const thumbMediaId = uploadImage(draft.cover.placeholder);
  const imageList = [];
  for (let i = 1; i <= draft.images.length; i++) {
    imageList.push({ image_media_id: uploadImage(`img${i}.jpg`) });
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
