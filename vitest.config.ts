import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/domain/**/*.ts",
        "src/background/{action-state,data-change-broadcast}.ts",
        "src/content/{badge,extension-context,observation-signatures,observer-panel,periodic-rescan,process-scheduler,x-adapter}.ts",
        "src/i18n/**/*.ts",
        "src/storage/settings.ts",
        "src/ui/hooks.ts",
        "src/ui/sidepanel.tsx",
        "src/ui/sidepanel-model.ts",
      ],
    },
  },
});
