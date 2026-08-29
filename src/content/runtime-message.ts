import { isExtensionContextInvalidated } from "./extension-context";

const DEFAULT_RETRY_DELAYS_MS = [40, 120] as const;

export interface SendRuntimeMessageOptions {
  retries?: number;
  delaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
}

export function isTransientRuntimeMessageError(error: unknown): boolean {
  if (isExtensionContextInvalidated(error)) return false;
  const text = error instanceof Error ? error.message : String(error);
  return /message (?:port|channel) closed/i.test(text) ||
    /asynchronous response/i.test(text) ||
    /receiving end does not exist/i.test(text);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function sendRuntimeMessage<T>(
  message: unknown,
  options: SendRuntimeMessageOptions = {},
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRY_DELAYS_MS.length;
  const delaysMs = options.delaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await chrome.runtime.sendMessage(message) as T;
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isTransientRuntimeMessageError(error)) {
        throw error;
      }
      await sleep(delaysMs[Math.min(attempt, delaysMs.length - 1)] ?? 40);
    }
  }
  throw lastError;
}
