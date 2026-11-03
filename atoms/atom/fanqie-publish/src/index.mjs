#!/usr/bin/env node
// fanqie-publish：番茄小说章节存草稿（默认只存草稿，发布由人工在作家后台点）
// 用法：
//   node atom/fanqie-publish/src/index.mjs --list                                    # 列账号下的书
//   node atom/fanqie-publish/src/index.mjs --book <id> --file chapter.md             # 存草稿
//   node atom/fanqie-publish/src/index.mjs --book <id> --file ch.md --title "第3章 标题" --dry-run
// stdout：{ ok, mode, book_id, title, item_id, chars }

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs, emit, fail, log, EXIT } from "../../../_shared/io.mjs";
import { listBooks, saveDraft } from "./lib/api.mjs";

const args = parseArgs({ known: ["book", "file", "title", "auth", "list", "dry-run", "out-dir"] });

// 登录态：--auth 指定，否则 FANQIE_AUTH_DIR，否则 .cache/fanqie
function authFile() {
  if (args.auth) return resolve(String(args.auth));
  const dir = process.env.FANQIE_AUTH_DIR || ".cache/fanqie";
  return join(dir, "fanqie.json");
}

// 读登录态：必须同时有 cookie 和 csrfToken，缺一个都请求不了
function loadAuth() {
  const f = authFile();
  if (!existsSync(f)) fail(`未找到登录态 ${f}（需要含 cookie 与 csrfToken）`);
  let j;
  try {
    j = JSON.parse(readFileSync(f, "utf8"));
  } catch (e) {
    fail(`登录态文件不是合法 JSON：${e.message}`);
  }
  if (!j.cookie || !j.csrfToken) fail("登录态缺 cookie 或 csrfToken，请重新抓取");
  return j;
}

// 章节文件 → { title, body }
// 首行 `# 第N章 标题` 作章节标题；其余行去掉标题行后作为正文
function parseChapter(file, titleOverride) {
  const p = resolve(file);
  if (!existsSync(p)) fail(`章节文件不存在：${p}`);
  const raw = readFileSync(p, "utf8");

  const firstH1 = raw.split("\n").find((l) => l.trim().startsWith("# "))?.trim() ?? "";
  const title = titleOverride || firstH1.replace(/^#\s*/, "").trim();
  if (!title) fail("无法确定章节标题：文件里没有 `# 标题` 行，也没传 --title");

  const body = raw
    .split("\n")
    .filter((l) => !l.trim().startsWith("# "))
    .join("\n")
    .trim();
  if (!body) fail("章节正文为空");

  return { title, body };
}

// 纯文本 → <p> 段落 HTML（番茄正文接口吃 HTML）
function toHtml(text) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join("");
}

async function main() {
  const auth = loadAuth();

  // --list：列书，供用户挑 book_id
  if (args.list) {
    const books = await listBooks(auth);
    log(`\n账号下 ${books.length} 本书：`);
    for (const b of books) log(`  ${b.book_id} | ${b.book_name} | 字数 ${b.words ?? "-"} | 状态 ${b.status ?? "-"}`);
    emit({ ok: true, mode: "list", count: books.length, books }, EXIT.OK);
    return;
  }

  if (!args.book) fail("需要 --book <book_id>（先用 --list 查看）");
  if (!args.file) fail("需要 --file 章节 markdown 路径");

  const { title, body } = parseChapter(String(args.file), args.title ? String(args.title) : "");
  const content = toHtml(body);
  const chars = body.replace(/\s/g, "").length;

  // dry-run：只做本地解析与转换，不调接口
  if (args["dry-run"]) {
    const result = { ok: true, mode: "dry-run", book_id: String(args.book), title, chars, html_bytes: content.length };
    log(`✓ 解析完成：${title}（${chars} 字）`);
    emit(result, EXIT.OK);
    return;
  }

  log(`存草稿到书 ${args.book}：${title}（${chars} 字）…`);
  const r = await saveDraft(auth, { bookId: String(args.book), title, content });
  log(`✓ 已存入草稿箱：item_id=${r.itemId} / 分卷 ${r.volumeName}`);
  log(`  请到番茄作家助手草稿箱检查后手动发布`);

  emit(
    { ok: true, mode: "draft", book_id: String(args.book), title, chars, item_id: r.itemId, volume_id: r.volumeId, volume_name: r.volumeName },
    EXIT.OK
  );
}

main().catch((e) => fail(e.message));
