import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n")) {
  const match = line.match(/^([^#=\s]+)=(.*)$/);
  if (match && process.env[match[1]] == null) process.env[match[1]] = match[2];
}

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
});
