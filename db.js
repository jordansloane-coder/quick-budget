// Minimal IndexedDB wrapper — no dependencies.
// Five stores: "expenses" (line items, tagged with a tripId), "trips" (one record
// per trip — active or banked/archived), "checklist" (simple to-do items, also
// tagged with a tripId), "travelInfo" (hotel/flight/car booking details, also
// tagged with a tripId), and "meta" (device-wide settings, key/value).

const DB = (() => {
  const DB_NAME = 'quick-budget';
  const DB_VERSION = 4;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('expenses')) {
          const store = db.createObjectStore('expenses', { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('trips')) {
          db.createObjectStore('trips', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('checklist')) {
          db.createObjectStore('checklist', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('travelInfo')) {
          db.createObjectStore('travelInfo', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // If another tab is open to an older schema version, closing here lets its
        // pending upgrade proceed instead of hanging both tabs indefinitely.
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Quick Budget is open in another tab — close it there and reload here.'));
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  return {
    async getAllExpenses() {
      const store = await tx('expenses', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const rows = req.result.sort((a, b) => b.createdAt - a.createdAt);
          resolve(rows);
        };
        req.onerror = () => reject(req.error);
      });
    },

    async putExpense(expense) {
      const store = await tx('expenses', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put(expense);
        req.onsuccess = () => resolve(expense);
        req.onerror = () => reject(req.error);
      });
    },

    async deleteExpense(id) {
      const store = await tx('expenses', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },

    async clearExpenses() {
      const store = await tx('expenses', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },

    async getAllTrips() {
      const store = await tx('trips', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async putTrip(trip) {
      const store = await tx('trips', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put(trip);
        req.onsuccess = () => resolve(trip);
        req.onerror = () => reject(req.error);
      });
    },

    async deleteTrip(id) {
      const store = await tx('trips', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },

    async getAllChecklistItems() {
      const store = await tx('checklist', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async putChecklistItem(item) {
      const store = await tx('checklist', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    },

    async deleteChecklistItem(id) {
      const store = await tx('checklist', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },

    async getAllTravelInfo() {
      const store = await tx('travelInfo', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async putTravelInfo(item) {
      const store = await tx('travelInfo', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    },

    async deleteTravelInfo(id) {
      const store = await tx('travelInfo', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },

    async getMeta(key, fallback = null) {
      const store = await tx('meta', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
        req.onerror = () => reject(req.error);
      });
    },

    async setMeta(key, value) {
      const store = await tx('meta', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put({ key, value });
        req.onsuccess = () => resolve(value);
        req.onerror = () => reject(req.error);
      });
    },
  };
})();
