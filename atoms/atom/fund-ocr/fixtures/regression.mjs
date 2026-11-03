#!/usr/bin/env node
// 回归：fund-ocr 参数校验 / 切片产物 / --plan 不加载 OCR
// 退出码：0 通过 / 1 失败
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ENTRY = join(HERE, "..", "src", "index.mjs");
const work = mkdtempSync(join(tmpdir(), "fo-reg-"));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const run = (args) => spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8" });

// 造一张 800x1200 的合成图
const img = join(work, "shot.png");
await sharp({ create: { width: 800, height: 1200, channels: 3, background: "#ffffff" } })
  .composite([
    { input: Buffer.from(`<svg width="800" height="1200"><rect x="0" y="0" width="800" height="40" fill="#1f4e79"/><rect x="0" y="300" width="800" height="2" fill="#999"/><rect x="0" y="600" width="800" height="2" fill="#999"/></svg>`), top: 0, left: 0 },
  ])
  .png()
  .toFile(img);

// 1. 参数校验
check("缺 --image exit 2", run([]).status === 2);
check("图片不存在 exit 2", run(["--image", join(work, "no.png")]).status === 2);
check("未知参数 exit 2", run(["--image", img, "--foo", "x"]).status === 2);

// 2. --plan 只切片
const outDir = join(work, "out");
const r = run(["--image", img, "--out-dir", outDir, "--plan"]);
check("--plan 成功 exit 0", r.status === 0, r.stderr.trim().slice(-80));
check("产出 strips.json", existsSync(join(outDir, "strips.json")));
if (existsSync(join(outDir, "strips.json"))) {
  const sliced = JSON.parse(readFileSync(join(outDir, "strips.json"), "utf8"));
  check("切片数量合理", sliced.strips.length > 5, `${sliced.strips.length} 条`);
  check("切片文件存在", sliced.strips.every((s) => existsSync(s.file)));
  check("记录原图尺寸", sliced.width === 800 && sliced.height === 1200);
}
const planned = JSON.parse(r.stdout);
check("--plan 不跑 OCR", planned.ocr === false && planned.strips > 5);
check("--plan 不产出 ocr.json", !existsSync(join(outDir, "ocr.json")));

// 3. 自定义条高
const out2 = join(work, "out2");
const r2 = run(["--image", img, "--out-dir", out2, "--plan", "--strip-height", "100", "--overlap", "0"]);
const p2 = JSON.parse(r2.stdout);
check("条高 100 切片更少", r2.status === 0 && p2.strips < planned.strips, `${p2.strips} vs ${planned.strips}`);

// 4. 可选：真实 OCR（需要 tesseract.js + 联网语言包）
if (process.env.OCR_LIVE === "1") {
  const out3 = join(work, "out3");
  const r3 = run(["--image", img, "--out-dir", out3]);
  check("真实 OCR 成功", r3.status === 0, r3.stderr.trim().slice(-80));
  check("产出 text.txt", existsSync(join(out3, "text.txt")));
} else {
  console.log("（未设 OCR_LIVE=1，跳过真实 OCR）");
}

const failN = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);