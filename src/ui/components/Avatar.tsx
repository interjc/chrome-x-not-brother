import { useState } from "react";
import { handleAvatarUrl, normalizeProfileImageUrl } from "../../domain/identity";

export function Avatar({
  avatarUrl,
  handle,
}: {
  avatarUrl: string | null;
  handle: string;
}) {
  const observed = normalizeProfileImageUrl(avatarUrl);
  const constructed = handleAvatarUrl(handle);
  const sources = observed ? [observed, constructed] : [constructed];
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(() => new Set());
  const src = sources.find((candidate) => !failedUrls.has(candidate));
  const letter = [...handle.trim()][0]?.toUpperCase() ?? "?";

  if (!src) {
    return <span className="avatar avatar--fallback">{letter}</span>;
  }

  return (
    <img
      alt=""
      className="avatar"
      height="42"
      key={src}
      loading="lazy"
      onError={() => {
        setFailedUrls((current) => {
          if (current.has(src)) return current;
          const next = new Set(current);
          next.add(src);
          return next;
        });
      }}
      referrerPolicy="no-referrer"
      src={src}
      width="42"
    />
  );
}
