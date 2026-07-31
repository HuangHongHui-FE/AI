import { create } from "zustand";

// 全局状态：根目录 handle、API key、当前 tab、当前选中的项目/skill、运行输出
interface AppState {
  root: FileSystemDirectoryHandle | null;
  rootName: string;
  setRoot: (h: FileSystemDirectoryHandle | null) => void;

  apiKey: string;
  model: string;
  setApiKey: (k: string) => void;
  setModel: (m: string) => void;

  tab: "skills" | "run" | "history" | "config";
  setTab: (t: AppState["tab"]) => void;

  // 跨组件预填执行目标：在 SkillView 点「执行」后写入，SkillRunner 读取
  runTarget: { project: string; relPath: string; skillName: string } | null;
  setRunTarget: (t: AppState["runTarget"]) => void;

  // 当前选中的 skill（Sidebar 点选 → SkillView/SkillRunner 共享）
  selectedSkill: { project: string; relPath: string } | null;
  setSelectedSkill: (s: AppState["selectedSkill"]) => void;

  // API Key 弹窗开关
  needApiKey: boolean;
  setNeedApiKey: (v: boolean) => void;

  // 当前选中的项目（顶部 select 统一切换，各 tab 联动）
  currentProject: string;
  setCurrentProject: (p: string) => void;
}

// API key 与 model 持久化到 localStorage
const LS_KEY = "anthropic_api_key";
const LS_MODEL = "anthropic_model";

export const useStore = create<AppState>((set) => ({
  root: null,
  rootName: "",
  setRoot: (h) => set({ root: h, rootName: h?.name ?? "" }),

  apiKey: localStorage.getItem(LS_KEY) ?? "",
  model: localStorage.getItem(LS_MODEL) ?? "claude-sonnet-4-6",
  setApiKey: (k) => {
    localStorage.setItem(LS_KEY, k);
    set({ apiKey: k });
  },
  setModel: (m) => {
    localStorage.setItem(LS_MODEL, m);
    set({ model: m });
  },

  tab: "skills",
  setTab: (tab) => set({ tab }),

  runTarget: null,
  setRunTarget: (runTarget) => set({ runTarget }),

  selectedSkill: null,
  setSelectedSkill: (selectedSkill) => set({ selectedSkill }),

  needApiKey: false,
  setNeedApiKey: (needApiKey) => set({ needApiKey }),

  currentProject: "",
  setCurrentProject: (currentProject) => set({ currentProject }),
}));
