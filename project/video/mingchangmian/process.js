const { spawnSync } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');

const inputFile = '018-高三八班、全体起立.mp4';
const outputFile = '018-动态字幕导演版.mp4';
const assFile = 'subtitles.ass';
const VIDEO_W = 1922;
const VIDEO_H = 1080;

function t(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

// ==================== 风格实现函数 ====================
// 每个函数返回 ASS Dialogue 行数组

function styleA_Danmaku(sub, i) {
  // 🟩 弹幕风：右飞入急停→短暂停留→右甩出
  const y = 220 + (i % 2) * 60; // 中上部，交替错开
  const midX = Math.round(VIDEO_W * 0.4);
  const flyInMs = 350;
  const dur = sub.end - sub.start;
  // 用两行模拟：第一行飞入+停留，第二行甩出
  // 实际上 \move 停留后可以用 \fad 快速消失
  const lines = [];
  lines.push(
    `Dialogue: 0,${t(sub.start)},${t(sub.end)},Danmaku,,0,0,0,,`,
    `{\\an5\\pos(${midX},${y})`,
    `\\move(${VIDEO_W + 200},${y},${midX},${y},0,${flyInMs})`,
    `\\fad(100,250)`,
    `}${sub.text}`
  );
  return [lines.join('')];
}

function styleB_Variety(sub, i) {
  // 🟧 综艺花字风：逐字弹入
  const chars = sub.text.replace(/[！？。，·、\s]/g, '').split('');
  const baseY = 350 + (i % 3) * 70;
  const totalChars = chars.length;
  const staggerMs = 60; // 每个字间隔 60ms
  const lines = [];

  chars.forEach((ch, ci) => {
    const charStart = sub.start + (ci * staggerMs) / 1000;
    const charEnd = sub.end;
    // 计算x位置，让文字整体居中
    const totalWidthEstimate = totalChars * 70;
    const startX = Math.round(VIDEO_W / 2 - totalWidthEstimate / 2 + ci * 70);

    const colors = ['&H0047D4FF&', '&H001FA2FF&', '&H000EAAFF&']; // 粉-橙-黄
    const col = colors[ci % 3];

    lines.push(
      `Dialogue: 0,${t(charStart)},${t(charEnd)},Variety,,0,0,0,,`,
      `{\\an5\\pos(${startX},${baseY})`,
      `\\fad(80,300)\\fs76\\b1`,
      `\\1c${col}\\3c&H00FFFFFF&\\bord4\\4c&H00000000&\\shad3`,
      `}${ch}`
    );
  });

  return lines;
}

function styleC_InnerOS(sub, i) {
  // 🟦 内心OS：纤细斜体、小字、飘移
  const x = i % 2 === 0 ? 180 : VIDEO_W - 180;
  const startY = 120 + (i % 3) * 50;
  const endY = startY - 40;
  const dur = sub.end - sub.start;
  const driftStartMs = 400;
  const driftEndMs = Math.round(dur * 1000);

  const lines = [];
  lines.push(
    `Dialogue: 0,${t(sub.start)},${t(sub.end)},InnerOS,,0,0,0,,`,
    `{\\an5\\pos(${x},${startY})`,
    `\\move(${x},${startY},${x},${endY},${driftStartMs},${driftEndMs})`,
    `\\fad(600,800)\\fs26`,
    `\\1c&H66FFFFFF&\\3c&H00000000&\\bord0\\shad0`,
    `}${sub.text}`
  );
  return [lines.join('')];
}

function styleD_Glitch(sub, i) {
  // 🟪 故障风：白字+洋红偏移副本 → 模拟色散
  const cx = Math.round(VIDEO_W / 2);
  const y = 580 + (i % 2) * 50;
  const dur = sub.end - sub.start;
  const lines = [];

  // 黑底条（不规则感用圆角模拟不了，用宽描边替代）
  lines.push(
    `Dialogue: 0,${t(sub.start)},${t(sub.end - 0.05)},GlitchBG,,0,0,0,,`,
    `{\\an5\\pos(${cx},${y})`,
    `\\fad(50,100)\\fs64\\b1`,
    `\\1c&HFFFFFF&\\3c&H00000000&\\bord0`,
    `}${sub.text}`
  );
  // 洋红色散副本，向右偏移 4px
  lines.push(
    `Dialogue: 0,${t(sub.start + 0.03)},${t(sub.end - 0.03)},Glitch,,0,0,0,,`,
    `{\\an5\\pos(${cx + 3},${y})`,
    `\\fad(30,80)\\fs64\\b1`,
    `\\1c&HCC55CC&\\3c&H00000000&\\bord0\\alpha&H88&`,
    `}${sub.text}`
  );
  // 青色偏移副本，向左 3px
  lines.push(
    `Dialogue: 0,${t(sub.start + 0.06)},${t(sub.end)},Glitch,,0,0,0,,`,
    `{\\an5\\pos(${cx - 2},${y + 1})`,
    `\\fad(30,100)\\fs64\\b1`,
    `\\1c&HFF8844&\\3c&H00000000&\\bord0\\alpha&H99&`,
    `}${sub.text}`
  );

  return lines;
}

function styleE_Roar(sub, i) {
  // 🟥 咆哮风：巨大、震动、血红
  const cx = Math.round(VIDEO_W / 2);
  const y = 420;
  const dur = sub.end - sub.start;

  // 震动效果：用多个微小偏移的副本快速交替
  const shakes = [
    { dx: 0, dy: 0, t: 0 },
    { dx: 6, dy: -4, t: 0.06 },
    { dx: -4, dy: 3, t: 0.12 },
    { dx: 3, dy: -2, t: 0.18 },
  ];

  const lines = [];
  shakes.forEach((shake) => {
    const st = sub.start + shake.t;
    const et = Math.min(st + 0.2, sub.end);
    lines.push(
      `Dialogue: 0,${t(st)},${t(et)},Roar,,0,0,0,,`,
      `{\\an5\\pos(${cx + shake.dx},${y + shake.dy})`,
      `\\fad(30,150)\\fs112\\b1`,
      `\\1c&H003333FF&\\3c&H00000000&\\bord5\\4c&H00000000&\\shad4`,
      `}${sub.text}`
    );
  });
  // 主字幕（最大最清楚）
  lines.push(
    `Dialogue: 0,${t(sub.start + 0.02)},${t(sub.end)},Roar,,0,0,0,,`,
    `{\\an5\\pos(${cx},${y})`,
    `\\fad(80,200)\\fs112\\b1`,
    `\\1c&H003535FF&\\3c&H00FFFFFF&\\bord6\\4c&H00000000&\\shad5`,
    `}${sub.text}`
  );

  return lines;
}

function styleF_Literary(sub, i) {
  // 🟨 文艺风：极细衬线、香槟金、墨迹晕开
  const cx = Math.round(VIDEO_W / 2);
  const xOffset = i % 2 === 0 ? -80 : 80; // 左右微偏
  const y = 700 + (i % 3) * 20;

  const lines = [];
  lines.push(
    `Dialogue: 0,${t(sub.start)},${t(sub.end)},Literary,,0,0,0,,`,
    `{\\an5\\pos(${cx + xOffset},${y})`,
    `\\fad(1200,1500)\\fs32`,
    `\\1c&H00E7F0F5&\\3c&H00000000&\\bord0\\shad0`,
    `\\fnNotoSerif SC`,
    `}${sub.text}`
  );
  return [lines.join('')];
}

// ==================== 字幕数据 ====================
const segments = [
  { start:0.0,  end:2.5,  style:'E', text:'全！体！起！立！' },
  { start:2.5,  end:6.0,  style:'C', text:'这一秒·封神了' },
  { start:6.0,  end:9.0,  style:'A', text:'事情要从这里说起' },
  { start:9.0,  end:13.0, style:'C', text:'老师·已读不回' },
  { start:13.0, end:17.0, style:'A', text:'高三八班·全员戏精' },
  { start:17.0, end:21.0, style:'C', text:'这表情·我熟' },
  { start:21.0, end:25.0, style:'D', text:'名场面预警#@%' },
  { start:25.0, end:30.0, style:'F', text:'青春一场·三连关注' },
];

// ==================== 生成 ASS ====================
console.log('生成 ASS 字幕...');
let events = '';

const styleFns = { A: styleA_Danmaku, B: styleB_Variety, C: styleC_InnerOS, D: styleD_Glitch, E: styleE_Roar, F: styleF_Literary };

segments.forEach((sub, i) => {
  const lines = styleFns[sub.style](sub, i);
  events += lines.join('\n') + '\n';
});

const assContent = `[Script Info]
Title: 动态字幕导演版
ScriptType: v4.00+
PlayResX: ${VIDEO_W}
PlayResY: ${VIDEO_H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Danmaku,SimHei,44,&H0000D7FF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,1,2,2,10,10,10,1
Style: Variety,SimHei,76,&H0047D4FF,&H000000FF,&H00FFFFFF,&H00000000,-1,0,0,0,100,100,0,0,1,4,3,2,10,10,10,1
Style: InnerOS,KaiTi,26,&H66FFFFFF,&H000000FF,&H00000000,&H00000000,0,-1,0,0,100,100,0,0,1,0,0,2,10,10,10,1
Style: Glitch,SimHei,64,&HFFFFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,2,10,10,10,1
Style: GlitchBG,SimHei,64,&HFFFFFFFF,&H000000FF,&H00000000,&H66000000,-1,0,0,0,100,100,0,0,3,0,0,2,10,10,10,1
Style: Roar,SimHei,112,&H003535FF,&H000000FF,&H00FFFFFF,&H00000000,-1,0,0,0,100,100,0,0,1,6,5,2,10,10,10,1
Style: Literary,NotoSerifSC-VF,32,&H00E7F0F5,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}`;

fs.writeFileSync(assFile, assContent, 'utf8');
const totalLines = events.split('\n').filter(l => l.trim()).length;
console.log(`ASS 生成完成: ${segments.length} 段字幕, ${totalLines} 行事件\n`);

// ==================== 合成视频 ====================
// 视频级特效：爆点(原素材 64-69s) 1.2x 慢放开头 + 铺垫段(原素材 0-24s) + 闪白过渡 + 1080p 放大
console.log('合成视频...\n');

const SLOWMO = 1.2; // 爆点慢放倍数
const filterComplex = [
  // 段1: 爆点（原素材 64-69s 共 5s），1.2x 慢放 → 6s
  `[0:v]trim=64:69,setpts=(PTS-STARTPTS)*${SLOWMO},scale=1920:1080:flags=lanczos[v1]`,
  // 段2: 铺垫+高潮+收尾（原素材 0-24s 共 24s）
  `[0:v]trim=0:24,setpts=PTS-STARTPTS,scale=1920:1080:flags=lanczos[v2]`,
  // 音频同步慢放
  `[0:a]atrim=64:69,asetpts=PTS-STARTPTS,atempo=${(1/SLOWMO).toFixed(4)}[a1]`,
  `[0:a]atrim=0:24,asetpts=PTS-STARTPTS[a2]`,
  // 拼接两段
  `[v1][v2]concat=n=2:v=1[vcat]`,
  `[a1][a2]concat=n=2:v=0:a=1[acat]`,
  // 烧录字幕 + 段间闪白过渡（在 5.85s 段切换处）
  `[vcat]ass=${assFile},fade=t=out:st=5.85:d=0.1:color=white,fade=t=in:st=5.95:d=0.15:color=white[v]`
].join(';');

const args = [
  '-i', inputFile,
  '-filter_complex', filterComplex,
  '-map', '[v]',
  '-map', '[acat]',
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-crf', '23',
  '-preset', 'medium',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-movflags', '+faststart',
  '-y',
  outputFile,
];

const result = spawnSync(ffmpegPath, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
if (result.error) { console.error('Error:', result.error.message); process.exit(1); }
const dl = result.stderr.match(/Duration: (\d+:\d+:\d+\.\d+)/);
if (dl) console.log('视频时长:', dl[1]);
if (result.status === 0) {
  console.log(`\n完成! ${outputFile}`);
  console.log(`大小: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(1)} MB`);
} else {
  console.error(`失败 (exit ${result.status})`);
  console.error(result.stderr.slice(-500));
}