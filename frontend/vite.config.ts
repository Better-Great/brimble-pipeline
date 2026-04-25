import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ command, mode }) => {
  const repoRootDir = path.resolve(__dirname, "..");
  const env = loadEnv(mode, repoRootDir, "");
  const apiUrl = env.VITE_DEV_API_URL || env.API_URL || process.env.VITE_DEV_API_URL || process.env.API_URL || "http://localhost";

  return {
    envDir: repoRootDir,
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
