// 从 copywriting.md 生成竖屏 1080x1920 纯文字动效视频 output.mp4
// 用法: node build-video.js

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
const FFMPEG = ffmpegPath.path;

const W = 1080;
const H = 1920;
const FPS = 30;
const FONT = 'Microsoft YaHei';
const BG = '0x0F1626';      // 深藏蓝
const ACCENT = '0x0E2A4F';  // 略浅蓝（用作底纹）

// ==================== 1. 解析文案 ====================
function parseCopy(path) {
  const text = fs.readFileSync(path, 'utf8');
  const lines = text.split(/\r?\n/);
  let title = '';
  const cards = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (cur) { cards.push(cur); cur = null; } continue; }
    if (line.startsWith('# ')) { title = line.slice(2).trim(); continue; }
    if (line.startsWith('## ')) { if (cur) { cards.push(cur); cur = null; } continue; }
    (cur ||= []).push(line);
  }
  if (cur) cards.push(cur);
  return { title, cards };
}

// ==================== 2. 排期 ====================
function schedule({ title, cards }) {
  const segs = [];
  let t = 0;
  // 标题卡（强调）
  if (title) {
    const dur = 3.2;
    segs.push({ start: t, end: t + dur, lines: [title], style: 'Emphasis' });
    t += dur;
  }
  for (const card of cards) {
    const chars = card.join('').length;
    const dur = Math.max(2.6, 1.8 + chars * 0.22);
    // 强调卡：含"破防/赢麻/真香/救命"等情绪词
    const txt = card.join('');
    const isEmphasis = /破防|赢麻|真香|救命|嘴硬|傲慢/.test(txt);
    segs.push({ start: t, end: t + dur, lines: card, style: isEmphasis ? 'Emphasis' : 'Main' });
    t += dur;
  }
  return { segs, total: t };
}

// ==================== 3. ASS 时间码 ====================
function tc(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec - h * 3600 - m * 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

// ==================== 4. 生成 ASS ====================
function buildAss(segs) {
  const lines = [];
  lines.push('[Script Info]');
  lines.push('ScriptType: v4.00+');
  lines.push(`PlayResX: ${W}`);
  lines.push(`PlayResY: ${H}`);
  lines.push('ScaledBorderAndShadow: yes');
  lines.push('WrapStyle: 2');
  lines.push('');
  lines.push('[V4+ Styles]');
  lines.push('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding');
  // 颜色: &HAABBGGRR  白=&H00FFFFFF  黄=&H0000FFFF
  lines.push(`Style: Main,${FONT},72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,2,0,1,6,2,5,80,80,0,1`);
  lines.push(`Style: Emphasis,${FONT},80,&H0000FFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,2,0,1,7,2,5,80,80,0,1`);
  lines.push('');
  lines.push('[Events]');
  lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');

  for (const s of segs) {
    const text = s.lines.join('\\N');
    const cx = W / 2;
    const cy = H / 2;
    const fadeMs = Math.min(220, Math.round((s.end - s.start) * 1000 * 0.18));
    // 入场轻微上浮 + 放大
    const dialogue =
      `Dialogue: 0,${tc(s.start)},${tc(s.end)},${s.style},,0,0,0,,` +
      `{\\an5\\pos(${cx},${cy})\\fad(${fadeMs},${fadeMs})\\t(0,${Math.min(400, fadeMs * 2)},)\\fscx92\\fscy92\\t(0,360,\\fscx100\\fscy100)}` +
      text;
    lines.push(dialogue);
  }
  return lines.join('\n');
}

// ==================== 5. ffmpeg 合成 ====================
function render(total) {
  // 背景: 纯色 + 顶部一条略浅的色块作为视觉层次
  const bgFilter = `color=c=${BG}:s=${W}x${H}:r=${FPS}:d=${total.toFixed(2)},drawbox=x=0:y=0:w=${W}:h=260:color=${ACCENT}@0.5:t=fill`;
  const assFilter = `subtitles=subtitles.ass:fontsdir=C\\:/Windows/Fonts`;
  // 注意：lavfi 链里 : 需转义。改用 -vf 时整体在引号里更稳。
  const args = [
    '-y',
    '-f', 'lavfi', '-i', `color=c=${BG}:s=${W}x${H}:r=${FPS}:d=${total.toFixed(2)}`,
    '-vf', `drawbox=x=0:y=0:w=${W}:h=300:color=${ACCENT}@0.55:t=fill,subtitles=subtitles.ass`,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '20',
    '-r', String(FPS),
    '-t', total.toFixed(2),
    'output.mp4',
  ];
  console.log('ffmpeg:', FFMPEG);
  console.log('args:', args.join(' '));
  const r = spawnSync(FFMPEG, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('ffmpeg 失败，exit', r.status);
    process.exit(1);
  }
}

// ==================== main ====================
const { title, cards } = parseCopy('copywriting.md');
console.log(`标题: ${title}  卡片数: ${cards.length}`);
const { segs, total } = schedule({ title, cards });
console.log(`时段数: ${segs.length}  总时长: ${total.toFixed(2)}s`);
fs.writeFileSync('subtitles.ass', buildAss(segs), 'utf8');
console.log('已写 subtitles.ass');
render(total);
console.log('完成: output.mp4');
