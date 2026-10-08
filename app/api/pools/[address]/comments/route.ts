import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiFail } from "@/lib/apiError";
import { commentMessage } from "@/lib/messages";
import { verifyWalletSignature } from "@/lib/verify";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { address: string } }) {
  try {
    const comments = await prisma.comment.findMany({
      where: { poolAddress: params.address },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({
      comments: comments.map((c) => ({ id: c.id, author: c.author, body: c.body, createdAt: c.createdAt.toISOString() })),
    });
  } catch (err) {
    return apiFail(err, "comments:GET");
  }
}

const postSchema = z.object({
  author: z.string(),
  body: z.string().trim().min(1).max(500),
  timestamp: z.number(),
  signature: z.string().min(1),
});

/** Posting requires a signed message, so a comment's author is provably that wallet, not a spoofed address. */
export async function POST(req: NextRequest, { params }: { params: { address: string } }) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "BAD_REQUEST", "Request body must be JSON.");
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(400, "BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid comment.");
  }
  const { author, body, timestamp, signature } = parsed.data;

  if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    return apiError(400, "BAD_REQUEST", "The signature has expired. Please sign again.");
  }
  let pk: PublicKey;
  try {
    pk = new PublicKey(author);
  } catch {
    return apiError(400, "BAD_REQUEST", "Invalid wallet address.");
  }
  if (!verifyWalletSignature(pk, commentMessage(params.address, body, timestamp), signature)) {
    return apiError(403, "FORBIDDEN", "The wallet signature didn't verify.");
  }

  try {
    const pool = await prisma.pool.findUnique({ where: { address: params.address }, select: { address: true } });
    if (!pool) return apiError(404, "NOT_FOUND", "Pool not found.");

    const comment = await prisma.comment.create({ data: { poolAddress: params.address, author, body } });
    return NextResponse.json({ comment: { id: comment.id, author, body, createdAt: comment.createdAt.toISOString() } });
  } catch (err) {
    return apiFail(err, "comments:POST");
  }
}
