import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  transpilePackages: ["@schedule-x/react", "@schedule-x/calendar", "@schedule-x/theme-default", "@schedule-x/event-modal", "@schedule-x/events-service", "@schedule-x/current-time"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      preact$: "preact",
      preact: "preact",
    };
    return config;
  },
};

export default config;
