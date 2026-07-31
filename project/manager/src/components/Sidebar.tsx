import { useStore } from "../store";
import type { Project } from "../types";

// 左侧栏：当前选中项目的 skill 列表
export default function Sidebar({ project }: { project: Project }) {
  const { selectedSkill, setSelectedSkill, setTab } = useStore();

  const pick = (relPath: string) => {
    setSelectedSkill({ project: project.name, relPath });
    setTab("skills");
  };

  return (
    <aside className="sidebar">
      <div className="proj-group">
        <div className="proj-name">
          {project.name}
          <span className="count">{project.skills.length || "—"}</span>
        </div>
        {project.skills.map((s) => {
          const active = selectedSkill?.relPath === s.relPath;
          return (
            <button
              key={s.relPath}
              className={active ? "skill-item active" : "skill-item"}
              onClick={() => pick(s.relPath)}
              title={s.description}
            >
              {s.name}
            </button>
          );
        })}
        {!project.hasSkills && <div className="no-skill">（无 skills/）</div>}
      </div>
    </aside>
  );
}
