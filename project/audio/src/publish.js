import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { spawn } from "node:child_process";
import { config, ensureDirs } from "./config.js";

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

// 取下一个 episode 编号
async function nextEpisodeNumber() {
  let max = 0;
  try {
    const entries = await readdir(config.episodesDir);
    for (const e of entries) {
      const m = e.match(/^E(\d{3,})$/);
      if (m) max = Math.max(max, Number(m[1]));
    }
  } catch {
    // 目录不存在则忽略
  }
  return `E${String(max + 1).padStart(3, "0")}`;
}

// 执行子进程命令，返回 stdout 最后一行
function execCmd(cmd, env) {
  return new Promise((resolveFn, reject) => {
    const [c, ...args] = cmd.split(/\s+/);
    const proc = spawn(c, args, { env, stdio: "pipe", shell: true });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`上传命令失败: ${err || code}`));
      else resolveFn(out.trim().split("\n").pop());
    });
  });
}

// 获取音频外链
async function resolveAudioUrl(mp3Path) {
  if (config.audioUploadCmd) {
    const url = await execCmd(config.audioUploadCmd, { ...process.env, FILE: mp3Path });
    if (!url.startsWith("http")) throw new Error(`上传命令未返回 URL：${url}`);
    return url;
  }
  if (config.audioBaseUrl) {
    return `${config.audioBaseUrl.replace(/\/$/, "")}/${basename(mp3Path)}`;
  }
  // 无外链时返回本地路径提示
  return `file://${mp3Path}`;
}

// 运行 preflight-podcast.js
async function runPreflight(articlePath) {
  return new Promise((resolveFn, reject) => {
    const proc = spawn("node", [resolve(config.root, "src/preflight-podcast.js"), articlePath], {
      stdio: "inherit",
    });
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error("preflight-podcast 未通过"));
      else resolveFn();
    });
  });
}

// 生成音频
async function runAudio(articlePath, mp3Path) {
  return new Promise((resolveFn, reject) => {
    const proc = spawn("node", [resolve(config.root, "src/audio.js"), "--from-json", articlePath, "--output", mp3Path], {
      stdio: "inherit",
    });
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error("audio 生成失败"));
      else resolveFn();
    });
  });
}

// 子进程调用 wechat-img 发布
async function runWechatImg(articlePath, imagePath, outDir, dryRun, author) {
  return new Promise((resolveFn, reject) => {
    const args = [
      resolve(config.wechatImgRoot, "src/index.js"),
      "--image",
      imagePath,
      "--from-json",
      articlePath,
      "--out-dir",
      outDir,
      "--no-embed-image",
    ];
    if (dryRun) args.push("--dry-run");
    if (author) args.push("--author", author);

    const proc = spawn("node", args, {
      cwd: config.wechatImgRoot,
      stdio: "pipe",
      env: { ...process.env, EMBED_ORIGINAL_IMAGE: "false" },
    });

    let out = "";
    proc.stdout.on("data", (d) => {
      out += d;
      process.stdout.write(d);
    });
    proc.stderr.on("data", (d) => process.stderr.write(d));
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error("wechat-img 发布失败"));
      else {
        const m = out.match(/media_id[：:]\s*([a-zA-Z0-9_-]+)/);
        resolveFn(m ? m[1] : null);
      }
    });
  });
}

// 写日志
async function writeLog(episode, article, mediaId, audioUrl, dryRun) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const logPath = join(config.logsDir, `${dateStr}.md`);
  const bodyCount = (article.body_markdown || "").replace(/\s/g, "").length;
  const scriptCount = (article.script || "").replace(/\s/g, "").length;

  const line = [
    `| ${episode} | ${article.title} | ${article.topic || ""} | ${mediaId || "dry-run"} | ${dryRun ? "dry-run" : "晚8-9点/午间"} |`,
  ].join("\n");

  const dimension = [
    `#### ${episode} ${article.topic || article.title}`,
    `- 主题：${article.topic || ""}`,
    `- 字数：正文${bodyCount} / 脚本${scriptCount}`,
    `- media_id：${mediaId || "dry-run"}`,
    `- 音频：${audioUrl}`,
    `- theme记录(供下批避撞)：${episode} ${article.theme || ""}`,
    `- cover_style记录(供下批避撞)：${episode} ${article.cover_style || ""}`,
  ].join("\n");

  let content = "";
  if (!existsSync(logPath)) {
    content = `# ${dateStr} 播客发文日志\n\n## 发文清单\n\n| 编号 | 标题 | 话题 | media_id | 时段建议 |\n|---|---|---|---|---|\n${line}\n\n## 维度记录\n\n${dimension}\n`;
  } else {
    content = await readFile(logPath, "utf8");
    // 在表格最后一行后追加
    content = content.replace(
      /(\| 编号 \| 标题 \| 话题 \| media_id \| 时段建议 \|\n\|[-\|]+\|)/,
      `$1\n${line}`
    );
    content += `\n${dimension}\n`;
  }

  await writeFile(logPath, content, "utf8");
  console.log(`\n📝 日志已写：${logPath}`);
}

// 主流程
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = !!args["dry-run"];
  const regenerate = !!args["regenerate-audio"];

  await ensureDirs();

  const episode = args.episode ? String(args.episode) : await nextEpisodeNumber();
  const episodeDir = join(config.episodesDir, episode);
  await mkdir(episodeDir, { recursive: true });

  const articlePath = join(episodeDir, "article.json");
  if (!existsSync(articlePath)) {
    console.error(`错误：找不到 ${articlePath}，请先生成 article.json`);
    process.exit(1);
  }

  console.log(`\n🎙 播客发布：${episode}`);

  // preflight
  await runPreflight(articlePath);

  // 生成音频
  const mp3Path = join(episodeDir, `${episode}.mp3`);
  if (!existsSync(mp3Path) || regenerate) {
    await runAudio(articlePath, mp3Path);
  } else {
    console.log(`  音频已存在：${mp3Path}，跳过生成（加 --regenerate-audio 可重生成）`);
  }

  // 决定音频链接
  const audioUrl = await resolveAudioUrl(mp3Path);

  // 生成传给 wechat-img 的 JSON
  const article = JSON.parse(await readFile(articlePath, "utf8"));
  const audioLink = `🎧 <a href='${audioUrl}'>点击收听完整 10 分钟音频</a>`;
  const wechatArticle = {
    ...article,
    body_markdown: `${audioLink}\n\n${article.body_markdown}`,
  };
  const wechatArticlePath = join(episodeDir, "article.wechat-img.json");
  await writeFile(wechatArticlePath, JSON.stringify(wechatArticle, null, 2), "utf8");

  // 发布
  const imagePath = args.image ? resolve(String(args.image)) : config.defaultCoverImage;
  const author = args.author ? String(args.author) : undefined;
  const mediaId = await runWechatImg(wechatArticlePath, imagePath, episodeDir, dryRun, author);

  // wechat-img 会把 theme/cover_style 写回 JSON，读取后写日志
  const publishedArticle = JSON.parse(await readFile(wechatArticlePath, "utf8"));
  await writeLog(episode, publishedArticle, mediaId, audioUrl, dryRun);

  console.log("\n✓ 完成");
  if (mediaId) console.log(`  media_id：${mediaId}`);
  console.log(`  音频：${mp3Path}`);
  if (audioUrl.startsWith("file://")) {
    console.log("  ⚠ 未配置 AUDIO_BASE_URL / AUDIO_UPLOAD_CMD，文章中音频链接为本地路径，读者无法点击。");
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
