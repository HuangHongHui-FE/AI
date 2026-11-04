#!/usr/bin/env node
// 回归测试：用 fixtures/raw 下的真实接口响应跑解析，验证字段路径仍有效（不发网络请求）.
// 用法：node atom/hotlist/fixtures/regression.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLATFORMS } from "../src/lib/platforms.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// 每个平台的最低期望：至少解析出多少条、哪些字段必须有值
const EXPECT = {
  toutiao: { min: 30, fields: ["title", "heat"] },
  baidu: { min: 30, fields: ["title", "heat"] },
  douyin: { min: 30, fields: ["title", "heat"] },
  bilibili: { min: 15, fields: ["title", "heat"] },
  weibo: { min: 30, fields: ["title"] },
};

// 读 fixture 并按平台定义解析：有 parse 的平台（百度）fixture 是 HTML，其余是 JSON
function loadFixture(key) {
  const def = PLATFORMS[key];
  const text = readFileSync(join(HERE, "raw", `${key}.${def.parse ? "html" : "json"}`), "utf8");
  return def.parse ? def.parse(text) : JSON.parse(text);
}

let failed = 0;
let total = 0; // 断言总数，用于统一输出「N/N 通过」

// 逐平台跑解析并断言
for (const [key, exp] of Object.entries(EXPECT)) {
  total++;
  let json;
  try {
    json = loadFixture(key);
  } catch (e) {
    console.log(`✗ ${key}: fixture 缺失或损坏（${e.message}）`);
    failed++;
    continue;
  }

  let items;
  try {
    items = PLATFORMS[key].extract(json);
  } catch (e) {
    console.log(`✗ ${key}: 解析抛错（${e.message}）——接口结构可能已变`);
    failed++;
    continue;
  }

  const errors = [];
  if (items.length < exp.min) errors.push(`只解析出 ${items.length} 条（期望 ≥${exp.min}）`);
  for (const f of exp.fields) {
    const filled = items.filter((it) => it[f]).length;
    if (filled < items.length * 0.8) errors.push(`字段 ${f} 只有 ${filled}/${items.length} 条有值`);
  }

  if (errors.length) {
    console.log(`✗ ${key}: ${errors.join("；")}`);
    failed++;
  } else {
    console.log(`✓ ${key}: ${items.length} 条，首条「${items[0].title}」`);
  }
}

// 跨榜重叠：至少应该能识别出若干个真热话题
const all = {};
for (const key of Object.keys(PLATFORMS)) {
  try {
    all[key] = { ok: true, label: PLATFORMS[key].label, items: PLATFORMS[key].extract(loadFixture(key)) };
  } catch {}
}
const { findOverlap } = await import("../src/lib/overlap.mjs");
const overlaps = findOverlap(all);
total++; // overlap 也算一条断言
if (overlaps.length < 2) {
  console.log(`✗ overlap: 只识别出 ${overlaps.length} 个跨榜话题（期望 ≥2）`);
  failed++;
} else {
  console.log(`✓ overlap: ${overlaps.length} 个跨榜话题，首位「${overlaps[0].title}」`);
}

console.log(`\n${total - failed}/${total} 通过`);
process.exit(failed ? 1 : 0);
