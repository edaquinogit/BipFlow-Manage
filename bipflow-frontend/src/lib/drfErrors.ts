import type { AxiosError } from "axios";

/**
 * Turns DRF validation payloads into a single human-readable line for UI / logs.
 */
export function formatDrfErrorPayload(data: unknown): string {
  if (data == null) return "Unknown validation error";

  if (typeof data === "string") return data;

  if (typeof data === "object" && data !== null && "detail" in data) {
    const d = (data as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("; ");
    }
    if (typeof d === "object" && d !== null) {
      return JSON.stringify(d);
    }
  }

  if (typeof data === "object" && data !== null) {
    const parts: string[] = [];
    for (const [field, messages] of Object.entries(data as Record<string, unknown>)) {
      if (field === "detail") continue;
      if (Array.isArray(messages)) {
        const text = messages
          .map((m) => (typeof m === "string" ? m : JSON.stringify(m)))
          .join("; ");
        parts.push(`${field}: ${text}`);
      } else if (typeof messages === "string") {
        parts.push(`${field}: ${messages}`);
      } else if (messages != null) {
        parts.push(`${field}: ${JSON.stringify(messages)}`);
      }
    }
    if (parts.length > 0) return parts.join(" | ");
  }

  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

export function isAxiosError(err: unknown): err is AxiosError<unknown> {
  return (
    typeof err === "object" &&
    err !== null &&
    "isAxiosError" in err &&
    (err as AxiosError).isAxiosError === true
  );
}
