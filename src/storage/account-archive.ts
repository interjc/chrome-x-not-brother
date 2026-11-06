import type { ObserverSettings } from "../domain/types";
import { normalizeViewerNamespace } from "./filter-rule-keys";
import {
  claimLegacyArchive,
  deleteHandleEverywhere,
  type NotBrotherDatabase,
  db,
} from "./database";
import { MAX_KNOWN_VIEWERS, getSettings, updateSettings } from "./settings";

/** One-time note that the 0.5.x archive was handed to an account. */
export const LEGACY_CLAIM_KEY = "notBrother.legacyArchiveClaim.v1";

export interface LegacyArchiveClaim {
  viewer: string;
  userCount: number;
  claimedAt: number;
  dismissed: boolean;
}

export function resolveViewer(
  messageViewer: string | null | undefined,
  settings: Pick<ObserverSettings, "viewerHandle">,
): string | null {
  return normalizeViewerNamespace(messageViewer) ??
    normalizeViewerNamespace(settings.viewerHandle);
}

/** Every own account to keep out of an archive, including the viewer itself. */
export function ownAccounts(
  settings: Pick<ObserverSettings, "knownViewerHandles">,
  viewer: string | null,
): string[] {
  return viewer ? [...settings.knownViewerHandles, viewer] : [...settings.knownViewerHandles];
}

/**
 * Record a signed-in X account: remember it as one of the viewer's own
 * accounts, drop it from every archive the first time it is seen, make it the
 * current account, and hand it any unclaimed 0.5.x archive.
 */
export async function adoptViewer(
  viewer: string,
  database: NotBrotherDatabase = db,
): Promise<ObserverSettings> {
  const settings = await getSettings();
  const isNew = !settings.knownViewerHandles.includes(viewer);
  const patch: Partial<ObserverSettings> = {};
  if (isNew) {
    patch.knownViewerHandles = [...settings.knownViewerHandles, viewer].slice(-MAX_KNOWN_VIEWERS);
  }
  if (settings.viewerHandle !== viewer) patch.viewerHandle = viewer;
  const next = Object.keys(patch).length > 0 ? await updateSettings(patch) : settings;
  if (isNew) await deleteHandleEverywhere(viewer, database);
  const claimed = await claimLegacyArchive(viewer, next.knownViewerHandles, database);
  if (claimed > 0) {
    await chrome.storage.local.set({
      [LEGACY_CLAIM_KEY]: {
        viewer,
        userCount: claimed,
        claimedAt: Date.now(),
        dismissed: false,
      } satisfies LegacyArchiveClaim,
    });
  }
  return next;
}

export async function getLegacyClaim(): Promise<LegacyArchiveClaim | null> {
  const items = await chrome.storage.local.get(LEGACY_CLAIM_KEY);
  const value = items[LEGACY_CLAIM_KEY] as Partial<LegacyArchiveClaim> | undefined;
  if (
    !value ||
    typeof value.viewer !== "string" ||
    typeof value.userCount !== "number" ||
    typeof value.claimedAt !== "number"
  ) return null;
  return {
    viewer: value.viewer,
    userCount: value.userCount,
    claimedAt: value.claimedAt,
    dismissed: value.dismissed === true,
  };
}

export async function dismissLegacyClaim(): Promise<void> {
  const claim = await getLegacyClaim();
  if (!claim) return;
  await chrome.storage.local.set({ [LEGACY_CLAIM_KEY]: { ...claim, dismissed: true } });
}
