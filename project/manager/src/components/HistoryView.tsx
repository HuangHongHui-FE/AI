import { useEffect, useState } from "react";
import { useStore } from "../store";
import type { Project, HistoryItem } from "../types";
import { scanProjectHistory } from "../fs/history";
import { readFileText } from "../fs/access";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 按项目扫产物目录，日期分组，点开预览
export default function HistoryView({ project }: { project: Project }) {
  const { root } = useStore();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<HistoryItem | null>(null);
  const [activeContent, setActiveContent] = useState<string>("");
  const [activeUrl, setActiveUrl] = useState<string>("");

  // 项目变化重扫
  useEffect(() => {
    if (!root || !project.name) return;
    setLoading(true);
    setActive(null);
    scanProjectHistory(root, project.name)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [root, project.name]);

  // 选中条目加载内容
  useEffect(() => {
    if (!root || !active) {
      setActiveContent("");
      setActiveUrl("");
      return;
    }
    let revoke = "";
    (async () => {
      try {
        if (active.kind === "image") {
          const segs = active.relPath.split("/");
          let dir = root!;
          for (let i = 0; i < segs.length - 1; i++) dir = await dir.getDirectoryHandle(segs[i]);
          const fh = await dir.getFileHandle(segs[segs.length - 1]);
          const f = await fh.getFile();
          const url = URL.createObjectURL(f);
          revoke = url;
          setActiveUrl(url);
          setActiveContent("");
        } else {
          const txt = await readFileText(root!, active.relPath);
          setActiveContent(txt);
          setActiveUrl("");
        }
      } catch (e: any) {
        setActiveContent("加载失败: " + e.message);
      }
    })();
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [root, active]);

  const fmt = (t: number) => new Date(t).toLocaleString("zh-CN", { hour12: false });

  // 按日期分组
  const groups: Record<string, HistoryItem[]> = {};
  for (const it of items) {
    const d = new Date(it.mtime).toLocaleDateString("zh-CN");
    (groups[d] ??= []).push(it);
  }

  return (
    <div className="history">
      <div className="history-list">
        <div className="proj-name" style={{ textTransform: "none", letterSpacing: 0, fontSize: 13 }}>
          {project.name}
        </div>
        {loading ? (
          <div className="empty">扫描中…</div>
        ) : items.length === 0 ? (
          <div className="empty">无产物（results/output/logs/cache 都空）</div>
        ) : (
          Object.entries(groups).map(([d, list]) => (
            <div key={d} className="date-group">
              <div className="date-head">{d}</div>
              {list.map((it) => (
                <button
                  key={it.relPath}
                  className={active?.relPath === it.relPath ? "hist-item active" : "hist-item"}
                  onClick={() => setActive(it)}
                >
                  <span className={`kind ${it.kind}`}>{it.kind}</span>
                  <span className="hist-name">{it.name}</span>
                  <span className="hist-time">{fmt(it.mtime)}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
      <div className="history-preview">
        {!active ? (
          <div className="empty">选一个产物预览</div>
        ) : active.kind === "html" ? (
          <iframe title="preview" srcDoc={activeContent} className="preview-iframe" />
        ) : active.kind === "md" ? (
          <article className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeContent}</ReactMarkdown>
          </article>
        ) : active.kind === "image" ? (
          activeUrl && <img src={activeUrl} alt={active.name} className="preview-img" />
        ) : (
          <pre className="output-body">{activeContent}</pre>
        )}
      </div>
    </div>
  );
}
