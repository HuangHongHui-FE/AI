#!/usr/bin/env node
// copyright-check：量「原片单镜头时长 / 累计占比 / 原创解说占比」三项可计算指标
// 用法：
//   node atom/copyright-check/src/index.mjs --video 成品.mp4 --clip 2.8,3.0 --speech-sec 88.9
//   node atom/copyright-check/src/index.mjs --video 成品.mp4            # 自动识别清晰段（启发式）
// stdout：{ ok, total_sec, clips, clip_total, clip_ratio, longest_clip, speech_ratio, fails, warns }

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, emit, fail, log, bizFail } from "../../../_shared/io.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "py", "check_copyright.py");
const args = parseArgs({ known: ["video", "clip", "speech-sec", "out-dir", "quiet"] });

function main() {
  if (!args.video) fail("需要 --video 成片路径");
  const video = resolve(String(args.video));
  if (!existsSync(video)) fail(`成片不存在：${video}`);

  const cli = [SCRIPT, video, "--json"];
  if (args.clip) cli.push("--clip", String(args.clip));
  if (args["speech-sec"]) cli.push("--speech-sec", String(args["speech-sec"]));

  const r = spawnSync("python3", cli, { encoding: "utf8", timeout: 300000 });
  if (r.error) fail(`执行 check_copyright.py 失败：${r.error.message}`);
  let res;
  try {
    // 脚本先打人读报告，最后一行才是 JSON
    const last = (r.stdout || "").trim().split("\n").pop();
    res = JSON.parse(last);
  } catch {
    fail(`check_copyright.py 未返回 JSON：${(r.stderr || r.stdout || "").trim().slice(-300)}`);
  }

  if (!args.quiet) {
    log(`\ncopyright-check：${video}`);
    if (res.clip_ratio != null) log(`  原片：${res.clips?.join("+")} 秒 / 占比 ${(res.clip_ratio * 100).toFixed(1)}% / 最长 ${res.longest_clip.toFixed(2)} 秒`);
    if (res.speech_ratio != null) log(`  原创解说：${res.speech_sec} 秒 / 占比 ${(res.speech_ratio * 100).toFixed(1)}%`);
    for (const f of res.fails) log(`  ✗ ${f}`);
    for (const w of res.warns) log(`  ! ${w}`);
    log(res.ok ? "  ✓ C3 硬指标全过" : "  ✗ 未通过（有 FAIL 或未校验项）");
  }

  if (res.ok) emit(res, 0);
  else bizFail(res, `copyright-check 未通过：${res.fails.length} FAIL / ${res.warns.length} 未校验`);
}

main();