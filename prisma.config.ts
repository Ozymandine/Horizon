import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Use the direct connection for Prisma CLI migrations. Runtime queries use DATABASE_URL.
    url: env("DIRECT_URL"),
  },
});
