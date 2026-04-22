import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ command, mode }) => {
  const repoRootDir = path.resolve(__dirname, "..");
  const env = loadEnv(mode, repoRootDir, "");
  const apiUrl = env.API_URL || process.env.API_URL || "";
  if (command === "serve" && !apiUrl) {
    throw new Error(
      "API_URL is required for `vite dev` (set it in the repo root `.env`, copied from `.env.example`).",
    );
  }

  return {
    envDir: repoRootDir,
    plugins: [react()],
    server: {
      port: 5173,
      ...(apiUrl
        ? {
            proxy: {
              "/api": {
                target: apiUrl,
                changeOrigin: true,
              },
            },
          }
        : {}),
    },
  };
});
