import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "DB_NOT_CONFIGURED"
  | "DB_UNREACHABLE"
  | "DB_NOT_MIGRATED"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "POOL_NOT_FOUND_ON_CHAIN"
  | "INTERNAL";

export interface Classified {
  status: number;
  code: ApiErrorCode;
  message: string;
}

/**
 * Turns whatever Prisma/Node threw into a specific, user-actionable error.
 * Never includes the connection string or password in the message.
 */
export function classifyError(err: unknown): Classified {
  if (!process.env.DATABASE_URL) {
    return {
      status: 503,
      code: "DB_NOT_CONFIGURED",
      message: "DATABASE_URL isn't set, so Meridian has no database to read from.",
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string } | null)?.code ?? "";
  const name = (err as { name?: string } | null)?.name ?? "";

  if (code === "P2021" || code === "P2022" || /does not exist in the current database/i.test(msg)) {
    return {
      status: 503,
      code: "DB_NOT_MIGRATED",
      message: "The database is reachable, but Meridian's tables haven't been created yet.",
    };
  }
  if (
    name === "PrismaClientInitializationError" ||
    ["P1000", "P1001", "P1002", "P1003", "P1008", "P1017"].includes(code) ||
    /can't reach database server|authentication failed|environment variable not found|timed out fetching a new connection/i.test(msg)
  ) {
    return {
      status: 503,
      code: "DB_UNREACHABLE",
      message: "Meridian couldn't connect to the database. The connection string or password is probably wrong.",
    };
  }
  return { status: 500, code: "INTERNAL", message: "Something went wrong on the server." };
}

/** Logs the full error server-side (visible in your terminal) and returns a safe JSON error. */
export function apiFail(err: unknown, context: string) {
  const c = classifyError(err);
  console.error(`[api:${context}] ${c.code}:`, err);
  return NextResponse.json({ error: { code: c.code, message: c.message } }, { status: c.status });
}

export function apiError(status: number, code: ApiErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
