// 番茄作家后台接口：鉴权头、通用请求、列书、存草稿
// 默认只存草稿——发布是用户的明确决定，atom 不能替用户按发布键

// 接口基址可用 FANQIE_API_BASE 覆盖（离线回归测试用），生产环境不设置即走官方地址
const BASE = () => process.env.FANQIE_API_BASE || "https://fanqienovel.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";
// 这两个固定参数是签名白名单的一部分，改动会导致请求被拒
const COMMON = { aid: "2503", app_name: "muye_novel" };

// 鉴权头：cookie + csrfToken 都从登录态文件读，源码里零凭据
export function buildHeaders(auth) {
  return {
    Cookie: auth.cookie,
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    Origin: BASE(),
    Referer: `${BASE()}/main/writer/`,
    "X-Secsdk-Csrf-Token": auth.csrfToken,
  };
}

// 通用请求：code !== 0 视为失败，鉴权类错误给出重登提示
export async function req(auth, method, path, params = {}) {
  const qs = new URLSearchParams({ ...COMMON, ...params }).toString();
  const url = method === "POST" ? `${BASE()}${path}` : `${BASE()}${path}?${qs}`;
  const res = await fetch(url, {
    method,
    headers:
      method === "POST"
        ? { ...buildHeaders(auth), "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }
        : buildHeaders(auth),
    body: method === "POST" ? qs : undefined,
  });
  const text = await res.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(`${path} 返回非 JSON（HTTP ${res.status}）：${text.slice(0, 120)}`);
  }
  if (j.code !== 0) {
    const msg = j.message || j.msg || "未知错误";
    const hint = /登录|登陆|csrf|权限|未授权|token/i.test(msg) ? "（鉴权失效，请重新登录并更新 auth 文件）" : "";
    throw new Error(`${path} 失败 code=${j.code}: ${msg}${hint}`);
  }
  return j.data;
}

// 列账号下的书：返回归一后的 [{ book_id, book_name, words, status }]
export async function listBooks(auth) {
  const data = await req(auth, "GET", "/api/author/stats/book_list/v0/", {
    page_index: 0,
    page_count: -1,
    image_fmt_list: "160x214",
  });
  const list = Array.isArray(data) ? data : data?.stats_book_list ?? data?.book_list ?? data?.list ?? [];
  return list.map((b) => ({
    book_id: b.book_id,
    book_name: b.book_name,
    words: b.word_number ?? b.word_count ?? null,
    status: b.creation_status ?? null,
  }));
}

// 建新章节草稿：need_reuse=1 复用上个草稿的卷结构（保持分卷一致）
async function newDraft(auth, bookId) {
  const data = await req(auth, "POST", "/api/author/article/new_article/v0/", {
    book_id: bookId,
    need_reuse: 1,
  });
  const volumeId = String(data?.volume_id ?? "");
  let volumeName = "正文";
  try {
    let vd = data?.volume_data;
    if (typeof vd === "string") vd = JSON.parse(vd);
    if (Array.isArray(vd)) {
      const hit = vd.find((v) => String(v.volume_id) === volumeId) ?? vd[0];
      if (hit?.volume_name) volumeName = hit.volume_name;
    }
  } catch {
    /* 解析失败用默认分卷名 */
  }
  return { itemId: String(data.item_id), volumeId, volumeName };
}

// 存草稿三步：new_article 建草稿 → cover_article 填标题+正文 → save_doc_history 标记保存
// 注意：publish_article 是「发布」接口，本原子不提供——发布必须人工在作家后台点
export async function saveDraft(auth, { bookId, title, content, volumeId, volumeName }) {
  const draft = await newDraft(auth, bookId);
  const vId = volumeId || draft.volumeId;
  const vName = volumeName || draft.volumeName;

  await req(auth, "POST", "/api/author/article/cover_article/v0/", {
    item_id: draft.itemId,
    book_id: bookId,
    title,
    content,
    volume_id: vId,
    volume_name: vName,
  });

  await req(auth, "POST", "/api/author/article/save_doc_history/v0/", {
    book_id: bookId,
    item_id: draft.itemId,
  });

  return { itemId: draft.itemId, volumeId: vId, volumeName: vName };
}
