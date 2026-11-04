// 抓取器：并发拉取各平台、超时保护、单平台失败不影响整体
import { PLATFORMS } from "./platforms.mjs";

// 带超时与重试的 JSON 拉取，失败返回 { ok:false, error }
async function fetchJson(url, headers, { timeout = 12000, retries = 1, parse } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length < 500) throw new Error(`响应过小（${text.length} 字节），疑被拦截`);
      // 部分平台返回 HTML，由平台定义里的 parse 从页面里抠 JSON
      return { ok: true, json: parse ? parse(text) : JSON.parse(text), bytes: text.length };
    } catch (e) {
      if (attempt === retries) return { ok: false, error: e.message };
      await new Promise((r) => setTimeout(r, 600)); // 重试前短暂退避
    }
  }
}

// 抓多个平台，返回 { results: {key: {label, ok, items, meta, error, bytes}} }
export async function fetchHotlist(platformKeys, opts = {}) {
  const keys = platformKeys.filter((k) => PLATFORMS[k]);
  const unknown = platformKeys.filter((k) => !PLATFORMS[k]);
  if (unknown.length) throw new Error(`未知平台：${unknown.join(", ")}（可选：${Object.keys(PLATFORMS).join(", ")}）`);

  const results = await Promise.all(
    keys.map(async (key) => {
      const def = PLATFORMS[key];
      const r = await fetchJson(def.url, def.headers, { ...opts, parse: def.parse });
      if (!r.ok) return [key, { label: def.label, ok: false, error: r.error, items: [] }];
      let items = [];
      try {
        items = def.extract(r.json);
      } catch (e) {
        return [key, { label: def.label, ok: false, error: `解析失败：${e.message}`, items: [] }];
      }
      return [
        key,
        {
          label: def.label,
          ok: true,
          bytes: r.bytes,
          count: items.length,
          meta: def.meta ? def.meta(r.json) : undefined,
          items,
        },
      ];
    })
  );
  return Object.fromEntries(results);
}
