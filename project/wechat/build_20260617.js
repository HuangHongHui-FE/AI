// build_20260617.js — 将今日4篇文章转为微信HTML + 下载配图 + 生成payload
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'C:/Users/31672/AI/project/wechat/文章包/20260617';

const articles = [
  {
    dir: '01-老婆升职那天我发现自己并不高兴',
    // 主题：男性自尊/婚姻关系/职场与家庭
    cover: 3184418,  // 人物/团队
    images: [2765000, 1181200, 2765010] // 办公/生活/场景
  },
  {
    dir: '02-AI考核员工我成了不合格的那个',
    // 主题：AI管理/职场焦虑/科技
    cover: 4160000,  // 办公/工作
    images: [4160100, 5690000, 2765020] // 办公/通用/电脑
  },
  {
    dir: '03-花了五年终于承认自己不适合这份工作',
    // 主题：职场转型/个人成长/治愈
    cover: 1181244,  // 生活/场景
    images: [1181300, 1181400, 1181500] // 生活/场景
  },
  {
    dir: '04-我们决定不要孩子后的第十年',
    // 主题：丁克/夫妻关系/生活方式
    cover: 3184299,  // 人物/团队
    images: [3184288, 3182765, 5690100] // 人物/家庭/通用
  }
];

// ====== Part 1: Markdown → WeChat HTML ======
function mdToWechatHTML(md) {
  const titleMatch = md.match(/## 文章 \d+：(.+)/);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const bodyMatch = md.match(/### 正文\n\n([\s\S]*?)\n\n### 备选标题/);
  let body = bodyMatch ? bodyMatch[1].trim() : '';

  let digest = body
    .replace(/\*\*/g, '')
    .replace(/[\n\r]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 54);

  const lines = body.split('\n');
  const paragraphs = [];
  let sectionOpen = true;
  let imgIdx = 0;

  function openSection() {
    if (!sectionOpen) {
      paragraphs.push('<section style="padding: 0 16px; font-size: 15px; color: #3f3f3f; letter-spacing: 0.5px; line-height: 1.75;">');
      sectionOpen = true;
    }
  }

  function closeSection() {
    if (sectionOpen) {
      paragraphs.push('</section>');
      sectionOpen = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (!line.trim()) {
      continue; // skip empty lines (we use margin-bottom instead)
    }

    // Check for image placeholder (*** separator)
    if (line.trim() === '***') {
      closeSection();
      paragraphs.push(`<p style="text-align: center; margin: 1.5em 0;"><img src="{{IMG${imgIdx}}}" style="max-width: 100%;" /></p>`);
      imgIdx++;
      continue;
    }

    openSection();

    let content = line.trim();
    // Bold
    content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    paragraphs.push(`<p style="margin-bottom: 1em;">${content}</p>`);
  }

  // Close any remaining section
  closeSection();

  const html = paragraphs.join('');

  return { title, digest, html, imgCount: imgIdx };
}

// ====== Part 2: Image download ======
function downloadPexels(id, filepath, width = 900) {
  return new Promise((resolve) => {
    const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
    const go = (u) => {
      https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          go(res.headers.location);
          return;
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const data = Buffer.concat(chunks);
          if (data.length > 1000) {
            fs.writeFileSync(filepath, data);
            resolve({ ok: true, id, size: data.length });
          } else {
            resolve({ ok: false, id });
          }
        });
      }).on('error', () => resolve({ ok: false, id }));
    };
    go(url);
  });
}

// ====== Main ======
async function main() {
  // Step 1: Generate HTML payloads from markdown
  console.log('=== Step 1: 生成 HTML payloads ===\n');
  for (const art of articles) {
    const dir = path.join(BASE, art.dir);
    const mdPath = path.join(dir, '文章.md');
    if (!fs.existsSync(mdPath)) {
      console.log(`❌ 找不到 ${mdPath}`);
      continue;
    }
    const md = fs.readFileSync(mdPath, 'utf8');
    const { title, digest, html, imgCount } = mdToWechatHTML(md);
    const payload = JSON.stringify({
      articles: [{
        title: title,
        author: "",
        digest: digest,
        content: html,
        content_source_url: "",
        thumb_media_id: "{{THUMB}}",
        need_open_comment: 1,
        only_fans_can_comment: 0
      }]
    }, null, 2);

    const outPath = path.join(dir, 'payload_template.json');
    fs.writeFileSync(outPath, payload, 'utf8');
    console.log(`✅ ${art.dir} (${imgCount} 配图占位)`);
  }

  // Step 2: Test and download images
  console.log('\n=== Step 2: 下载配图 ===\n');

  // Collect all photo IDs
  const allIds = new Set();
  articles.forEach(a => {
    allIds.add(a.cover);
    a.images.forEach(id => allIds.add(id));
  });
  console.log(`测试 ${allIds.size} 个 Pexels photo ID...\n`);

  // Test each ID
  const working = new Set();
  for (const id of allIds) {
    const tmp = path.join(BASE, `_test_${id}.jpg`);
    const r = await downloadPexels(id, tmp, 100);
    if (r.ok) {
      working.add(id);
      console.log(`  ✅ ${id} (${(r.size/1024).toFixed(0)}KB)`);
      try { fs.unlinkSync(tmp); } catch(e) {}
    } else {
      console.log(`  ❌ ${id} 不可用，搜索附近ID...`);
      let found = false;
      for (let offset = 1; offset <= 50 && !found; offset++) {
        const newId = id + offset;
        const r2 = await downloadPexels(newId, tmp, 100);
        if (r2.ok) {
          working.add(newId);
          console.log(`     → ✅ ${newId} 替代`);
          try { fs.unlinkSync(tmp); } catch(e) {}
          found = true;
        }
        try { fs.unlinkSync(tmp); } catch(e) {}
      }
      if (!found) {
        const newId2 = id - 1;
        const r3 = await downloadPexels(newId2, tmp, 100);
        if (r3.ok) {
          working.add(newId2);
          console.log(`     → ✅ ${newId2} 替代`);
          try { fs.unlinkSync(tmp); } catch(e) {}
        }
      }
    }
  }

  console.log(`\n可用: ${working.size} 个\n`);

  // Download images for each article
  const available = [...working];
  let usedIdx = 0;

  for (const art of articles) {
    const dir = path.join(BASE, art.dir);
    console.log(`📥 ${art.dir}`);

    // Cover
    let coverId = working.has(art.cover) ? art.cover : available[usedIdx++ % available.length];
    const coverPath = path.join(dir, 'cover.jpg');
    const cr = await downloadPexels(coverId, coverPath, 900);
    console.log(`  cover.jpg → ID:${coverId} ${cr.ok ? '✅' : '❌'}`);

    // Inline images
    for (let i = 0; i < art.images.length; i++) {
      const imgId = available[(usedIdx++) % available.length];
      const imgPath = path.join(dir, `img${i+1}.jpg`);
      const ir = await downloadPexels(imgId, imgPath, 900);
      console.log(`  img${i+1}.jpg → ID:${imgId} ${ir.ok ? '✅' : '❌'}`);
    }
  }

  // Save used_images.txt
  const log = articles.map(a => {
    return `${a.dir}: cover=${a.cover}`;
  }).join('\n');
  fs.writeFileSync(path.join(BASE, 'used_images.txt'), log + '\n');
  console.log('\n✅ 全部完成！');
}

main().catch(console.error);