#!/usr/bin/env node
/**
 * 事实核查硬门 + HTML 预览生成。
 *
 * 用法：
 *   node src/preflight.js <facts/<slug>.json>            核查并打印报告
 *   node src/preflight.js <facts/<slug>.json> --render   核查通过后写出预览 HTML
 *   node src/preflight.js --list                         列出所有事实卡及核查状态
 *
 * 设计原则：
 *   硬拦（FAIL 即退出非零，index.js 会拒绝推草稿）
 *     - 任何时间节点缺来源 / 日期非法 / 日期晚于今天
 *     - 日期写成「近日」这类模糊词
 *     - 时间线乱序
 *     - 摘要里出现模糊时间指代
 *   提醒（WARN，不拦）
 *     - 来源单一（1 条）的节点占比过高，建议补第 2 源
 *     - 存疑节点占比
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEvent, isOngoing, renderTimeline } from './facts.js';
import { markdownToHtml, fullPageHtml } from './html.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FACTS_DIR = join(ROOT, 'facts');

// 摘要里的模糊时间指代——摘要必须能独立说清「什么时候到什么时候」
const SUMMARY_VAGUE = ['近日', '日前', '最近', '近期', '前不久', '不久前', '这几天', '这段时间'];

// 今天（本地时区），用于拦截未来日期
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 核查单张事实卡，返回 { fatals, warns, ev }
function checkEvent(ev, today) {
  const fatals = validateEvent(ev, today);
  const warns = [];

  if (!Array.isArray(ev.nodes)) return { fatals, warns, ev };

  const total = ev.nodes.length;
  // 单源节点占一半以上，说明大部分内容没法交叉验证
  const single = ev.nodes.filter((n) => (n.sources || []).length === 1).length;
  if (total && single / total > 0.5)
    warns.push(`单源节点 ${single}/${total} 条（超一半）——重要节点建议补第 2 个来源`);

  const low = ev.nodes.filter((n) => n.confidence === 'low').length;
  if (low) warns.push(`存疑节点 ${low} 条（占 ${Math.round((low / total) * 100)}%）——发布前确认已在正文标注`);

  if (ev.summary && SUMMARY_VAGUE.some((w) => ev.summary.includes(w)))
    fatals.push(`摘要含模糊时间指代（${SUMMARY_VAGUE.filter((w) => ev.summary.includes(w)).join('、')}）——须写明具体起止时间`);

  // 未标记 ended 但节点最后一条离今天很久，提示可能已结束未收尾
  if (isOngoing(ev) && total) {
    const last = ev.nodes[total - 1].date?.slice(0, 10);
    if (last) {
      const gap = Math.round((new Date(today) - new Date(last)) / 86400000);
      if (gap > 30) warns.push(`标记为进行中，但最新节点距今 ${gap} 天——确认事件是否已结束，或补充后续进展`);
    }
  }

  return { fatals, warns, ev };
}

// 生成预览 HTML（时间线主体 + 首尾）
async function renderPreview(ev, date) {
  const outDir = join(ROOT, 'result', date);
  await mkdir(outDir, { recursive: true });
  const bodyMd = [`# ${ev.name}`, '', `> ${ev.summary}`, '', '---', '', renderTimeline(ev.nodes, ev.theme || "cool")].join('\n');
  const html = fullPageHtml(ev.name, markdownToHtml(bodyMd, ev.theme || 'cool'), '', ev.theme || 'cool');
  const outPath = join(outDir, `${ev.slug}-预览.html`);
  await writeFile(outPath, html);
  return outPath;
}

async function main() {
  const args = process.argv.slice(2);
  const today = todayStr();

  // --list：扫 facts/ 列全部事实卡状态
  if (args[0] === '--list') {
    if (!existsSync(FACTS_DIR)) {
      console.log('facts/ 目录不存在，还没有任何事实卡');
      return;
    }
    const files = (await readdir(FACTS_DIR)).filter((f) => f.endsWith('.json'));
    if (!files.length) {
      console.log('facts/ 下还没有事实卡');
      return;
    }
    console.log(`共 ${files.length} 张事实卡：\n`);
    for (const f of files) {
      try {
        const ev = JSON.parse(await readFile(join(FACTS_DIR, f), 'utf8'));
        const { fatals, warns } = checkEvent(ev, today);
        const status = fatals.length ? `✗ FAIL (${fatals.length})` : warns.length ? `△ WARN (${warns.length})` : '✓ PASS';
        console.log(`  ${status}  ${f}  —— ${ev.name || '(无名称)'} · ${(ev.nodes || []).length} 节点`);
      } catch (e) {
        console.log(`  ✗ 读取失败  ${f}  —— ${e.message}`);
      }
    }
    return;
  }

  const factsPath = args[0] ? resolve(args[0]) : null;
  if (!factsPath || !existsSync(factsPath)) {
    console.error('用法: node src/preflight.js <facts/<slug>.json> [--render]');
    console.error('      node src/preflight.js --list');
    process.exit(1);
  }

  const ev = JSON.parse(await readFile(factsPath, 'utf8'));
  const { fatals, warns } = checkEvent(ev, today);

  console.log(`\n事实核查：${ev.name || basename(factsPath)}`);
  console.log(`  节点数：${(ev.nodes || []).length} · 时间跨度：${ev.nodes?.[0]?.date || '?'} → ${ev.nodes?.[ev.nodes.length - 1]?.date || '?'}`);
  console.log(`  状态：${ev.ended ? '已结束' : '仍在发展中'}`);

  if (warns.length) {
    console.log(`\n提醒（${warns.length}，不阻断）：`);
    for (const w of warns) console.log(`  △ ${w}`);
  }

  if (fatals.length) {
    console.log(`\n✗ 硬门未过（${fatals.length} 项）：`);
    for (const f of fatals) console.log(`  ✗ ${f}`);
    console.log('\n→ 事实核查未通过，拒绝进入发布流程。请补齐来源或修正日期后重跑。\n');
    process.exit(1);
  }

  // 逐节点打印时间线摘要，方便肉眼过一遍
  console.log(`\n时间线：`);
  for (const n of ev.nodes) {
    const mark = { turning: '◆', climax: '★', major: '●' }[n.level] || '·';
    const src = `${(n.sources || []).length}源`;
    const low = n.confidence === 'low' ? ' [存疑]' : '';
    console.log(`  ${mark} ${n.date}  ${n.title}  (${src}${low})`);
  }

  console.log(`\n✓ 事实核查硬门通过`);

  if (args.includes('--render')) {
    const out = await renderPreview(ev, today);
    console.log(`  预览已生成：${out}`);
  }
  console.log('');
}

main().catch((e) => {
  console.error('执行失败：', e.message);
  process.exit(1);
});
