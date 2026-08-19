import { useState } from "react";
import { isProfileImageUrl, visibleDisplayName } from "../../domain/identity";

export function Avatar({
  avatarUrl,
  displayName,
  handle,
}: {
  avatarUrl: string | null;
  displayName: string | null;
  handle: string;
}) {
  const [failed, setFailed] = useState(false);
  const letter = [...visibleDisplayName(displayName, handle).replace(/^@/, "") || handle][0]
    ?.toUpperCase() ?? "?";
  if (!isProfileImageUrl(avatarUrl) || failed) {
    return <span className="avatar avatar--fallback">{letter}</span>;
  }
  return (
    <img
      alt=""
      className="avatar"
      height="42"
      loading="lazy"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      src={avatarUrl}
      width="42"
    />
  );
}
