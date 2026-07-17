// build_20260615.js — 下载配图 + 构建HTML + 生成payload_template.json
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'C:/Users/31672/AI/project/wechat/文章包/20260615';

// Skill 04 配色方案C — 情感故事风
const COLORS = {
  body: '#4a4a4a',
  title: '#be185d',
  accent: '#9d174d',
  caption: '#888888',
  muted: '#999999',
};

// Pexels 下载函数
function downloadPexels(photoId, filepath, width = 900) {
  return new Promise((resolve) => {
    const url = `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
          const chunks = [];
          res2.on('data', c => chunks.push(c));
          res2.on('end', () => {
            const data = Buffer.concat(chunks);
            if (data.length > 1000) { fs.writeFileSync(filepath, data); resolve({ id: photoId, size: data.length }); }
            else resolve(null);
          });
        }).on('error', () => resolve(null));
      } else {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const data = Buffer.concat(chunks);
          if (data.length > 1000) { fs.writeFileSync(filepath, data); resolve({ id: photoId, size: data.length }); }
          else resolve(null);
        });
      }
    }).on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}

// 测试一批ID
async function testIds(ids) {
  const working = new Set();
  for (const id of ids) {
    const tmpPath = path.join(BASE, `_test_${id}.jpg`);
    const r = await downloadPexels(id, tmpPath, 100);
    if (r && r.size > 1000) {
      working.add(id);
      console.log(`  ✅ ${id} (${(r.size/1024).toFixed(0)}KB)`);
      try { fs.unlinkSync(tmpPath); } catch(e) {}
    } else {
      console.log(`  ❌ ${id}`);
    }
  }
  return working;
}

// 文章配置
const articles = [
  {
    dir: '01-发现老公深夜和AI聊天',
    title: '发现老公深夜和AI聊天后，我问了自己三个问题',
    digest: '凌晨两点，老公不在床上。客厅传来打字声和笑声——他在跟AI聊天。那些话，他从没跟我说过。',
    imageMarkers: [
      '凌晨两点，我被客厅传来的打字声吵醒了。',
      '那些话，他从来没跟我说过。',
      '我们都在做同样的事。',
    ]
  },
  {
    dir: '02-同学聚会后老婆开始化妆',
    title: '参加完同学聚会，我老婆开始每天化妆了',
    digest: '结婚十二年她化妆的次数我数得过来。但同学聚会回来后，她变了。我以为是有情况，其实是醒了。',
    imageMarkers: [
      '她在镜子前站了很久。',
      '聚会回来，她开始每天提前半小时起床化妆。',
      '她开始穿有颜色的了。',
    ]
  },
  {
    dir: '03-关掉朋友圈一个月',
    title: '关掉朋友圈一个月后，我的焦虑症自己好了',
    digest: '不看别人晒什么之后，参照物全部消失了。我不知道谁升职了、谁旅游了、谁又瘦了——但我的焦虑症自己好了。',
    imageMarkers: [
      '说干就干。我关掉了朋友圈入口。',
      '第7天发现了一个秘密——没有朋友圈的世界很安静。',
      '今天是第30天。我坐在阳台上。',
    ]
  },
  {
    dir: '04-部门来了00后领导',
    title: '部门新来的领导是00后，我比他大九岁',
    digest: '他叫我"张哥"的那一刻，我就知道这会是一段艰难的关系。三个月后，我主动叫他"老板"了。',
    imageMarkers: [
      '他站在我面前，比我高半个头，但看起来还是像实习生。',
      '他打开一个AI工具。对着电脑说了几分钟话。',
      '办公室只剩我和他两个人。',
    ]
  },
];

async function main() {
  // Step 1: 测试可用 photo ID
  console.log('🔍 Step 1: 测试 Pexels photo ID...\n');

  // 使用已验证池 + 扩展测试
  const candidateIds = [
    // 已验证池 (from Skill 05)
    3184418, 3184419, 3184420, 3184299, 3184288, 3184300, 3184310, 3182765,
    2765000, 2765010, 2765020,
    4160000, 4160100, 4160200,
    1181200, 1181244, 1181300, 1181400, 1181500,
    5690000, 5690100,
    4259139, 4259140, 4259150,
    3807743, 3807750, 3807760,
    // 扩展测试
    3184305, 3184315, 3184320, 3184330,
    2765030, 2765040, 2765050,
    4160300, 4160400, 4160500,
    5690200, 5690300, 5690400,
    1181600, 1181700, 1181800, 1181900,
    4259160, 4259170, 4259180, 4259190,
  ];

  const workingIds = await testIds([...new Set(candidateIds)]);
  console.log(`\n📸 找到 ${workingIds.size} 个可用图片\n`);

  if (workingIds.size < 12) {
    // 尝试更多范围
    console.log('⚠️  可用图片不足，扩展搜索...');
    for (const start of [3184330, 2765050, 4160500, 5690400, 1181900, 4259190]) {
      const batch = [];
      for (let i = 0; i < 50; i++) batch.push(start + i);
      const more = await testIds(batch);
      more.forEach(id => workingIds.add(id));
      console.log(`  范围 ${start}: +${more.size} 个`);
      if (workingIds.size >= 20) break;
    }
  }

  console.log(`\n📸 总计可用: ${workingIds.size} 个\n`);

  // Step 2: 下载图片
  console.log('📥 Step 2: 下载配图...\n');
  const availablePool = [...workingIds];
  const usedLog = [];

  for (const art of articles) {
    const artDir = path.join(BASE, art.dir);
    console.log(`\n📁 ${art.dir}`);

    const used = [];

    // 下载封面 (900px宽)
    const coverId = availablePool.shift();
    const coverPath = path.join(artDir, 'cover.jpg');
    const coverR = await downloadPexels(coverId, coverPath, 900);
    if (coverR) {
      used.push(`cover:${coverId}`);
      console.log(`  ✅ cover.jpg (ID:${coverId}, ${(coverR.size/1024).toFixed(0)}KB)`);
    } else {
      console.log(`  ❌ cover.jpg 下载失败`);
    }

    // 下载文中配图 (每个article有3个imageMarkers)
    for (let i = 0; i < art.imageMarkers.length; i++) {
      const imgId = availablePool.shift();
      const imgPath = path.join(artDir, `img${i+1}.jpg`);
      const imgR = await downloadPexels(imgId, imgPath, 900);
      if (imgR) {
        used.push(`img${i+1}:${imgId}`);
        console.log(`  ✅ img${i+1}.jpg (ID:${imgId}, ${(imgR.size/1024).toFixed(0)}KB)`);
      } else {
        console.log(`  ❌ img${i+1}.jpg 下载失败，尝试备用...`);
        const fallbackId = availablePool[0];
        const fbR = await downloadPexels(fallbackId, imgPath, 900);
        if (fbR) {
          availablePool.shift();
          used.push(`img${i+1}:${fallbackId}`);
          console.log(`  ✅ img${i+1}.jpg (备用ID:${fallbackId})`);
        }
      }
    }

    usedLog.push(`${art.dir}: ${used.join(', ')}`);
  }

  // 保存 used_images.txt
  fs.writeFileSync(path.join(BASE, 'used_images.txt'), usedLog.join('\n'));
  console.log('\n✅ used_images.txt 已保存\n');

  // Step 3: 构建 HTML 和 payload
  console.log('📄 Step 3: 构建 HTML & payload...\n');

  const TOP_GUIDE = `
<table style="width:100%;margin-bottom:20px;">
  <tr><td style="text-align:center;padding:16px 0;">
    <p style="font-size:13px;color:#999999;letter-spacing:2px;margin:0;">—— 点击上方蓝字关注，每天一起聊聊生活 ——</p>
  </td></tr>
</table>
`;

  for (const art of articles) {
    const mdPath = path.join(BASE, art.dir, '文章.md');
    if (!fs.existsSync(mdPath)) {
      console.log(`❌ 找不到 ${mdPath}`);
      continue;
    }

    const md = fs.readFileSync(mdPath, 'utf8');

    // 解析markdown为段落
    const lines = md.split('\n');
    const paragraphs = [];
    let inBody = false;
    let current = [];

    for (const line of lines) {
      if (!inBody) {
        if (line.startsWith('### 正文')) { inBody = true; continue; }
        continue;
      }
      // 遇到备选标题就停止
      if (line.startsWith('### 备选标题')) break;
      // 遇到 --- 也停止
      if (line.trim() === '---') break;
      if (line.trim() === '') {
        if (current.length > 0) { paragraphs.push(current.join('')); current = []; }
        continue;
      }
      current.push(line);
    }
    if (current.length > 0) paragraphs.push(current.join(''));

    // 构建 body HTML
    let bodyHTML = '';
    let imgIdx = 0;

    for (const para of paragraphs) {
      let text = para.trim();
      if (!text) continue;

      // 分隔线
      if (/^\*{3,}$/.test(text) || /^[\*\-—]{3,}$/.test(text)) {
        bodyHTML += '<p style="text-align:center;color:#cccccc;font-size:14px;letter-spacing:4px;margin:1.2em 0;">· · ·</p>\n';
        continue;
      }

      // 粗体 → accent color
      text = text.replace(/\*\*(.+?)\*\*/g, `<span style="color:${COLORS.accent};font-weight:bold;">$1</span>`);

      bodyHTML += `<p style="margin-bottom:1em;">${text}</p>\n`;

      // 插图逻辑：在匹配的marker段落后插入图片
      for (let m = 0; m < art.imageMarkers.length; m++) {
        if (text.includes(art.imageMarkers[m]) && imgIdx === m) {
          bodyHTML += `<p style="text-align:center;margin:1.2em 0 0.2em 0;"><img src="{{IMG${imgIdx}}}" style="width:100%;display:block;border-radius:4px;" /></p>\n`;
          bodyHTML += `<p style="font-size:13px;color:${COLORS.caption};text-align:center;margin:0.3em 0 1.2em 0;">△ 图片来源于网络</p>\n`;
          imgIdx++;
          break;
        }
      }
    }

    // 互动引导 (从文章提取)
    const interactionMatch = md.match(/\*([^*]+?(?:在看|关注|转发)[^*]+?)\*/);
    const interactionLine = interactionMatch ? interactionMatch[1].trim() : '如果这篇文章触动了你，点个「在看」吧。';

    const bottomHTML = `
<table style="width:100%;margin-top:32px;">
  <tr><td style="text-align:center;padding:24px 0;">
    <p style="font-size:14px;color:#9d174d;line-height:2;margin:0 0 16px 0;">${interactionLine}</p>
    <p style="font-size:13px;color:#999999;margin:0 0 24px 0;">👇 点击下方卡片关注，不错过每天的故事</p>
    <p style="font-size:12px;color:#bbbbbb;margin:0;">#情感故事 #职场成长 #生活感悟</p>
  </td></tr>
</table>
`;

    const fullHTML =
`<style>
  .article-body { font-size: 15px; line-height: 1.75; letter-spacing: 0.5px; color: ${COLORS.body}; padding: 0 16px; text-align: justify; word-break: break-all; }
  .article-body p { margin: 0; }
</style>
${TOP_GUIDE}
<section class="article-body">
<h2 style="font-size:20px;font-weight:bold;color:#333333;text-align:center;margin:0 0 1.2em 0;line-height:1.4;">${art.title}</h2>
${bodyHTML}
</section>
${bottomHTML}`;

    const payload = {
      articles: [{
        title: art.title,
        author: '',
        digest: art.digest.substring(0, 64),
        content: fullHTML,
        content_source_url: '',
        thumb_media_id: '{{THUMB}}',
        need_open_comment: 1,
        only_fans_can_comment: 0
      }]
    };

    const jsonPath = path.join(BASE, art.dir, 'payload_template.json');
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`✅ ${art.dir}/payload_template.json`);
  }

  console.log('\n🎉 全部完成！');
  console.log(`   输出目录: ${BASE}`);
}

main().catch(console.error);