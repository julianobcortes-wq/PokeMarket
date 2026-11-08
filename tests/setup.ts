import { readFileSync } from "fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const match = line.match(/^([^#=\s]+)=(.*)$/);
  if (match && process.env[match[1]] == null) process.env[match[1]] = match[2];
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.AUTH_SECRET ||= "test-only-pokeplace-auth-secret-32b";
process.env.TAX_ID_KEY ||= "test-only-tax-key";
process.env.SANDBOX_COMMERCE = "1";
