import { useEffect, useState } from "react";
import { useStore } from "./store";
import { pickRoot, supportsFsAccess } from "./fs/access";
import { scanAllProjects } from "./fs/parse";
import { KNOWN_PROJECTS, type Project } from "./types";
import Sidebar from "./components/Sidebar";
import SkillView from "./components/SkillView";
import SkillRunner from "./components/SkillRunner";
import HistoryView from "./components/HistoryView";
import ConfigEditor from "./components/ConfigEditor";
import ApiKeyModal from "./components/ApiKeyModal";

export default function App() {
  const { root, rootName, setRoot, tab, setTab, apiKey, needApiKey, setNeedApiKey, currentProject, setCurrentProject } =
    useStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  // 根目录变化后扫描所有项目
  useEffect(() => {
    if (!root) {
      setProjects([]);
      return;
    }
    setLoading(true);
    scanAllProjects(root)
      .then((ps) => {
        setProjects(ps);
        // 授权后默认选第一个，或保留已选项
        if (!currentProject || !ps.some((p) => p.name === currentProject)) {
          setCurrentProject(ps[0]?.name ?? "");
        }
      })
      .catch((e) => alert("扫描失败: " + e.message))
      .finally(() => setLoading(false));
  }, [root]); // eslint-disable-line react-hooks/exhaustive-deps

  // 选执行 tab 但缺 key 时弹窗
  useEffect(() => {
    if (tab === "run" && !apiKey) setNeedApiKey(true);
  }, [tab, apiKey, setNeedApiKey]);

  const onConnect = async () => {
    if (!supportsFsAccess()) {
      alert("当前浏览器不支持 File System Access API，请用 Chrome 或 Edge。");
      return;
    }
    const h = await pickRoot();
    if (h) setRoot(h);
  };

  // select 选项：授权前用硬编码列表，授权后用扫描结果（过滤无 skills 的也能选，因为历史/配置需要）
  const projectNames = root ? projects.map((p) => p.name) : KNOWN_PROJECTS;
  const curProjectObj = projects.find((p) => p.name === currentProject);

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Skill 管理后台</span>
        <div className="project-picker">
          <select
            value={currentProject}
            onChange={(e) => setCurrentProject(e.target.value)}
            disabled={!root}
            title={root ? "切换项目" : "先连接目录"}
          >
            {projectNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {root ? (
            <span className="root-tag">📁 {rootName}/</span>
          ) : (
            <button className="btn primary" onClick={onConnect}>
              连接目录
            </button>
          )}
        </div>
        <nav className="tabs">
          {(["skills", "run", "history", "config"] as const).map((t) => (
            <button
              key={t}
              className={tab === t ? "tab active" : "tab"}
              onClick={() => setTab(t)}
              disabled={!root || !currentProject}
            >
              {{ skills: "Skills", run: "执行", history: "历史", config: "配置" }[t]}
            </button>
          ))}
        </nav>
      </header>

      {!supportsFsAccess() && (
        <div className="warn">
          ⚠ 当前浏览器不支持 File System Access API，请用 Chrome 或 Edge 打开本页。
        </div>
      )}
      <div className="hint">
        纯前端直连 Claude API，key 存 localStorage 仅本机；执行=AI 生成内容草稿，落盘/推草稿仍走 CLI。
      </div>

      <main className="content">
        {!root ? (
          <div className="empty">选好项目后点「连接目录」授权访问（浏览器安全限制，需手动授权一次）</div>
        ) : loading ? (
          <div className="empty">扫描中…</div>
        ) : !curProjectObj ? (
          <div className="empty">该项目无数据</div>
        ) : (
          <>
            <Sidebar project={curProjectObj} />
            <section className="panel">
              {tab === "skills" ? (
                <SkillView project={curProjectObj} />
              ) : tab === "run" ? (
                <SkillRunner project={curProjectObj} />
              ) : tab === "history" ? (
                <HistoryView project={curProjectObj} />
              ) : (
                <ConfigEditor project={curProjectObj} />
              )}
            </section>
          </>
        )}
      </main>

      {needApiKey && <ApiKeyModal onClose={() => setNeedApiKey(false)} />}
    </div>
  );
}
