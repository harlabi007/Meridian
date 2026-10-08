"use client";

import { ApiError } from "@/lib/api";

const DB_STEPS: Record<string, string[]> = {
  DB_NOT_CONFIGURED: [
    'Create a file named ".env" in the project\'s top folder (next to package.json).',
    'Add this line, using the Session pooler string from Supabase (Connect button): DATABASE_URL="postgresql://..."',
    "Save it, stop the server with Ctrl+C, and run npm run dev again. The .env file is only read when the server starts.",
  ],
  DB_UNREACHABLE: [
    "In Supabase, click Connect, choose Session pooler, and copy the URI again.",
    "Replace [YOUR-PASSWORD] with your real database password (letters and numbers only are safest).",
    "Save .env, stop the server with Ctrl+C, and run npm run dev again.",
  ],
  DB_NOT_MIGRATED: [
    "Stop the server with Ctrl+C.",
    "Run npm run db:push to create the tables.",
    "Run npm run dev again.",
  ],
};

export function ErrorPanel({
  error,
  onRetry,
  title,
  compact,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
}) {
  const api = error instanceof ApiError ? error : null;
  const isDb = api?.code.startsWith("DB_") ?? false;
  const heading =
    title ??
    (isDb ? "Meridian's database isn't ready" : api?.code === "NETWORK" ? "Can't reach the server" : "Something went wrong");
  const message = api?.message ?? (error instanceof Error ? error.message : "An unexpected error occurred.");
  const steps = api ? DB_STEPS[api.code] : undefined;

  return (
    <div
      role="alert"
      className={`border border-border rounded bg-panel text-left ${compact ? "p-4" : "p-6 md:p-8"} max-w-2xl mx-auto`}
    >
      <p className="text-sm font-medium mb-1.5">{heading}</p>
      <p className="text-sm text-muted leading-relaxed">{message}</p>
      {steps && (
        <ol className="mt-4 space-y-2 text-sm text-muted list-decimal pl-5 leading-relaxed">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      <div className="flex items-center gap-3 mt-5">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-amber text-white hover:bg-amberHi transition-colors"
          >
            Try again
          </button>
        )}
        {isDb && (
          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted hover:text-text underline decoration-dotted"
          >
            Run diagnostics
          </a>
        )}
      </div>
    </div>
  );
}

export function EmptyPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded bg-panel py-12 px-6 flex flex-col items-center text-center">
      <p className="text-sm font-medium mb-1.5">{title}</p>
      <p className="text-sm text-muted max-w-sm">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-panel2 border border-border rounded animate-pulse ${className}`} aria-hidden />;
}
