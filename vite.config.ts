import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@domain": path.resolve(rootDir, "src/domain"),
      "@app": path.resolve(rootDir, "src/app"),
      "@render": path.resolve(rootDir, "src/render"),
      "@interfaces": path.resolve(rootDir, "src/interfaces"),
      "@net": path.resolve(rootDir, "src/net"),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
