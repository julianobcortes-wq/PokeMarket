import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve(process.cwd(), ".env");
for (const line of readFileSync(file, "utf8").split("\n")) {
  const match = line.match(/^([^#=\s]+)=(.*)$/);
  if (match && process.env[match[1]] == null) process.env[match[1]] = match[2];
}
