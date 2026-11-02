// HTTP 抓取：国内新闻源对 UA 敏感，统一用移动端 UA 并控速
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// 带超时与 UA 的文本抓取；失败返回空串（调用方按「该源无结果」处理，不中断整批）
export async function fetchText(url, referer = "", timeoutMs = 20000) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": MOBILE_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        ...(referer ? { Referer: referer } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

// 控速：源之间留间隔，避免同 IP 被限频
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// HTML 去标签 + 实体反转义
export function stripTags(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
