async function normalizeDatabaseFile(dbFile, convertStreamTo) {
  let bufferOrStream;
  if (dbFile instanceof Blob) {
    bufferOrStream = dbFile.stream();
  } else {
    bufferOrStream = dbFile;
  }
  if (bufferOrStream instanceof ReadableStream && convertStreamTo) {
    const stream = bufferOrStream;
    const reader = stream.getReader();
    switch (convertStreamTo) {
      case "callback":
        return async () => {
          const chunk = await reader.read();
          return chunk.value;
        };
      case "buffer":
        const chunks = [];
        let streamDone = false;
        while (!streamDone) {
          const chunk = await reader.read();
          if (chunk.value)
            chunks.push(chunk.value);
          streamDone = chunk.done;
        }
        const arrayLength = chunks.reduce((length, chunk) => {
          return length + chunk.length;
        }, 0);
        const buffer = new Uint8Array(arrayLength);
        let offset = 0;
        chunks.forEach((chunk) => {
          buffer.set(chunk, offset);
          offset += chunk.length;
        });
        return buffer.buffer;
    }
  } else {
    return bufferOrStream;
  }
}
function parseDatabasePath(path) {
  const directories = path.split(/[\\/]/).filter((part) => part !== "");
  const fileName = directories.pop();
  if (!fileName) {
    throw new Error("Database path is invalid.");
  }
  const tempFileNames = ["journal", "wal", "shm"].map((ext) => `${fileName}-${ext}`);
  const getDirectoryHandle = async () => {
    let dirHandle = await navigator.storage.getDirectory();
    for (let dirName of directories)
      dirHandle = await dirHandle.getDirectoryHandle(dirName);
    return dirHandle;
  };
  return {
    directories,
    fileName,
    tempFileNames,
    getDirectoryHandle
  };
}
class SQLiteMemoryDriver {
  constructor(sqlite3InitModule) {
    Object.defineProperty(this, "sqlite3InitModule", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: sqlite3InitModule
    });
    Object.defineProperty(this, "sqlite3", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "db", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "config", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "pointers", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: []
    });
    Object.defineProperty(this, "storageType", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "memory"
    });
  }
  async init(config) {
    const { databasePath } = config;
    const flags = this.getFlags(config);
    if (!this.sqlite3InitModule) {
      const { default: sqlite3InitModule } = await import("./index-BJaUESZC.js");
      this.sqlite3InitModule = sqlite3InitModule;
    }
    if (!this.sqlite3) {
      this.sqlite3 = await this.sqlite3InitModule();
    }
    if (this.db) {
      await this.destroy();
    }
    this.db = new this.sqlite3.oo1.DB(databasePath, flags);
    this.config = config;
  }
  async exec(statement) {
    if (!this.db)
      throw new Error("Driver not initialized");
    return this.execOnDb(this.db, statement);
  }
  async execBatch(statements) {
    if (!this.db)
      throw new Error("Driver not initialized");
    const results = [];
    this.db.transaction((tx) => {
      for (let statement of statements) {
        const statementData = this.execOnDb(tx, statement);
        results.push(statementData);
      }
    });
    return results;
  }
  async isDatabasePersisted() {
    return false;
  }
  async getDatabaseSizeBytes() {
    const sizeResult = await this.exec({
      sql: `SELECT page_count * page_size AS size 
				FROM pragma_page_count(), pragma_page_size()`,
      method: "get"
    });
    const size = sizeResult?.rows?.[0];
    if (typeof size !== "number") {
      throw new Error("Failed to query database size");
    }
    return size;
  }
  async createFunction(fn) {
    if (!this.db)
      throw new Error("Driver not initialized");
    switch (fn.type) {
      case "callback":
      case "scalar":
        this.db.createFunction({
          name: fn.name,
          xFunc: (_, ...args) => fn.func(...args),
          arity: -1
        });
        break;
      case "aggregate":
        this.db.createFunction({
          name: fn.name,
          xStep: (_, ...args) => fn.func.step(...args),
          xFinal: (_, ...args) => fn.func.final(...args),
          arity: -1
        });
        break;
    }
  }
  async import(database) {
    if (!this.sqlite3 || !this.db || !this.config) {
      throw new Error("Driver not initialized");
    }
    const data = await normalizeDatabaseFile(database, "buffer");
    const dataPointer = this.sqlite3.wasm.allocFromTypedArray(data);
    this.pointers.push(dataPointer);
    const resultCode = this.sqlite3.capi.sqlite3_deserialize(this.db, "main", dataPointer, data.byteLength, data.byteLength, this.config.readOnly ? this.sqlite3.capi.SQLITE_DESERIALIZE_READONLY : this.sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE);
    this.db.checkRc(resultCode);
  }
  async export() {
    if (!this.sqlite3 || !this.db) {
      throw new Error("Driver not initialized");
    }
    return {
      name: "database.sqlite3",
      data: this.sqlite3.capi.sqlite3_js_db_export(this.db)
    };
  }
  async clear() {
  }
  async destroy() {
    this.closeDb();
    this.pointers.forEach((pointer) => this.sqlite3?.wasm.dealloc(pointer));
    this.pointers = [];
  }
  getFlags(config) {
    const { readOnly, verbose } = config;
    const parts = [readOnly === true ? "r" : "cw", verbose === true ? "t" : ""];
    return parts.join("");
  }
  execOnDb(db, statement) {
    const statementData = {
      rows: [],
      columns: []
    };
    const rows = db.exec({
      sql: statement.sql,
      bind: statement.params,
      returnValue: "resultRows",
      rowMode: "array",
      columnNames: statementData.columns
    });
    switch (statement.method) {
      case "run":
        break;
      case "get":
        statementData.rows = rows[0] ?? [];
        break;
      case "all":
      default:
        statementData.rows = rows;
        break;
    }
    return statementData;
  }
  closeDb() {
    if (this.db) {
      this.db.close();
      this.db = void 0;
    }
  }
}
class SQLiteOpfsDriver extends SQLiteMemoryDriver {
  constructor() {
    super(...arguments);
    Object.defineProperty(this, "storageType", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "opfs"
    });
  }
  async init(config) {
    const { databasePath } = config;
    const flags = this.getFlags(config);
    if (!databasePath) {
      throw new Error("No databasePath specified");
    }
    if (!this.sqlite3InitModule) {
      const { default: sqlite3InitModule } = await import("./index-BJaUESZC.js");
      this.sqlite3InitModule = sqlite3InitModule;
    }
    if (!this.sqlite3) {
      this.sqlite3 = await this.sqlite3InitModule();
    }
    if (!("opfs" in this.sqlite3)) {
      throw new Error("OPFS not available");
    }
    if (this.db) {
      await this.destroy();
    }
    this.db = new this.sqlite3.oo1.OpfsDb(databasePath, flags);
    this.config = config;
  }
  async isDatabasePersisted() {
    return navigator.storage?.persisted();
  }
  async import(database) {
    if (!this.sqlite3 || !this.config?.databasePath) {
      throw new Error("Driver not initialized");
    }
    await this.destroy();
    const data = await normalizeDatabaseFile(database, "callback");
    await this.sqlite3.oo1.OpfsDb.importDb(this.config.databasePath, data);
  }
  async export() {
    if (!this.db || !this.config?.databasePath) {
      throw new Error("Driver not initialized");
    }
    let name, data;
    const path = parseDatabasePath(this.config.databasePath);
    const { directories, getDirectoryHandle } = path;
    name = path.fileName;
    const tempFileName = `backup-${Date.now()}--${name}`;
    const tempFilePath = `${directories.join("/")}/${tempFileName}`;
    this.db.exec({ sql: "VACUUM INTO ?", bind: [tempFilePath] });
    const dirHandle = await getDirectoryHandle();
    const fileHandle = await dirHandle.getFileHandle(tempFileName);
    const file = await fileHandle.getFile();
    data = await file.arrayBuffer();
    await dirHandle.removeEntry(tempFileName);
    return { name, data };
  }
  async clear() {
    if (!this.config?.databasePath)
      throw new Error("Driver not initialized");
    await this.destroy();
    const { getDirectoryHandle, fileName, tempFileNames } = parseDatabasePath(this.config.databasePath);
    const dirHandle = await getDirectoryHandle();
    const fileNames = [fileName, ...tempFileNames];
    await Promise.all(fileNames.map(async (name) => {
      return dirHandle.removeEntry(name).catch((err) => {
        if (!(err instanceof DOMException && err.name === "NotFoundError")) {
          throw err;
        }
      });
    }));
  }
  async destroy() {
    this.closeDb();
  }
}
const FUNCTION = "function";
const CHANNEL = "64e10b34-2bf7-4616-9668-f99de5aa046e";
const GET = "get";
const HAS = "has";
const SET = "set";
const { isArray } = Array;
let { SharedArrayBuffer, window } = globalThis;
let { notify, wait, waitAsync } = Atomics;
let postPatched = null;
if (!waitAsync) {
  waitAsync = (buffer) => ({
    value: new Promise((onmessage) => {
      let w = new Worker("data:application/javascript,onmessage%3D(%7Bdata%3Ab%7D)%3D%3E(Atomics.wait(b%2C0)%2CpostMessage(0))");
      w.onmessage = onmessage;
      w.postMessage(buffer);
    })
  });
}
try {
  new SharedArrayBuffer(4);
} catch (_) {
  SharedArrayBuffer = ArrayBuffer;
  const ids = /* @__PURE__ */ new WeakMap();
  if (window) {
    const resolvers = /* @__PURE__ */ new Map();
    const { prototype: { postMessage: postMessage2 } } = Worker;
    const listener = (event) => {
      const details = event.data?.[CHANNEL];
      if (!isArray(details)) {
        event.stopImmediatePropagation();
        const { id, sb } = details;
        resolvers.get(id)(sb);
      }
    };
    postPatched = function(data, ...rest) {
      const details = data?.[CHANNEL];
      if (isArray(details)) {
        const [id, sb] = details;
        ids.set(sb, id);
        this.addEventListener("message", listener);
      }
      return postMessage2.call(this, data, ...rest);
    };
    waitAsync = (sb) => ({
      value: new Promise((resolve) => {
        resolvers.set(ids.get(sb), resolve);
      }).then((buff) => {
        resolvers.delete(ids.get(sb));
        ids.delete(sb);
        for (let i = 0; i < buff.length; i++) sb[i] = buff[i];
        return "ok";
      })
    });
  } else {
    const as = (id, sb) => ({ [CHANNEL]: { id, sb } });
    notify = (sb) => {
      postMessage(as(ids.get(sb), sb));
    };
    addEventListener("message", (event) => {
      const details = event.data?.[CHANNEL];
      if (isArray(details)) {
        const [id, sb] = details;
        ids.set(sb, id);
      }
    });
  }
}
/*! (c) Andrea Giammarchi - ISC */
const { Int32Array, Map: Map$1, Uint16Array } = globalThis;
const { BYTES_PER_ELEMENT: I32_BYTES } = Int32Array;
const { BYTES_PER_ELEMENT: UI16_BYTES } = Uint16Array;
const waitInterrupt = (sb, delay, handler) => {
  while (wait(sb, 0, 0, delay) === "timed-out")
    handler();
};
const buffers = /* @__PURE__ */ new WeakSet();
const context = /* @__PURE__ */ new WeakMap();
const syncResult = { value: { then: (fn) => fn() } };
let uid = 0;
const coincident = (self2, { parse = JSON.parse, stringify = JSON.stringify, transform, interrupt } = JSON) => {
  if (!context.has(self2)) {
    const sendMessage = postPatched || self2.postMessage;
    const post = (transfer, ...args) => sendMessage.call(self2, { [CHANNEL]: args }, { transfer });
    const handler = typeof interrupt === FUNCTION ? interrupt : interrupt?.handler;
    const delay = interrupt?.delay || 42;
    const decoder = new TextDecoder("utf-16");
    const waitFor = (isAsync, sb) => isAsync ? waitAsync(sb, 0) : (handler ? waitInterrupt(sb, delay, handler) : wait(sb, 0), syncResult);
    let seppuku = false;
    context.set(self2, new Proxy(new Map$1(), {
      // there is very little point in checking prop in proxy for this very specific case
      // and I don't want to orchestrate a whole roundtrip neither, as stuff would fail
      // regardless if from Worker we access non existent Main callback, and vice-versa.
      // This is here mostly to guarantee that if such check is performed, at least the
      // get trap goes through and then it's up to developers guarantee they are accessing
      // stuff that actually exists elsewhere.
      [HAS]: (_, action) => typeof action === "string" && !action.startsWith("_"),
      // worker related: get any utility that should be available on the main thread
      [GET]: (_, action) => action === "then" ? null : (...args) => {
        const id = uid++;
        let sb = new Int32Array(new SharedArrayBuffer(I32_BYTES * 2));
        let transfer = [];
        if (buffers.has(args.at(-1) || transfer))
          buffers.delete(transfer = args.pop());
        post(transfer, id, sb, action, transform ? args.map(transform) : args);
        const isAsync = self2 !== globalThis;
        let deadlock = 0;
        if (seppuku && isAsync)
          deadlock = setTimeout(console.warn, 1e3, `💀🔒 - Possible deadlock if proxy.${action}(...args) is awaited`);
        return waitFor(isAsync, sb).value.then(() => {
          clearTimeout(deadlock);
          const length = sb[1];
          if (!length) return;
          const bytes = UI16_BYTES * length;
          sb = new Int32Array(new SharedArrayBuffer(bytes + bytes % I32_BYTES));
          post([], id, sb);
          return waitFor(isAsync, sb).value.then(
            () => parse(
              decoder.decode(new Uint16Array(sb.buffer).slice(0, length))
            )
          );
        });
      },
      // main thread related: react to any utility a worker is asking for
      [SET](actions, action, callback) {
        const type = typeof callback;
        if (type !== FUNCTION)
          throw new Error(`Unable to assign ${action} as ${type}`);
        if (!actions.size) {
          const results = new Map$1();
          self2.addEventListener("message", async (event) => {
            const details = event.data?.[CHANNEL];
            if (isArray(details)) {
              event.stopImmediatePropagation();
              const [id, sb, ...rest] = details;
              let error;
              if (rest.length) {
                const [action2, args] = rest;
                if (actions.has(action2)) {
                  seppuku = true;
                  try {
                    const result = await actions.get(action2)(...args);
                    if (result !== void 0) {
                      const serialized = stringify(transform ? transform(result) : result);
                      results.set(id, serialized);
                      sb[1] = serialized.length;
                    }
                  } catch (_) {
                    error = _;
                  } finally {
                    seppuku = false;
                  }
                } else {
                  error = new Error(`Unsupported action: ${action2}`);
                }
                sb[0] = 1;
              } else {
                const result = results.get(id);
                results.delete(id);
                for (let ui16a = new Uint16Array(sb.buffer), i = 0; i < result.length; i++)
                  ui16a[i] = result.charCodeAt(i);
              }
              notify(sb, 0);
              if (error) throw error;
            }
          });
        }
        return !!actions.set(action, callback);
      }
    }));
  }
  return context.get(self2);
};
coincident.transfer = (...args) => (buffers.add(args), args);
function createMutex() {
  let promise;
  let resolve;
  const lock = async () => {
    while (promise) {
      await promise;
    }
    promise = new Promise((res) => {
      resolve = res;
    });
  };
  const unlock = async () => {
    const res = resolve;
    promise = void 0;
    resolve = void 0;
    res?.();
  };
  return { lock, unlock };
}
class SQLocalProcessor {
  constructor(driver2) {
    Object.defineProperty(this, "driver", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "config", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: {}
    });
    Object.defineProperty(this, "userFunctions", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: /* @__PURE__ */ new Map()
    });
    Object.defineProperty(this, "initMutex", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: createMutex()
    });
    Object.defineProperty(this, "transactionMutex", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: createMutex()
    });
    Object.defineProperty(this, "transactionKey", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: null
    });
    Object.defineProperty(this, "proxy", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "reinitChannel", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "onmessage", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "init", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: async (reason) => {
        if (!this.config.databasePath)
          return;
        await this.initMutex.lock();
        try {
          try {
            await this.driver.init(this.config);
          } catch {
            console.warn(`Persistence failed, so ${this.config.databasePath} will not be saved. For origin private file system persistence, make sure your web server is configured to use the correct HTTP response headers (See https://sqlocal.dev/guide/setup#cross-origin-isolation).`);
            this.config.databasePath = ":memory:";
            this.driver = new SQLiteMemoryDriver();
            await this.driver.init(this.config);
          }
          if (this.driver.storageType !== "memory") {
            this.reinitChannel = new BroadcastChannel(`_sqlocal_reinit_(${this.config.databasePath})`);
            this.reinitChannel.onmessage = (event) => {
              const message = event.data;
              if (this.config.clientKey === message.clientKey)
                return;
              switch (message.type) {
                case "reinit":
                  this.init(message.reason);
                  break;
                case "close":
                  this.driver.destroy();
                  break;
              }
            };
          }
          await Promise.all(Array.from(this.userFunctions.values()).map((fn) => {
            return this.initUserFunction(fn);
          }));
          await this.execInitStatements();
          this.emitMessage({ type: "event", event: "connect", reason });
        } catch (error) {
          this.emitMessage({
            type: "error",
            error,
            queryKey: null
          });
          await this.destroy();
        } finally {
          await this.initMutex.unlock();
        }
      }
    });
    Object.defineProperty(this, "postMessage", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: async (event, _transfer) => {
        const message = event instanceof MessageEvent ? event.data : event;
        await this.initMutex.lock();
        switch (message.type) {
          case "config":
            this.editConfig(message);
            break;
          case "query":
          case "batch":
          case "transaction":
            this.exec(message);
            break;
          case "function":
            this.createUserFunction(message);
            break;
          case "getinfo":
            this.getDatabaseInfo(message);
            break;
          case "import":
            this.importDb(message);
            break;
          case "export":
            this.exportDb(message);
            break;
          case "delete":
            this.deleteDb(message);
            break;
          case "destroy":
            this.destroy(message);
            break;
        }
        await this.initMutex.unlock();
      }
    });
    Object.defineProperty(this, "emitMessage", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: (message, transfer = []) => {
        if (this.onmessage) {
          this.onmessage(message, transfer);
        }
      }
    });
    Object.defineProperty(this, "editConfig", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: (message) => {
        this.config = message.config;
        this.init("initial");
      }
    });
    Object.defineProperty(this, "exec", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: async (message) => {
        try {
          const response = {
            type: "data",
            queryKey: message.queryKey,
            data: []
          };
          switch (message.type) {
            case "query":
              const partOfTransaction = this.transactionKey !== null && this.transactionKey === message.transactionKey;
              try {
                if (!partOfTransaction) {
                  await this.transactionMutex.lock();
                }
                const statementData = await this.driver.exec(message);
                response.data.push(statementData);
              } finally {
                if (!partOfTransaction) {
                  await this.transactionMutex.unlock();
                }
              }
              break;
            case "batch":
              try {
                await this.transactionMutex.lock();
                const results = await this.driver.execBatch(message.statements);
                response.data.push(...results);
              } finally {
                await this.transactionMutex.unlock();
              }
              break;
            case "transaction":
              if (message.action === "begin") {
                await this.transactionMutex.lock();
                this.transactionKey = message.transactionKey;
                await this.driver.exec({ sql: "BEGIN" });
              }
              if ((message.action === "commit" || message.action === "rollback") && this.transactionKey !== null && this.transactionKey === message.transactionKey) {
                const sql = message.action === "commit" ? "COMMIT" : "ROLLBACK";
                await this.driver.exec({ sql });
                this.transactionKey = null;
                await this.transactionMutex.unlock();
              }
              break;
          }
          this.emitMessage(response);
        } catch (error) {
          this.emitMessage({
            type: "error",
            error,
            queryKey: message.queryKey
          });
        }
      }
    });
    Object.defineProperty(this, "execInitStatements", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: async () => {
        if (this.config.onInitStatements) {
          for (let statement of this.config.onInitStatements) {
            await this.driver.exec(statement);
          }
        }
      }
    });
    Object.defineProperty(this, "getDatabaseInfo", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: async (message) => {
        try {
          this.emitMessage({
            type: "info",
            queryKey: message.queryKey,
            info: {
              databasePath: this.config.databasePath,
              storageType: this.driver.storageType,
              databaseSizeBytes: await this.driver.getDatabaseSizeBytes(),
              persisted: await this.driver.isDatabasePersisted()
            }
          });
        } catch (error) {
          this.emitMessage({
            type: "error",
            queryKey: message.queryKey,
            error
          });
        }
      }
    });
    Object.defineProperty(this, "createUserFunction", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: async (message) => {
        const { functionName: name, functionType: type, queryKey } = message;
        let fn;
        if (this.userFunctions.has(name)) {
          this.emitMessage({
            type: "error",
            error: new Error(`A user-defined function with the name "${name}" has already been created for this SQLocal instance.`),
            queryKey
          });
          return;
        }
        switch (type) {
          case "callback":
            fn = {
              type,
              name,
              func: (...args) => {
                this.emitMessage({ type: "callback", name, args });
              }
            };
            break;
          case "scalar":
            fn = {
              type,
              name,
              func: this.proxy[`_sqlocal_func_${name}`]
            };
            break;
          case "aggregate":
            fn = {
              type,
              name,
              func: {
                step: this.proxy[`_sqlocal_func_${name}_step`],
                final: this.proxy[`_sqlocal_func_${name}_final`]
              }
            };
            break;
        }
        try {
          await this.initUserFunction(fn);
          this.emitMessage({
            type: "success",
            queryKey
          });
        } catch (error) {
          this.emitMessage({
            type: "error",
            error,
            queryKey
          });
        }
      }
    });
    Object.defineProperty(this, "initUserFunction", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: async (fn) => {
        await this.driver.createFunction(fn);
        this.userFunctions.set(fn.name, fn);
      }
    });
    Object.defineProperty(this, "importDb", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: async (message) => {
        const { queryKey, database } = message;
        let errored = false;
        try {
          await this.driver.import(database);
          if (this.driver.storageType === "memory") {
            await this.execInitStatements();
          }
        } catch (error) {
          this.emitMessage({
            type: "error",
            error,
            queryKey
          });
          errored = true;
        } finally {
          if (this.driver.storageType !== "memory") {
            await this.init("overwrite");
          }
        }
        if (!errored) {
          this.emitMessage({
            type: "success",
            queryKey
          });
        }
      }
    });
    Object.defineProperty(this, "exportDb", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: async (message) => {
        const { queryKey } = message;
        try {
          const { name, data } = await this.driver.export();
          this.emitMessage({
            type: "buffer",
            queryKey,
            bufferName: name,
            buffer: data
          }, [data]);
        } catch (error) {
          this.emitMessage({
            type: "error",
            error,
            queryKey
          });
        }
      }
    });
    Object.defineProperty(this, "deleteDb", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: async (message) => {
        const { queryKey } = message;
        let errored = false;
        try {
          await this.driver.clear();
        } catch (error) {
          this.emitMessage({
            type: "error",
            error,
            queryKey
          });
          errored = true;
        } finally {
          await this.init("delete");
        }
        if (!errored) {
          this.emitMessage({
            type: "success",
            queryKey
          });
        }
      }
    });
    Object.defineProperty(this, "destroy", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: async (message) => {
        await this.driver.exec({ sql: "PRAGMA optimize" });
        await this.driver.destroy();
        if (this.reinitChannel) {
          this.reinitChannel.close();
          this.reinitChannel = void 0;
        }
        if (message) {
          this.emitMessage({
            type: "success",
            queryKey: message.queryKey
          });
        }
      }
    });
    const isInWorker = typeof WorkerGlobalScope !== "undefined" && globalThis instanceof WorkerGlobalScope;
    const proxy = isInWorker ? coincident(globalThis) : globalThis;
    this.proxy = proxy;
    this.driver = driver2;
  }
}
const driver = new SQLiteOpfsDriver();
const processor = new SQLocalProcessor(driver);
self.onmessage = (message) => {
  processor.postMessage(message);
};
processor.onmessage = (message, transfer) => {
  self.postMessage(message, transfer);
};
