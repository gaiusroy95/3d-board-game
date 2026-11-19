import path from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@domain": path.resolve(rootDir, "src/domain"),
      "@app": path.resolve(rootDir, "src/app"),
      "@render": path.resolve(rootDir, "src/render"),
      "@interfaces": path.resolve(rootDir, "src/interfaces"),
      "@net": path.resolve(rootDir, "src/net"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
