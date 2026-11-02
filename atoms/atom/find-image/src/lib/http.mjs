// HTTP 工具：文本与二进制抓取，统一超时、重定向与失败兜底
// 用 Node 内置 fetch，不额外引依赖

const UA_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

// 抓文本，失败返回空串（调用方按空值跳过即可，不抛错）
export async function fetchText(url, referer, { timeout = 15000 } = {}) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA_MOBILE, Referer: referer || "", "Accept-Language": "zh-CN,zh;q=0.9" },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

// 抓二进制图片，非图片或失败返回 null
export async function fetchBuf(url, referer, { timeout = 15000 } = {}) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA_MOBILE, Referer: referer || "", Accept: "image/*,*/*" },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("image")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// 控速：渠道之间短暂停顿，避免被封 IP
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
