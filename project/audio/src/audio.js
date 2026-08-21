import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, basename, extname, join } from "node:path";
import { spawn } from "node:child_process";
import { EdgeTTS } from "node-edge-tts";
import { config } from "./config.js";

// 解析命令行参数
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      args[key] = val;
    } else {
      args._.push(a);
    }
  }
  return args;
}

// 把脚本清理成适合朗读的文本
function cleanScript(text) {
  return (
    text
      // 去掉 markdown 链接，只保留文字
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // 去掉 markdown 图片
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      // 去掉加粗/斜体标记
      .replace(/(\*\*|__|\*|_)/g, "")
      // 去掉标题标记
      .replace(/^#+\s*/gm, "")
      // 去掉引用标记
      .replace(/^>\s*/gm, "")
      // 去掉代码块
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      // ASCII 双引号 → 中文引号
      .replace(/"([^"]*)"/g, "「$1」")
      // 多余空行
      .replace(/\n{2,}/g, "\n")
      .trim()
  );
}

// 按中文句尾标点分块，每块不超过 maxChars
function splitScript(text, maxChars) {
  const sentences = text.split(/([。！？；\n]+)/);
  const chunks = [];
  let cur = "";
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (!s) continue;
    if (cur.length + s.length > maxChars && cur.length > 0) {
      chunks.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [text.trim()];
}

// 调用 ffmpeg 合并音频
function concatAudio(parts, outputPath) {
  return new Promise(async (resolveFn, reject) => {
    const ffmpegPath = config.ffmpegPath || process.env.FFMPEG_PATH || "ffmpeg";

    // 检查 ffmpeg 是否可用
    const ffmpegExists = await new Promise((r) => {
      const probe = spawn(ffmpegPath, ["-version"], { stdio: "ignore" });
      probe.on("error", () => r(false));
      probe.on("close", (code) => r(code === 0));
    });
    if (!ffmpegExists) {
      reject(
        new Error(
          `未找到 ffmpeg（路径：${ffmpegPath}）。多段音频合并需要 ffmpeg，请先安装 ffmpeg 或设置 FFMPEG_PATH。`
        )
      );
      return;
    }

    const listPath = outputPath + ".concat.txt";
    const listContent = parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    await writeFile(listPath, listContent, "utf8");
    const args = ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath];
    const proc = spawn(ffmpegPath, args, { stdio: "pipe" });
    let err = "";
    proc.stderr.on("data", (d) => (err += d));
    proc.on("close", (code) => {
      unlink(listPath).catch(() => {});
      if (code !== 0) reject(new Error(`ffmpeg 合并失败: ${err || code}`));
      else resolveFn();
    });
  });
}

// 生成单集音频
export async function generateAudio(articlePath, outputPath) {
  const article = JSON.parse(await readFile(articlePath, "utf8"));
  const rawScript = article.script || article.body_markdown || "";
  if (!rawScript.trim()) throw new Error("article.json 缺少 script 或 body_markdown");

  const script = cleanScript(rawScript);
  const chunks = splitScript(script, config.tts.maxChunkChars);
  console.log(`🎙 生成音频：共 ${chunks.length} 段，目标 ${outputPath}`);

  const tts = new EdgeTTS({
    voice: article.voice || config.tts.voice,
    lang: article.lang || config.tts.lang,
    rate: article.rate || config.tts.rate,
    pitch: article.pitch || config.tts.pitch,
    volume: article.volume || config.tts.volume,
    outputFormat: article.format || config.tts.format,
    proxy: config.tts.proxy,
    timeout: config.tts.timeout,
  });

  const parts = [];
  for (let i = 0; i < chunks.length; i++) {
    const partPath = outputPath + `.part-${String(i).padStart(3, "0")}.mp3`;
    parts.push(partPath);
    console.log(`  第 ${i + 1}/${chunks.length} 段...`);
    await tts.ttsPromise(chunks[i], partPath);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  if (parts.length === 1) {
    const { copyFile } = await import("node:fs/promises");
    await copyFile(parts[0], outputPath);
  } else {
    await concatAudio(parts, outputPath);
  }

  // 清理临时分块
  await Promise.all(parts.map((p) => unlink(p).catch(() => {})));

  console.log(`✓ 音频已生成：${outputPath}`);
  return outputPath;
}

// CLI 入口
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const articlePath = args["from-json"] ? resolve(String(args["from-json"])) : null;
  if (!articlePath || !existsSync(articlePath)) {
    console.error("用法：node src/audio.js --from-json <article.json> [--output <mp3>]");
    process.exit(1);
  }

  let outputPath;
  if (args.output) {
    outputPath = resolve(String(args.output));
  } else {
    const base = basename(articlePath, extname(articlePath));
    outputPath = resolve(dirname(articlePath), `${base}.mp3`);
  }

  await generateAudio(articlePath, outputPath);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
