/**
 * 极简 IndexedDB 资源存储（无第三方依赖）。
 *
 * 用途：存放体积较大、不宜放进 localStorage 的二进制资源——目前是「外观」分页的背景图片。
 * localStorage 只适合小文本（约 5MB，且按 UTF-16 计费），图片必须走 IndexedDB。
 * 所有函数在 IndexedDB 不可用时安全降级（返回 null / false），由调用方给出提示。
 */
const DB_NAME = 'litepad-assets'
const DB_VERSION = 1
const STORE = 'assets'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
    req.onblocked = () => reject(new Error('indexedDB blocked'))
  })
  return dbPromise
}

/** IndexedDB 是否可用（隐私模式等场景可能不可用） */
export async function idbAvailable(): Promise<boolean> {
  try {
    await openDb()
    return true
  } catch {
    return false
  }
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = run(tx.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'))
      }),
  )
}

export async function idbPut<T>(key: string, value: T): Promise<boolean> {
  try {
    await withStore('readwrite', (store) => store.put(value, key))
    return true
  } catch {
    return false
  }
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const value = await withStore<T | undefined>('readonly', (store) => store.get(key))
    return value === undefined ? null : value
  } catch {
    return null
  }
}

export async function idbDelete(key: string): Promise<boolean> {
  try {
    await withStore('readwrite', (store) => store.delete(key))
    return true
  } catch {
    return false
  }
}
