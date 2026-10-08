"use client";

import { useState } from "react";

export function TokenAvatar({
  symbol,
  imageUrl,
  size = 36,
}: {
  symbol: string;
  imageUrl?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageUrl) && /^(https:\/\/|data:image\/)/i.test(imageUrl ?? "") && !failed;
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded bg-panel2 border border-border overflow-hidden flex items-center justify-center text-sm font-semibold text-amber shrink-0"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl!}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        symbol.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}
