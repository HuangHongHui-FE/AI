import { useEffect, useState } from "react";
import { useStore } from "../store";
import type { Project } from "../types";
import { readFileText, writeFileText } from "../fs/access";

// 编辑当前项目 package.json 的 scripts 与 config 文件
const CANDIDATES = ["package.json", "config.json", "config.js", "config.ts", ".env"];

export default function ConfigEditor({ project }: { project: Project }) {
  const { root } = useStore();
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>("");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState<"idle" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");

  // 切项目：探测存在哪些候选 config 文件
  useEffect(() => {
    if (!root || !project.name) return;
    (async () => {
      const exists: string[] = [];
      for (const f of CANDIDATES) {
        try {
          await readFileText(root, `${project.name}/${f}`);
          exists.push(f);
        } catch {
          /* 不存在跳过 */
        }
      }
      setFiles(exists);
      setActiveFile(exists[0] ?? "");
      setContent("");
    })();
  }, [root, project.name]);

  // 加载当前文件内容
  useEffect(() => {
    if (!root || !activeFile) return;
    setSaved("idle");
    readFileText(root, `${project.name}/${activeFile}`)
      .then(setContent)
      .catch((e) => {
        setContent("");
        setErrMsg("读取失败: " + e.message);
      });
  }, [root, project.name, activeFile]);

  const onSave = async () => {
    setSaved("idle");
    try {
      if (!root) throw new Error("未选择根目录");
      await writeFileText(root, `${project.name}/${activeFile}`, content);
      setSaved("ok");
    } catch (e: any) {
      setSaved("err");
      setErrMsg(e.message);
    }
  };

  return (
    <div className="config">
      <div className="config-sidebar">
        <div className="proj-name" style={{ textTransform: "none", letterSpacing: 0, fontSize: 13 }}>
          {project.name}
        </div>
        <div className="config-files">
          {files.length === 0 && <div className="no-skill">无可编辑配置文件</div>}
          {files.map((f) => (
            <button
              key={f}
              className={activeFile === f ? "cfg-file active" : "cfg-file"}
              onClick={() => setActiveFile(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="config-main">
        {!activeFile ? (
          <div className="empty">该项目无可编辑配置文件</div>
        ) : (
          <>
            <div className="config-head">
              <code>{project.name}/{activeFile}</code>
              <div className="config-actions">
                <button className="btn primary" onClick={onSave}>
                  保存
                </button>
                {saved === "ok" && <span className="status ok">已保存</span>}
                {saved === "err" && <span className="status err">{errMsg}</span>}
              </div>
            </div>
            <textarea
              className="config-editor"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setSaved("idle");
              }}
              spellCheck={false}
            />
            {activeFile === ".env" && (
              <div className="warn">.env 为明文编辑，整段回写；注意不要误改密钥格式。</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
