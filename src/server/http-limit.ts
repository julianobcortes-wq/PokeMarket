import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "./access";

const COOKIE = "pp_rl";

/** Limits by a cookie we set, plus a shared ceiling. The client-supplied forwarding header is ignored. */
export function consumeRateLimit(request: NextRequest, scope: string, limit = 60): { ok: boolean; token?: string } {
  const existing = request.cookies.get(COOKIE)?.value;
  const valid = Boolean(existing && /^[a-f0-9]{32}$/.test(existing));
  const token = valid ? existing! : randomBytes(16).toString("hex");
  const personal = rateLimit(`${scope}:${token}`, limit);
  const ceiling = rateLimit(`${scope}:all`, Math.max(limit * 40, 800));
  return { ok: personal && ceiling, token: valid ? undefined : token };
}

export function withRateLimit(response: NextResponse, token?: string) {
  if (token) {
    response.cookies.set(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
  }
  return response;
}
