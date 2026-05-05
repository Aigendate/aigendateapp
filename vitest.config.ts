import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
  },
  resolve: {
    alias: {
      "~": new URL("./app", import.meta.url).pathname,
    },
  },
});
