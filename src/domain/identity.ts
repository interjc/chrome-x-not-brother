const PUNCTUATION_ONLY = /^[\p{P}\p{S}\s·•‧∙⋅]+$/u;
const PROFILE_IMAGE_PATTERN =
  /(?:pbs|abs)\.twimg\.com\/(?:profile_images|sticky\/default_profile_images)\//i;

export function isUsableDisplayName(
  value: string | null | undefined,
  _handle: string,
): value is string {
  const text = value?.normalize("NFKC").trim() ?? "";
  if (!text || text.length > 80) return false;
  if (text.startsWith("@")) return false;
  if (PUNCTUATION_ONLY.test(text)) return false;
  return true;
}

export function visibleDisplayName(displayName: string | null, handle: string): string {
  return isUsableDisplayName(displayName, handle) ? displayName : `@${handle}`;
}

export function isProfileImageUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value, "https://x.com");
    return url.protocol === "https:" && PROFILE_IMAGE_PATTERN.test(url.href);
  } catch {
    return false;
  }
}

export function normalizeProfileImageUrl(value: string | null | undefined): string | null {
  if (!isProfileImageUrl(value)) return null;
  return value.replace(/_(?:normal|mini)(\.(?:jpg|jpeg|png|webp))(?:\?.*)?$/i, "_x96$1");
}

export function preferDisplayName(
  incoming: string | null,
  existing: string | null,
  handle: string,
): string | null {
  if (isUsableDisplayName(incoming, handle)) return incoming;
  if (isUsableDisplayName(existing, handle)) return existing;
  return null;
}

export function preferAvatarUrl(incoming: string | null, existing: string | null): string | null {
  return normalizeProfileImageUrl(incoming) ?? normalizeProfileImageUrl(existing);
}
