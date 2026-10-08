import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// TEMPORARY diagnostic route — shows the real, unfiltered error instead of the generic
// "Something went wrong" message. Safe to delete once the comments bug is fixed.
export async function GET(_req: NextRequest, { params }: { params: { address: string } }) {
  const out: any = { address: params.address };
  try {
    out.poolExists = Boolean(await prisma.pool.findUnique({ where: { address: params.address } }));
  } catch (err) {
    out.poolCheckError = err instanceof Error ? err.message : String(err);
  }
  try {
    const comments = await prisma.comment.findMany({ where: { poolAddress: params.address }, take: 5 });
    out.commentQueryWorked = true;
    out.commentCount = comments.length;
  } catch (err) {
    out.commentQueryWorked = false;
    out.commentQueryError = err instanceof Error ? err.message : String(err);
    out.commentQueryErrorName = err instanceof Error ? err.name : undefined;
    out.commentQueryErrorCode = (err as any)?.code;
    out.commentQueryStack = err instanceof Error ? err.stack : undefined;
  }
  return NextResponse.json(out);
}
