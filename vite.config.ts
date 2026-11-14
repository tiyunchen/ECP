import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target =
    env.VITE_API_BASE_URL ||
    "https://licensing-affect-sitemap-astrology.trycloudflare.com";
  return {
    // 子路径部署时让脚本、样式、路由与接口共用同一访问前缀。
    base: env.VITE_BASE_PATH || "/",
    plugins: [react()],
    // 本地同源代理避免浏览器跨域，生产部署也需要把 /api 代理到此服务。
    server: {
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    preview: {
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
