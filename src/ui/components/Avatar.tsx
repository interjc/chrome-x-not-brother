export function Avatar({
  avatarUrl,
  displayName,
  handle,
}: {
  avatarUrl: string | null;
  displayName: string | null;
  handle: string;
}) {
  const letter = (displayName ?? handle).slice(0, 1).toUpperCase();
  if (!avatarUrl) return <span className="avatar avatar--fallback">{letter}</span>;
  return <img className="avatar" src={avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />;
}

