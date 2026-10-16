/**
 * SSR query clients belong to one render. A finite gcTime starts a timer that
 * keeps that render's cache alive after the response (even for disabled queries).
 * Infinity disables those timers so the client can be garbage collected normally.
 */
export function queryGcTime(browserGcTime: number): number {
  return typeof window === "undefined" ? Infinity : browserGcTime;
}
