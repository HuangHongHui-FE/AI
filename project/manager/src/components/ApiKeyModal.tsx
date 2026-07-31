import { useState } from "react";
import { useStore } from "../store";

// 填写 Claude API key，存 localStorage（仅本机）
export default function ApiKeyModal({ onClose }: { onClose: () => void }) {
  const { apiKey, setApiKey } = useStore();
  const [val, setVal] = useState(apiKey);

  const save = () => {
    setApiKey(val.trim());
    onClose();
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>配置 Claude API Key</h3>
        <p className="modal-note">
          浏览器直连 Anthropic API，key 仅存本机 localStorage，不经任何服务端（本就无后端）。
        </p>
        <input
          type="password"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="sk-ant-..."
          autoFocus
        />
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn primary" onClick={save} disabled={!val.trim()}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
