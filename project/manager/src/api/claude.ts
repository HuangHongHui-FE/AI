// 浏览器直连 Anthropic Messages API（流式 SSE）

export interface RunParams {
  apiKey: string;
  model: string;
  system: string; // skill 全文作为系统指令
  user: string; // 用户填的参数 / 主题
  onDelta: (full: string) => void; // 累加文本回调
  signal?: AbortSignal;
}

// 解析 SSE，累加 content_block_delta.delta.text
export async function runSkillStream({
  apiKey,
  model,
  system,
  user,
  onDelta,
  signal,
}: RunParams): Promise<void> {
  const res = await fetch("https://api.anthropic.com/v1/messages?stream=true", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system,
      stream: true,
      messages: [{ role: "user", content: user }],
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${txt || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let acc = "";

  // SSE 事件以 \n\n 分隔，每行 data: {...}
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const event = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLine = event.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const json = dataLine.slice(5).trim();
      if (json === "[DONE]") return;
      try {
        const obj = JSON.parse(json);
        // content_block_delta: { delta: { type: "text_delta", text: "..." } }
        if (obj.type === "content_block_delta" && obj.delta?.text) {
          acc += obj.delta.text;
          onDelta(acc);
        }
        if (obj.type === "error") throw new Error(obj.error?.message || "stream error");
      } catch {
        // 忽略偶发非 JSON 行
      }
    }
  }
}
