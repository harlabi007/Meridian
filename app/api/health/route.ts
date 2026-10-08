import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { classifyError } from "@/lib/apiError";
import { CLUSTER, RPC_ENDPOINT, getConnection } from "@/lib/solana";

export const dynamic = "force-dynamic";

/** Open http://localhost:3000/api/health to see exactly which part of the setup is failing. */
export async function GET() {
  const report = {
    ok: false,
    cluster: CLUSTER,
    rpcHost: new URL(RPC_ENDPOINT).host,
    checks: {
      databaseUrlSet: Boolean(process.env.DATABASE_URL),
      databaseReachable: false,
      tablesExist: false,
      rpcReachable: false,
    },
    poolCount: null as number | null,
    problems: [] as { code: string; message: string; fix: string }[],
  };

  if (!report.checks.databaseUrlSet) {
    report.problems.push({
      code: "DB_NOT_CONFIGURED",
      message: "DATABASE_URL is not set.",
      fix: 'Create a file named ".env" in the project folder containing DATABASE_URL="<your Supabase Session pooler string>", then restart `npm run dev`.',
    });
  } else {
    try {
      await prisma.$queryRaw`SELECT 1`;
      report.checks.databaseReachable = true;
      try {
        report.poolCount = await prisma.pool.count();
        report.checks.tablesExist = true;
      } catch (err) {
        const c = classifyError(err);
        report.problems.push({ code: c.code, message: c.message, fix: "Stop the server and run `npm run db:push`, then start it again." });
      }
    } catch (err) {
      const c = classifyError(err);
      report.problems.push({
        code: c.code,
        message: c.message,
        fix: "In Supabase open Connect -> Session pooler, copy the URI, replace [YOUR-PASSWORD] with your real database password, save it in .env, and restart `npm run dev`.",
      });
    }
  }

  try {
    await getConnection().getLatestBlockhash();
    report.checks.rpcReachable = true;
  } catch {
    report.problems.push({
      code: "RPC_UNREACHABLE",
      message: `Couldn't reach the Solana RPC (${report.rpcHost}).`,
      fix: "Check your internet connection, or set NEXT_PUBLIC_RPC_ENDPOINT in .env to a different devnet RPC.",
    });
  }

  report.ok = report.problems.length === 0;
  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
