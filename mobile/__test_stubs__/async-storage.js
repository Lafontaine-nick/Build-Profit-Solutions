const store = new Map();

const AsyncStorage = {
  async getItem(key) {
    return store.has(key) ? store.get(key) : null;
  },
  async setItem(key, value) {
    store.set(key, String(value));
  },
  async removeItem(key) {
    store.delete(key);
  },
  async clear() {
    store.clear();
  },
  async multiGet(keys) {
    return keys.map((key) => [key, store.has(key) ? store.get(key) : null]);
  },
  async multiSet(entries) {
    for (const [key, value] of entries) {
      store.set(key, String(value));
    }
  },
  async multiRemove(keys) {
    for (const key of keys) {
      store.delete(key);
    }
  },
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
