import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 纯前端 SPA：File System Access API 直读本地项目目录，浏览器直连 Claude API
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
});
