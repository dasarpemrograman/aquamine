import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createInMemoryStore, createOfflineQueue, isLikelyNetworkError } from "./offlineQueue";

describe("alertOfflineQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enqueues items with stable schema and updates pending count", async () => {
    const store = createInMemoryStore();
    const queue = createOfflineQueue(store);

    await queue.init();
    expect(queue.getState().pendingCount).toBe(0);

    const item = await queue.enqueue("acknowledge", { alertId: 123 });

    expect(typeof item.id).toBe("string");
    expect(item.actionType).toBe("acknowledge");
    expect(item.payload).toEqual({ alertId: 123 });
    expect(item.createdAt).toBe(Date.parse("2026-01-01T00:00:00.000Z"));
    expect(item.attempts).toBe(0);
    expect(item.lastError).toBeNull();
    expect(queue.getState().pendingCount).toBe(1);

    const listed = await queue.list();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(item.id);
  });

  it("replays items in order and removes on success", async () => {
    const store = createInMemoryStore();
    const queue = createOfflineQueue(store);
    await queue.init();

    await queue.enqueue("acknowledge", { alertId: 1 });
    vi.advanceTimersByTime(10);
    await queue.enqueue("resolve", { alertId: 2, resolution_note: "ok" });
    vi.advanceTimersByTime(10);
    await queue.enqueue("reopen", { alertId: 3 });

    const calls: number[] = [];
    await queue.replay(async (item) => {
      calls.push(item.payload.alertId);
    });

    expect(calls).toEqual([1, 2, 3]);
    expect(queue.getState().pendingCount).toBe(0);
    expect(await queue.list()).toEqual([]);
  });

  it("keeps failures in queue and increments attempts + stores lastError", async () => {
    const store = createInMemoryStore();
    const queue = createOfflineQueue(store);
    await queue.init();

    const item = await queue.enqueue("resolve", { alertId: 55, resolution_note: null });

    await queue.replay(async () => {
      throw new Error("bad request");
    });

    const listed = await queue.list();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(item.id);
    expect(listed[0].attempts).toBe(1);
    expect(listed[0].lastError).toContain("bad request");
    expect(queue.getState().pendingCount).toBe(1);

    await queue.replay(async () => {
      // succeeds now
    });

    expect(queue.getState().pendingCount).toBe(0);
    expect(await queue.list()).toEqual([]);
  });

  it("stops the replay loop on likely network errors", async () => {
    const store = createInMemoryStore();
    const queue = createOfflineQueue(store);
    await queue.init();

    await queue.enqueue("acknowledge", { alertId: 1 });
    vi.advanceTimersByTime(10);
    await queue.enqueue("acknowledge", { alertId: 2 });

    const calls: number[] = [];
    await queue.replay(async (item) => {
      calls.push(item.payload.alertId);
      throw new TypeError("Failed to fetch");
    });

    expect(calls).toEqual([1]);
    expect(queue.getState().pendingCount).toBe(2);
  });

  it("detects likely network errors from common fetch failures", () => {
    expect(isLikelyNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isLikelyNetworkError(new Error("Server returned 500"))).toBe(false);
  });
});
