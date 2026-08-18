export function hasExtensionContext(): boolean {
  return typeof chrome !== "undefined" &&
    typeof chrome.runtime?.id === "string" &&
    Boolean(chrome.storage?.local);
}

export function isExtensionContextInvalidated(error: unknown): boolean {
  if (!hasExtensionContext()) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /extension context invalidated/i.test(message) ||
    /cannot read properties of undefined \(reading ['"]local['"]\)/i.test(message);
}
