"use client";

/**
 * These pages are "use client" but Next still renders them once on the server before
 * hydration (and on any hard load/refresh), where `localStorage` doesn't exist. Every
 * export here guards against that instead of throwing, since several pages call these
 * synchronously in the render body rather than inside an effect.
 */
const isBrowser = typeof window !== "undefined";

/** Per-device identity, minted once and stored locally. Never a login. */
export function getDeviceId(): string {
  if (!isBrowser) return "";
  const key = "tonight_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function getPairId(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem("tonight_pair_id");
}

export function setPairId(id: string) {
  if (!isBrowser) return;
  localStorage.setItem("tonight_pair_id", id);
}

export function getMyPartnerRole(code: string): "a" | "b" | null {
  if (!isBrowser) return null;
  return localStorage.getItem(`tonight_role_${code}`) as "a" | "b" | null;
}

export function setMyPartnerRole(code: string, role: "a" | "b") {
  if (!isBrowser) return;
  localStorage.setItem(`tonight_role_${code}`, role);
}
