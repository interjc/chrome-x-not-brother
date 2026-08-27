import { z } from "zod";
import {
  MAX_FILTER_RULES_JSON_BYTES,
  parseFilterRuleSetJson,
  type FilterRuleSet,
} from "./filter-rules";

const GIST_API_ORIGIN = "https://api.github.com";
const GIST_RAW_ORIGIN = "https://gist.githubusercontent.com";
const MAX_GIST_API_BYTES = MAX_FILTER_RULES_JSON_BYTES + 256 * 1024;
const DEFAULT_FETCH_TIMEOUT_MS = 12_000;

export type FilterRuleImportErrorCode =
  | "invalid-url"
  | "permission-denied"
  | "request-failed"
  | "response-too-large"
  | "gist-file-ambiguous"
  | "gist-file-missing"
  | "invalid-rules";

export class FilterRuleImportError extends Error {
  constructor(readonly code: FilterRuleImportErrorCode, message: string) {
    super(message);
    this.name = "FilterRuleImportError";
  }
}

export interface FilterRuleImportTarget {
  kind: "gist" | "json";
  requestUrl: string;
  permissionOrigins: string[];
}

function hostPermissionOrigin(url: URL): string {
  return `${url.protocol}//${url.hostname}/*`;
}

function gistIdFromUrl(url: URL): string | null {
  if (url.hostname === "api.github.com") {
    const match = url.pathname.match(/^\/gists\/([a-f0-9]+)\/?$/i);
    return match?.[1] ?? null;
  }
  if (url.hostname !== "gist.github.com") return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const candidate = segments.length === 1 ? segments[0] ?? "" : segments[1] ?? "";
  return /^[a-f0-9]{5,}$/i.test(candidate) ? candidate : null;
}

export function resolveFilterRuleImportTarget(value: string): FilterRuleImportTarget {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new FilterRuleImportError("invalid-url", "Enter a valid HTTPS URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new FilterRuleImportError("invalid-url", "Only public HTTPS URLs are supported.");
  }

  const gistId = gistIdFromUrl(url);
  if (gistId) {
    return {
      kind: "gist",
      requestUrl: `${GIST_API_ORIGIN}/gists/${gistId}`,
      permissionOrigins: [`${GIST_API_ORIGIN}/*`, `${GIST_RAW_ORIGIN}/*`],
    };
  }
  return {
    kind: "json",
    requestUrl: url.href,
    permissionOrigins: [hostPermissionOrigin(url)],
  };
}

const gistFileSchema = z.object({
  filename: z.string(),
  raw_url: z.string().url(),
  size: z.number().nonnegative(),
  truncated: z.boolean().optional().default(false),
  content: z.string().optional(),
}).passthrough();

const gistResponseSchema = z.object({
  files: z.record(z.string(), gistFileSchema),
}).passthrough();

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new FilterRuleImportError("response-too-large", "The remote file is too large.");
  }
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new FilterRuleImportError("response-too-large", "The remote file is too large.");
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new FilterRuleImportError("response-too-large", "The remote file is too large.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function fetchText(
  url: string,
  maxBytes: number,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
  headers?: HeadersInit,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      cache: "no-store",
      credentials: "omit",
      ...(headers ? { headers } : {}),
      redirect: "error",
      signal,
    });
  } catch (error) {
    if (error instanceof FilterRuleImportError) throw error;
    throw new FilterRuleImportError("request-failed", "Could not load the remote rule file.");
  }
  if (!response.ok) {
    throw new FilterRuleImportError(
      "request-failed",
      `The remote server returned HTTP ${response.status}.`,
    );
  }
  return readResponseText(response, maxBytes);
}

function selectedGistFile(
  files: Record<string, z.infer<typeof gistFileSchema>>,
): z.infer<typeof gistFileSchema> {
  const all = Object.values(files);
  const json = all.filter((file) => file.filename.toLowerCase().endsWith(".json"));
  if (json.length === 1) return json[0]!;
  if (json.length > 1) {
    throw new FilterRuleImportError(
      "gist-file-ambiguous",
      "This Gist contains more than one JSON file. Use a raw file URL.",
    );
  }
  if (all.length === 1) return all[0]!;
  throw new FilterRuleImportError("gist-file-missing", "This Gist has no rule JSON file.");
}

function parseImportedRules(text: string): FilterRuleSet {
  try {
    return parseFilterRuleSetJson(text);
  } catch {
    throw new FilterRuleImportError("invalid-rules", "The file is not a valid rule set.");
  }
}

export async function fetchFilterRuleSet(
  target: FilterRuleImportTarget,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<FilterRuleSet> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
  );
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    if (target.kind === "json") {
      return parseImportedRules(await fetchText(
        target.requestUrl,
        MAX_FILTER_RULES_JSON_BYTES,
        fetchImpl,
        controller.signal,
      ));
    }

    const gistText = await fetchText(
      target.requestUrl,
      MAX_GIST_API_BYTES,
      fetchImpl,
      controller.signal,
      { Accept: "application/vnd.github+json" },
    );
    let gistValue: unknown;
    try {
      gistValue = JSON.parse(gistText) as unknown;
    } catch {
      throw new FilterRuleImportError("request-failed", "GitHub returned an invalid response.");
    }
    const gist = gistResponseSchema.safeParse(gistValue);
    if (!gist.success) {
      throw new FilterRuleImportError("request-failed", "GitHub returned an invalid response.");
    }
    const file = selectedGistFile(gist.data.files);
    if (file.size > MAX_FILTER_RULES_JSON_BYTES) {
      throw new FilterRuleImportError("response-too-large", "The Gist file is too large.");
    }
    if (!file.truncated && file.content !== undefined) return parseImportedRules(file.content);

    const rawUrl = new URL(file.raw_url);
    if (rawUrl.protocol !== "https:" || rawUrl.origin !== GIST_RAW_ORIGIN) {
      throw new FilterRuleImportError("request-failed", "GitHub returned an unsafe raw file URL.");
    }
    return parseImportedRules(await fetchText(
      rawUrl.href,
      MAX_FILTER_RULES_JSON_BYTES,
      fetchImpl,
      controller.signal,
    ));
  } finally {
    clearTimeout(timer);
  }
}
