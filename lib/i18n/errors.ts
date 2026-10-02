import type messages from "@/messages/en.json";
import en from "@/messages/en.json";

export type ErrorKey = keyof (typeof messages)["Errors"];

const KNOWN = new Set(Object.keys(en.Errors));

/** Narrows any error code to a translatable key ("generic" if unknown). */
export function toErrorKey(code: string | undefined | null): ErrorKey {
  return code && KNOWN.has(code) ? (code as ErrorKey) : "generic";
}
