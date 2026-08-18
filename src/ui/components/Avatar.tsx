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
  return (
    <img
      alt=""
      className="avatar"
      height="42"
      loading="lazy"
      referrerPolicy="no-referrer"
      src={avatarUrl}
      width="42"
    />
  );
}
