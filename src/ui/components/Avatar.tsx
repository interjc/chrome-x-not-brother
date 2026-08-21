import { useEffect, useState } from "react";
import { handleAvatarUrl, isProfileImageUrl, visibleDisplayName } from "../../domain/identity";

export function Avatar({
  avatarUrl,
  displayName,
  handle,
}: {
  avatarUrl: string | null;
  displayName: string | null;
  handle: string;
}) {
  const constructed = handleAvatarUrl(handle);
  const stored = isProfileImageUrl(avatarUrl) ? avatarUrl : null;
  const [mode, setMode] = useState<"constructed" | "stored" | "fallback">("constructed");

  useEffect(() => {
    setMode("constructed");
  }, [handle, stored]);

  const letter = [...visibleDisplayName(displayName, handle).replace(/^@/, "") || handle][0]
    ?.toUpperCase() ?? "?";

  if (mode === "fallback") {
    return <span className="avatar avatar--fallback">{letter}</span>;
  }

  const src = mode === "constructed" ? constructed : stored;
  if (!src) {
    return <span className="avatar avatar--fallback">{letter}</span>;
  }

  return (
    <img
      alt=""
      className="avatar"
      height="42"
      loading="lazy"
      onError={() => {
        if (mode === "constructed" && stored) setMode("stored");
        else setMode("fallback");
      }}
      referrerPolicy="no-referrer"
      src={src}
      width="42"
    />
  );
}
