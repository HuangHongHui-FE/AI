// 数据契约的运行时校验：各 atom 之间靠这些 schema 沟通，字段变更必须走版本号.
// 极简实现，不引第三方依赖；每个校验函数返回 { ok, errors[] }，不抛错.

const isStr = (v) => typeof v === "string";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isArr = Array.isArray;

// 简易字段校验器：rules = { 字段: (v) => true|错误文案 }
function check(obj, rules, label) {
  const errors = [];
  if (obj === null || typeof obj !== "object" || isArr(obj)) {
    return { ok: false, errors: [`${label} 必须是对象`] };
  }
  for (const [key, rule] of Object.entries(rules)) {
    const res = rule(obj[key], obj);
    if (res !== true) errors.push(`${label}.${key}: ${res}`);
  }
  return { ok: errors.length === 0, errors };
}

const req = (v) => (v === undefined || v === null || v === "" ? "缺失" : true);
const opt = () => true;

// ── hotlist.json：热榜抓取结果 ─────────────────────────────
// { generated_at, items: [{ platform, title, url?, rank?, heat? }] }
export function validateHotlist(data) {
  const base = check(data, { generated_at: req, items: (v) => (isArr(v) ? true : "必须是数组") }, "hotlist");
  if (!base.ok) return base;
  const errors = [];
  data.items.forEach((it, i) => {
    const r = check(it, { platform: req, title: req, url: opt, rank: opt, heat: opt }, `hotlist.items[${i}]`);
    if (!r.ok) errors.push(...r.errors);
  });
  return { ok: errors.length === 0, errors };
}

// ── images/manifest.json：找图结果 ─────────────────────────
// { generated_at, query:{subject,event}, images:[{ file, w, h, source, url? }] }
export function validateImageManifest(data) {
  const base = check(
    data,
    { generated_at: req, query: req, images: (v) => (isArr(v) ? true : "必须是数组") },
    "images.manifest"
  );
  if (!base.ok) return base;
  const errors = [];
  data.images.forEach((im, i) => {
    const r = check(
      im,
      { file: req, w: isNum, h: isNum, source: req, url: opt },
      `images.manifest.images[${i}]`
    );
    if (!r.ok) errors.push(...r.errors);
  });
  return { ok: errors.length === 0, errors };
}

// ── facts.json：事实卡（时间必须可校验、来源必填）──────────
// { slug, title, nodes:[{ date:'YYYY-MM-DD', event, source, confidence }] }
export function validateFacts(data) {
  const base = check(
    data,
    { slug: req, title: req, nodes: (v) => (isArr(v) ? true : "必须是数组") },
    "facts"
  );
  if (!base.ok) return base;
  const errors = [];
  const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
  data.nodes.forEach((n, i) => {
    const r = check(
      n,
      {
        date: (v) => (DATE_RE.test(v || "") ? true : "必须是 ISO 日期 YYYY-MM-DD"),
        event: req,
        source: req,
        confidence: opt,
      },
      `facts.nodes[${i}]`
    );
    if (!r.ok) errors.push(...r.errors);
  });
  return { ok: errors.length === 0, errors };
}

// ── article.json：稿件 ─────────────────────────────────────
// { title, digest?, body_markdown, images?:[], cover?:'', account? }
export function validateArticle(data) {
  return check(
    data,
    {
      title: req,
      body_markdown: req,
      digest: opt,
      images: (v) => (v === undefined || isArr(v) ? true : "必须是数组"),
      cover: opt,
      account: opt,
    },
    "article"
  );
}

// ── dims.json：写作维度选择（供去重与轮换）──────────────────
// { title_style?, 开头钩子?, 结构配方?, ... 键值均为 'N-名字' }
export function validateDims(data) {
  if (data === null || typeof data !== "object" || isArr(data)) {
    return { ok: false, errors: ["dims 必须是对象"] };
  }
  const errors = [];
  for (const [k, v] of Object.entries(data)) {
    if (!isStr(v)) errors.push(`dims.${k}: 必须是字符串`);
  }
  return { ok: errors.length === 0, errors };
}
