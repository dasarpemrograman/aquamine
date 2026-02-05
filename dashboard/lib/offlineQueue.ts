export type AlertActionType = "acknowledge" | "resolve" | "reopen";

export type AlertActionPayload =
  | { alertId: number }
  | { alertId: number; resolution_note?: string | null };

export type OfflineQueueItem = {
  id: string;
  actionType: AlertActionType;
  payload: AlertActionPayload;
  createdAt: number;
  attempts: number;
  lastError: string | null;
};

export const OFFLINE_QUEUED_MESSAGE = "Tersimpan di perangkat • akan disinkronkan";

type QueueListener = () => void;

export type OfflineQueueState = {
  pendingCount: number;
  isOnline: boolean;
  isReplaying: boolean;
  lastReplayAt: number | null;
};

export type ReplayExecutor = (item: OfflineQueueItem) => Promise<void>;

export interface OfflineQueueStore {
  list(): Promise<OfflineQueueItem[]>;
  put(item: OfflineQueueItem): Promise<void>;
  delete(id: string): Promise<void>;
  update(id: string, patch: Partial<OfflineQueueItem>): Promise<void>;
}

function nowMs() {
  return Date.now();
}

function createId() {
  // Prefer crypto.randomUUID() but keep a deterministic-ish fallback.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `q_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function isLikelyNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException && err.name === "NetworkError") return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("failed to fetch")) return true;
    if (msg.includes("networkerror")) return true;
    if (msg.includes("load failed")) return true;
  }
  return false;
}

function truncateError(message: string, maxLen = 500) {
  if (message.length <= maxLen) return message;
  return message.slice(0, maxLen - 3) + "...";
}

function isBrowser() {
  return typeof window !== "undefined";
}

function getNavigatorOnline(): boolean {
  if (!isBrowser()) return true;
  // navigator.onLine is best-effort; treat undefined as online.
  return typeof navigator.onLine === "boolean" ? navigator.onLine : true;
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const DB_NAME = "aquamine_offline_queue";
const DB_VERSION = 1;
const STORE_NAME = "alert_actions";
const CREATED_AT_INDEX = "createdAt";

function openDb(): Promise<IDBDatabase> {
  if (!isBrowser() || typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available");
  }

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex(CREATED_AT_INDEX, "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createIndexedDbStore(): OfflineQueueStore {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const getDb = () => {
    dbPromise ??= openDb();
    return dbPromise;
  };

  async function list(): Promise<OfflineQueueItem[]> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index(CREATED_AT_INDEX);
    const items = await requestToPromise(index.getAll());
    await txDone(tx);
    return items;
  }

  async function put(item: OfflineQueueItem): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(item);
    await txDone(tx);
  }

  async function del(id: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    await txDone(tx);
  }

  async function update(id: string, patch: Partial<OfflineQueueItem>): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const existing = await requestToPromise(store.get(id));
    if (existing) {
      store.put({ ...existing, ...patch } satisfies OfflineQueueItem);
    }
    await txDone(tx);
  }

  return {
    list,
    put,
    delete: del,
    update,
  };
}

export function createInMemoryStore(initial: OfflineQueueItem[] = []): OfflineQueueStore {
  const map = new Map<string, OfflineQueueItem>();
  initial.forEach((it) => map.set(it.id, it));

  return {
    async list() {
      return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
    },
    async put(item) {
      map.set(item.id, item);
    },
    async delete(id) {
      map.delete(id);
    },
    async update(id, patch) {
      const existing = map.get(id);
      if (!existing) return;
      map.set(id, { ...existing, ...patch });
    },
  };
}

export function createOfflineQueue(store: OfflineQueueStore) {
  const listeners = new Set<QueueListener>();
  let state: OfflineQueueState = {
    pendingCount: 0,
    isOnline: getNavigatorOnline(),
    isReplaying: false,
    lastReplayAt: null,
  };

  let inited = false;
  let autoReplayStop: (() => void) | null = null;
  let replayInFlight: Promise<void> | null = null;

  function emit() {
    for (const l of listeners) l();
  }

  function setState(patch: Partial<OfflineQueueState>) {
    state = { ...state, ...patch };
    emit();
  }

  async function refreshPendingCount() {
    const items = await store.list();
    setState({ pendingCount: items.length });
  }

  async function init() {
    if (inited) return;
    inited = true;
    await refreshPendingCount();

    if (!isBrowser()) return;
    const handleOnline = () => setState({ isOnline: true });
    const handleOffline = () => setState({ isOnline: false });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    autoReplayStop = () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      autoReplayStop = null;
    };
  }

  function subscribe(listener: QueueListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getState() {
    return state;
  }

  async function enqueue(actionType: AlertActionType, payload: AlertActionPayload) {
    await init();
    const item: OfflineQueueItem = {
      id: createId(),
      actionType,
      payload,
      createdAt: nowMs(),
      attempts: 0,
      lastError: null,
    };
    await store.put(item);
    setState({ pendingCount: state.pendingCount + 1 });
    return item;
  }

  async function list() {
    await init();
    return store.list();
  }

  async function remove(id: string) {
    await init();
    await store.delete(id);
    await refreshPendingCount();
  }

  async function replay(executor: ReplayExecutor) {
    await init();

    if (replayInFlight) {
      return replayInFlight;
    }

    replayInFlight = (async () => {
      if (!getNavigatorOnline()) {
        setState({ isOnline: false });
        return;
      }

      setState({ isOnline: true, isReplaying: true });

      try {
        const items = await store.list();
        for (const item of items) {
          if (!getNavigatorOnline()) {
            setState({ isOnline: false });
            break;
          }

          await store.update(item.id, { attempts: item.attempts + 1, lastError: null });

          try {
            await executor(item);
            await store.delete(item.id);
            setState({ pendingCount: Math.max(0, state.pendingCount - 1) });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await store.update(item.id, { lastError: truncateError(message) });

            if (isLikelyNetworkError(err)) {
              // If the network is flapping, stop and wait for the next trigger.
              setState({ isOnline: getNavigatorOnline() });
              break;
            }
          }
        }
      } finally {
        setState({ isReplaying: false, lastReplayAt: nowMs() });
      }
    })().finally(() => {
      replayInFlight = null;
    });

    return replayInFlight;
  }

  function startAutoReplay(executor: ReplayExecutor, intervalMs = 20000) {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const maybeReplay = () => {
      if (!getNavigatorOnline()) return;
      if (state.pendingCount <= 0) return;
      void replay(executor);
    };

    if (isBrowser()) {
      const onOnline = () => void replay(executor);
      window.addEventListener("online", onOnline);

      intervalId = setInterval(maybeReplay, intervalMs);

      return () => {
        window.removeEventListener("online", onOnline);
        if (intervalId) clearInterval(intervalId);
      };
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }

  function stop() {
    autoReplayStop?.();
    autoReplayStop = null;
  }

  return {
    init,
    subscribe,
    getState,
    enqueue,
    list,
    remove,
    replay,
    startAutoReplay,
    stop,
  };
}

const defaultStore: OfflineQueueStore =
  isBrowser() && typeof indexedDB !== "undefined" ? createIndexedDbStore() : createInMemoryStore();

export const alertOfflineQueue = createOfflineQueue(defaultStore);
