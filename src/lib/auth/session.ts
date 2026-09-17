import { cookies } from "next/headers";
import { getUserDb } from "@/lib/user-db";
import { SESSION_COOKIE, verifySession } from "./session-token";

export async function getSession(): Promise<{ sub: string } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}

export async function getCurrentUser(): Promise<{
  sub: string;
  nickname: string;
  tag: string;
} | null> {
  const session = await getSession();
  if (!session) return null;
  const user = getUserDb()
    .prepare("SELECT sub, nickname FROM users WHERE sub = ?")
    .get(session.sub) as { sub: string; nickname: string } | undefined;
  return user ? { ...user, tag: user.sub.slice(-5) } : null;
}
