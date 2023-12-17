import { createExecutor } from "./createExecutor.mjs";
import { createTransaction } from "./createTransaction.mjs";
import { queueJob } from "./scheduler.mjs";
import { SQLocal } from "./sqlocal/index.js";

const getSystemValue = async (client, key) => {
  const { rows } = await client.exec("SELECT value FROM _sysdata WHERE key=?", [
    key,
  ]);

  return rows?.[0]?.[0];
};

const setSystemValue = async (client, key, value) => {
  await client.exec(
    `INSERT OR REPLACE INTO _sysdata (key,value) VALUES (?,?)`,
    [key, value]
  );
};

const setupSystemStorage = async (client) => {
  await client.exec(
    `CREATE TABLE IF NOT EXISTS _sysdata (
    key TEXT PRIMARY KEY  NOT NULL,
    value TEXT NOT NULL
  )`,
    [],
    "all"
  );
};

/**
 * @typedef {import('./sqlite-wasm').Database} Database
 */

window.openDatabase = async (name) => {
  console.info("Loading and initializing SQLite3 module...");

  const client = new SQLocal(`${name}.sqlite3`);

  console.info("Database loaded.");

  await setupSystemStorage(client);

  let version = "0";

  const lsDbVersionKey = `sqlite.${name}.db_version`;

  const knownVersion = await getSystemValue(client, "db_version");
  const cachedVersion = localStorage.getItem(lsDbVersionKey);

  if (knownVersion !== cachedVersion) {
    if (knownVersion && !cachedVersion) {
      console.warn("Restore cached db_version =", knownVersion);
      localStorage.setItem(lsDbVersionKey, knownVersion);
      version = knownVersion;
    } else {
      console.warn("Drop db_version");
      await setSystemValue(client, "db_version", "0");
      localStorage.setItem(lsDbVersionKey, "0");
      version = "0";
    }
  } else {
    version = knownVersion;
  }

  const _execute = createExecutor(client);
  const _createTransaction = createTransaction(client);

  const api = {
    version,
    changeVersion(
      oldVersion,
      newVersion,
      handler,
      errorCallback,
      successCallback
    ) {
      const tx = _createTransaction();

      tx.onComplete.push(async () => {
        this.version = String(newVersion);

        await setSystemValue(client, "db_version", newVersion);

        localStorage.setItem(lsDbVersionKey, newVersion);
      });

      if (handler) {
        tx.onInitial.push(handler);
      }

      if (successCallback) {
        tx.onComplete.push(successCallback);
      }

      if (errorCallback) {
        tx.onError.push(errorCallback);
      }

      tx.run();
    },
    executeSql(sql, values, callback, errorCallback) {
      queueJob(() =>
        _execute(sql, values, true).then(callback).catch(errorCallback)
      );
    },
    transaction(handler, errorCallback, successCallback) {
      const tx = _createTransaction();

      if (handler) {
        tx.onInitial.push(handler);
      }

      if (errorCallback) {
        tx.onError.push(errorCallback);
      }

      if (successCallback) {
        tx.onComplete.push(successCallback);
      }

      tx.run();
    },
  };

  if (api.version === "0") {
    console.warn("Cleanup database.");
    const { rows } = await _execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );

    for (const row of rows) {
      if (row.name.startsWith("sqlite_")) continue;

      await _execute(`DROP TABLE ${row.name}`);
    }

    await setupSystemStorage(client);
  }

  return api;
};
