import { describe, it, expect, vi, afterEach } from "vitest";
import {
  withBoxLock,
  isBoxBusy,
  tryAcquire,
  release,
} from "../services/run-lock.js";

/** A promise plus its resolver, to control when the guarded work finishes. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("withBoxLock", () => {
  it("rejects a second run on the same box while one is in flight", async () => {
    const gate = deferred();
    const first = withBoxLock("box-1", async () => {
      await gate.promise;
      return "ok";
    });

    // Second acquire happens while `first` is still awaiting the gate.
    const second = await withBoxLock("box-1", async () => "should-not-run");
    expect(second.ran).toBe(false);
    expect(isBoxBusy("box-1")).toBe(true);

    gate.resolve();
    expect(await first).toEqual({ ran: true, value: "ok" });
  });

  it("releases the lock after the run resolves", async () => {
    const r1 = await withBoxLock("box-2", async () => 1);
    expect(r1).toEqual({ ran: true, value: 1 });
    expect(isBoxBusy("box-2")).toBe(false);

    // A later run on the same box succeeds again.
    const r2 = await withBoxLock("box-2", async () => 2);
    expect(r2).toEqual({ ran: true, value: 2 });
  });

  it("releases the lock even when the run throws", async () => {
    await expect(
      withBoxLock("box-3", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(isBoxBusy("box-3")).toBe(false);
    const after = await withBoxLock("box-3", async () => "recovered");
    expect(after).toEqual({ ran: true, value: "recovered" });
  });

  it("locks are independent across different boxes", async () => {
    const gate = deferred();
    const a = withBoxLock("box-a", async () => {
      await gate.promise;
      return "a";
    });

    // A different box is not blocked by box-a's in-flight run.
    const b = await withBoxLock("box-b", async () => "b");
    expect(b).toEqual({ ran: true, value: "b" });

    gate.resolve();
    expect(await a).toEqual({ ran: true, value: "a" });
  });
});

describe("tryAcquire / release", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks a second acquire until released", () => {
    expect(tryAcquire("acq-1")).toBe(true);
    expect(tryAcquire("acq-1")).toBe(false);
    expect(isBoxBusy("acq-1")).toBe(true);

    release("acq-1");
    expect(isBoxBusy("acq-1")).toBe(false);
    expect(tryAcquire("acq-1")).toBe(true);
    release("acq-1");
  });

  it("release is idempotent", () => {
    release("never-held"); // no throw
    expect(isBoxBusy("never-held")).toBe(false);
  });

  it("auto-expires a lock after its TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    expect(tryAcquire("ttl-1", 60_000)).toBe(true);
    expect(isBoxBusy("ttl-1")).toBe(true);

    // Just before expiry: still held, still can't re-acquire.
    vi.advanceTimersByTime(59_000);
    expect(tryAcquire("ttl-1", 60_000)).toBe(false);

    // Past expiry: the stale lock is cleared and re-acquire succeeds.
    vi.advanceTimersByTime(2_000);
    expect(isBoxBusy("ttl-1")).toBe(false);
    expect(tryAcquire("ttl-1", 60_000)).toBe(true);
    release("ttl-1");
  });
});
