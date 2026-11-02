// 头条编辑器填充：标题 + 正文（真实剪贴板粘贴），封面需人工上传
// 半自动设计的原因：头条没有草稿 API，发布必须人工点「预览并发布」；
// 且 a_bogus 反爬验签使直接调接口不可行，只能驱动真实浏览器

const EDIT_URL = "https://mp.toutiao.com/profile_v4/graphic/publish";

// 选择器池：2026-07-27 用 --inspect 现场确认（profile_v4/graphic/publish）
export const SELECTORS = {
  titleInput: ['textarea[placeholder*="文章标题"]'],
  bodyEditor: [".ProseMirror"],
};

// 按候选选择器数组找第一个可见元素
async function findEl(page, selectors, label) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    try {
      await el.waitFor({ state: "visible", timeout: 4000 });
      return el;
    } catch {
      /* 试下一个 */
    }
  }
  throw new Error(`找不到「${label}」元素，候选：${selectors.join(" | ")}。用 --inspect 现场确认 DOM`);
}

// 关掉 AI 助手抽屉：它的遮罩 .byte-drawer-mask 会挡住编辑区点击
async function closeDrawer(page) {
  try {
    const mask = page.locator(".byte-drawer-mask").first();
    if (await mask.isVisible({ timeout: 1000 }).catch(() => false)) {
      await mask.click({ timeout: 1000 }).catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(500);
      return true;
    }
  } catch {
    /* 没抽屉则跳过 */
  }
  return false;
}

// 探编辑页关键 DOM，供选择器失效时现场修正
export async function inspectPage(page) {
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => {
    const textInputs = [...document.querySelectorAll('input[type="text"],input:not([type])')].map((e) => ({
      ph: e.placeholder,
      id: e.id,
      cls: (e.className || "").toString().slice(0, 60),
    }));
    const textareas = [...document.querySelectorAll("textarea")].map((e) => ({
      ph: e.placeholder,
      cls: (e.className || "").toString().slice(0, 60),
    }));
    const editables = [...document.querySelectorAll('[contenteditable="true"]')].map((e) => ({
      cls: (e.className || "").toString().slice(0, 80),
      ph: e.getAttribute("data-placeholder") || e.getAttribute("placeholder"),
    }));
    const clickables = [...document.querySelectorAll("button,a,span,div")]
      .map((e) => (e.innerText || "").trim())
      .filter((t) => /草稿|保存|发布|预览|封面|cover|draft|存草|上传/.test(t))
      .slice(0, 25);
    const fileInputs = [...document.querySelectorAll('input[type="file"]')].length;
    return { url: location.href, textInputs, textareas, editables, clickables, fileInputs };
  });
  return info;
}

// 填标题：用逐字 type 而非 fill——头条标题是 React 受控组件，fill 有时不触发 onInput
async function fillTitle(page, title) {
  const el = await findEl(page, SELECTORS.titleInput, "标题输入框");
  await el.click();
  await el.fill("");
  await page.keyboard.type(title, { delay: 10 });
  return title;
}

// 填正文：走真实剪贴板粘贴——ProseMirror 的 paste handler 会处理富文本并触发自动保存
async function fillBody(page, html) {
  const el = await findEl(page, SELECTORS.bodyEditor, "正文编辑器");
  await el.click();
  await page.waitForTimeout(300);
  await page.evaluate(async (h) => {
    const blob = new Blob([h], { type: "text/html" });
    const plain = new Blob([h.replace(/<[^>]+>/g, "")], { type: "text/plain" });
    await navigator.clipboard.write([new ClipboardItem({ "text/html": blob, "text/plain": plain })]);
  }, html);
  await page.keyboard.press("Meta+V");
  await page.waitForTimeout(2500);
  // 回读编辑器文本长度，确认真的贴进去了（空壳粘贴会返回 0）
  const len = await page.evaluate(() => (document.querySelector(".ProseMirror")?.innerText || "").length);
  return len;
}

// 主流程：打开编辑页 → 填标题 → 贴正文 → 保持浏览器打开等人工发布
export async function fillEditor({ chromium, authFile, title, bodyHtml, coverPath, holdMs = 300000 }) {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ storageState: authFile });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://mp.toutiao.com" });
  const page = await ctx.newPage();
  page.on("dialog", async (d) => {
    await d.accept().catch(() => {});
  });

  await page.goto(EDIT_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const drawerClosed = await closeDrawer(page);

  const filledTitle = await fillTitle(page, title);
  const bodyLen = await fillBody(page, bodyHtml);
  if (bodyLen === 0) throw new Error("正文粘贴后编辑器仍为空——剪贴板权限或被拦截，请用 paste.html 手动粘贴");

  // 半自动：浏览器保持打开，等用户上传封面并点「预览并发布」
  const note = [
    `标题已填：${filledTitle}`,
    `正文已贴入（${bodyLen} 字）`,
    coverPath ? `封面已生成：${coverPath}（头条 file input 隐藏，需手动上传）` : "",
    "请在浏览器里：① 封面区点「单图」上传封面 ② 点底部「预览并发布」",
  ].filter(Boolean);

  try {
    await page.waitForTimeout(holdMs);
  } catch {
    /* 用户提前关浏览器 */
  }
  await browser.close();
  return { ok: true, drawer_closed: drawerClosed, title: filledTitle, body_chars: bodyLen, notes: note };
}
