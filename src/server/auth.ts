import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";

const COOKIE = "pp_session";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET ausente ou curto demais.");
  return new TextEncoder().encode(value);
}

export type Session = { id: string; role: UserRole };

export async function setSession(user: Session) {
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const verified = await jwtVerify(token, secret());
    const role = verified.payload.role;
    if (verified.payload.sub && (role === "USER" || role === "ADMIN")) {
      return { id: verified.payload.sub, role };
    }
  } catch {
    return null;
  }
  return null;
}

export async function currentUser() {
  const session = await readSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.id },
    include: { seller: true },
  });
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "E-mail inválido." as const };
  if (input.password.length < 8) return { error: "A senha precisa ter ao menos 8 caracteres." as const };
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Já existe uma conta com este e-mail." as const };
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash: await bcrypt.hash(input.password, 12),
    },
  });
  await setSession({ id: user.id, role: user.role });
  return { user };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return { error: "E-mail ou senha incorretos." as const };
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: "E-mail ou senha incorretos." as const };
  await setSession({ id: user.id, role: user.role });
  return { user };
}
