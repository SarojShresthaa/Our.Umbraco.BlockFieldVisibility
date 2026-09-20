import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: resolve(__dirname, "../wwwroot"),
    emptyOutDir: false,
    // Keep workspaceContext `api` exports (Rollup otherwise drops unused classes).
    rollupOptions: {
      treeshake: false,
      input: {
        "block-list-field-visibility-workspace-view": resolve(
          __dirname,
          "src/views/block-list-field-visibility-workspace-view.element.ts",
        ),
      },
      external: [/^@umbraco-cms\//],
      output: {
        entryFileNames: "[name].js",
        format: "es",
      },
    },
  },
});
