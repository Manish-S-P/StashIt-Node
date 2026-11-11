// The stash token lives in sessionStorage: it survives a page refresh,
// but is forgotten when the tab is closed. Good for shared computers.

export interface Session {
  token: string;
  title: string;
}

const KEY = 'stashit.session';
let memoryFallback: Session | null = null; // if the browser blocks storage

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : memoryFallback;
  } catch {
    return memoryFallback;
  }
}

export function saveSession(session: Session): void {
  memoryFallback = session;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable: the in-memory copy still works until a refresh.
  }
}

export function clearSession(): void {
  memoryFallback = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
