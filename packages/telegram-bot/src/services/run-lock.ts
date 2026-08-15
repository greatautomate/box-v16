/**
 * Per-box exclusive run lock.
 *
 * Two agent runs on the same Box race its server-side conversation state (e.g.
 * a user firing two prompts quickly, or typing while a /stream is live). The
 * shared resource is the Box, so we serialize on its id.
 *
 * The lock lives in memory: Node is single-threaded, so the `has`→`add` below
 * is atomic (no await between the check and the set), giving a race-free
 * acquire. This is sufficient for a single-instance deployment (Render's
 * starter plan). If the bot is ever scaled to multiple instances, replace this
 * with a shared lock — e.g. a MongoDB `run_lock` collection with a unique index
 * on `boxId` (insert-to-acquire, delete-to-release) plus a TTL index for crash
 * recovery.
 */
// Maps a held box id to the timestamp (ms) at which the lock auto-expires.
// Synchronous runs use Infinity (released in a finally). Detached runs (async
// /task) pass a finite TTL so a lost completion webhook can't wedge the box.
const active = new Map<string, number>();

/** Whether `boxId` is currently locked, clearing the entry if it has expired. */
function isHeld(boxId: string): boolean {
  const expiresAt = active.get(boxId);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    active.delete(boxId);
    return false;
  }
  return true;
}

/**
 * Acquire the lock for `boxId`. Returns false without acquiring if a run is
 * already in progress. `ttlMs` bounds how long the lock survives without an
 * explicit {@link release} (default: forever — the caller must release it).
 */
export function tryAcquire(boxId: string, ttlMs = Infinity): boolean {
  if (isHeld(boxId)) return false;
  active.set(boxId, ttlMs === Infinity ? Infinity : Date.now() + ttlMs);
  return true;
}

/** Release the lock for `boxId` (idempotent). */
export function release(boxId: string): void {
  active.delete(boxId);
}

/** Result of {@link withBoxLock}: whether the guarded work actually ran. */
export type LockResult<T> = { ran: true; value: T } | { ran: false };

/**
 * Run `fn` while holding an exclusive lock on `boxId`. If a run is already in
 * progress for that box, returns `{ ran: false }` without invoking `fn` so the
 * caller can reject the request. The lock is released on both normal completion
 * and errors, so a failed run never wedges the box.
 */
export async function withBoxLock<T>(
  boxId: string,
  fn: () => Promise<T>,
): Promise<LockResult<T>> {
  if (!tryAcquire(boxId)) return { ran: false };
  try {
    return { ran: true, value: await fn() };
  } finally {
    release(boxId);
  }
}

/** True if a run is currently in progress for the given box. */
export function isBoxBusy(boxId: string): boolean {
  return isHeld(boxId);
}
