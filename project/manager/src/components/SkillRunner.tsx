import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import type { Project } from "../types";
import { runSkillStream } from "../api/claude";

// 选 skill + 填参数 → 浏览器直连 Claude API 流式产出内容草稿
export default function SkillRunner({ project }: { project: Project }) {
  const { apiKey, model, setModel, runTarget, setRunTarget, setNeedApiKey } = useStore();

  const [relPath, setRelPath] = useState("");
  const [params, setParams] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // 切项目或 runTarget 变化时同步 skill 选择
  useEffect(() => {
    if (runTarget && runTarget.project === project.name) {
      setRelPath(runTarget.relPath);
    }
  }, [project.name, runTarget]);

  const skill = project.skills.find((s) => s.relPath === relPath);

  const onRun = async () => {
    if (!apiKey) {
      setNeedApiKey(true);
      return;
    }
    if (!skill) {
      setErrMsg("请先选择一个 skill");
      setStatus("error");
      return;
    }
    setOutput("");
    setErrMsg("");
    setStatus("streaming");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await runSkillStream({
        apiKey,
        model,
        system: skill.content,
        user: params || "（执行此 skill）",
        onDelta: (full) => setOutput(full),
        signal: ac.signal,
      });
      setStatus("done");
    } catch (e: any) {
      if (e.name === "AbortError") {
        setStatus("idle");
      } else {
        setStatus("error");
        setErrMsg(e.message);
      }
    } finally {
      abortRef.current = null;
    }
  };

  const onStop = () => abortRef.current?.abort();
  const onCopy = () => navigator.clipboard.writeText(output);

  return (
    <div className="runner">
      <div className="runner-form">
        <label>
          当前项目
          <input value={project.name} disabled />
        </label>
        <label>
          Skill
          <select value={relPath} onChange={(e) => setRelPath(e.target.value)}>
            <option value="">— 选择 skill —</option>
            {project.skills.map((s) => (
              <option key={s.relPath} value={s.relPath}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          模型
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-sonnet-4-6" />
        </label>
        {skill?.description && <div className="runner-desc">{skill.description}</div>}
        <label>
          参数 / 主题（发给 Claude 的 user 消息）
          <textarea
            rows={5}
            value={params}
            onChange={(e) => setParams(e.target.value)}
            placeholder="如：主题：吴艳妮夺冠 / 分析 / 三个主题：..."
          />
        </label>
        <div className="runner-actions">
          {status === "streaming" ? (
            <button className="btn danger" onClick={onStop}>
              停止
            </button>
          ) : (
            <button className="btn primary" onClick={onRun}>
              执行
            </button>
          )}
          {output && <button className="btn" onClick={onCopy}>复制结果</button>}
          {!apiKey && <button className="btn" onClick={() => setNeedApiKey(true)}>填写 API Key</button>}
        </div>
        {!apiKey && <div className="warn">未配置 API Key，无法执行。</div>}
        <div className="hint" style={{ margin: 0, padding: 0, border: "none" }}>
          提示：输出为 AI 生成的内容草稿，落盘/推草稿仍需走 CLI。
        </div>
      </div>

      <div className="runner-output">
        <div className="output-head">
          输出
          <span className={status === "streaming" ? "status run" : status === "error" ? "status err" : status === "done" ? "status ok" : "status"}>
            {status}
          </span>
        </div>
        {errMsg && <div className="warn">{errMsg}</div>}
        <pre className="output-body">{output || "（执行后内容在此流式显示）"}</pre>
      </div>
    </div>
  );
}
