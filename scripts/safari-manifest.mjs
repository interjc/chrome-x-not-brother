// Derive the Safari manifest from the Chrome one. Safari has no side panel,
// so the same page opens as the toolbar popup; everything else is shared.
export const SAFARI_MIN_VERSION = "18.4";
export const SAFARI_POPUP = "popup.html";

export function toSafariManifest(chromeManifest) {
  const {
    side_panel: _sidePanel,
    minimum_chrome_version: _minimumChromeVersion,
    ...rest
  } = structuredClone(chromeManifest);
  return {
    ...rest,
    permissions: (rest.permissions ?? []).filter((permission) => permission !== "sidePanel"),
    action: { ...rest.action, default_popup: SAFARI_POPUP },
    browser_specific_settings: {
      ...rest.browser_specific_settings,
      safari: { strict_min_version: SAFARI_MIN_VERSION },
    },
  };
}
