import { useStore } from "../store";
import type { Project, Skill } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

// 选中 skill 后渲染 .md 全文，右上「执行」按钮预填到 SkillRunner
export default function SkillView({ project }: { project: Project }) {
  const { selectedSkill, setRunTarget, setTab } = useStore();
  if (!selectedSkill) return <div className="empty">左侧选一个 skill 查看</div>;

  const skill = project.skills.find((s) => s.relPath === selectedSkill.relPath) as Skill | undefined;
  if (!skill) return <div className="empty">skill 不存在</div>;

  const onRun = () => {
    setRunTarget({ project: skill.project, relPath: skill.relPath, skillName: skill.name });
    setTab("run");
  };

  return (
    <div className="skill-view">
      <div className="skill-head">
        <h2>{skill.name}</h2>
        <div className="skill-meta">
          <span className="badge">{skill.project}</span>
          <code>{skill.relPath}</code>
        </div>
        <button className="btn primary" onClick={onRun}>
          执行此 Skill →
        </button>
      </div>
      {skill.description && <p className="skill-desc">{skill.description}</p>}
      <article className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {skill.content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
