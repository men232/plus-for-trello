let _storage = {};

globalThis.localStorage = {
  async refresh() {
    const keys = await chrome.storage.local.getKeys();

    for (const key of keys) {
      const value = await chrome.storage.local.get(key);
      _storage[key] = value;
    }
  },

  clear() {
    _storage = {};
    chrome.storage.local.clear().catch((error) => {
      console.warn("Failed to clear local storage", { error });
    });
  },

  removeItem(key) {
    delete _storage[key];
    chrome.storage.local.remove(key).catch((error) => {
      console.warn("Failed to remove item local storage", { error });
    });
  },

  setItem(key, value) {
    _storage[key] = JSON.parse(JSON.stringify(value));

    chrome.storage.local.set({ key, value }).catch((error) => {
      console.warn("Failed to save into local storage", {
        key,
        value,
        error,
      });
    });
  },
  getItem(key) {
    let value = _storage[key];

    if (value !== undefined) {
      value = JSON.parse(JSON.stringify(value));
    }

    return value;
  },
};

// (function createChromeAPIWrapper() {
//   // Create a fake chrome.runtime.onInstalled that works with message passing
//   if (!globalThis.chrome) globalThis.chrome = {};
//   if (!globalThis.chrome.runtime) globalThis.chrome.runtime = {};

//   let listenersMap = {};

//   const addListener = (name, fn) => {
//     if (!listenersMap[name]) listenersMap[name] = [];
//     listenersMap[name].push(fn);
//   };

//   globalThis.chrome.runtime.onInstalled = {
//     addListener: addListener.bind(null, "onInstalled"),
//   };

//   globalThis.chrome.runtime.onUpdateAvailable = {
//     addListener: addListener.bind(null, "onUpdateAvailable"),
//   };

//   // Listen for the installation message and trigger the callback
//   chrome.runtime.onMessage.addListener((message) => {
//     if (message.target !== "offscreen") return;

//     const fns = listenersMap[message.action];

//     console.info("Received:", { message, fns });

//     if (!fns) return;

//     for (const fn of fns) {
//       fn(message.details);
//     }
//   });
// })();
