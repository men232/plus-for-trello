import { SQLocal } from "./sqlocal/index.js";

const noop = () => {};

async function callSafe(...fns) {
  for (const fn of fns) {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  }
}

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

  const api = {
    version,
    changeVersion(
      oldVersion,
      newVersion,
      handler,
      errorCallback,
      successCallback
    ) {
      const tx = createTransaction();

      tx.onComplete = async () => {
        this.version = String(newVersion);

        await setSystemValue(client, "db_version", newVersion);

        localStorage.setItem(lsDbVersionKey, newVersion);

        if (successCallback) {
          await callSafe(() => successCallback());
        }
      };

      tx.onError = errorCallback;
      tx._drainSchedule();

      handler(tx);
    },
    executeSql(sql, values, callback, errorCallback) {
      _execute(sql, values).then(callback).catch(errorCallback);
    },
    transaction(handler, errorCallback, successCallback) {
      const tx = createTransaction();

      tx.onComplete = successCallback;
      tx.onError = errorCallback;
      tx._drainSchedule();

      handler(tx);
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

  async function _execute(sql, values) {
    if (!Array.isArray(values)) {
      values = values !== undefined ? [values] : [];
    }

    console.log("[SQL]", sql);

    const [raws, rawsLastRowId, rawsChanges] = await Promise.all([
      client.exec(sql, values, "all"),
      client.exec("SELECT last_insert_rowid()", [], "all"),
      client.exec("SELECT changes()", [], "all"),
    ]);

    let insertId = rawsLastRowId?.rows?.[0]?.[0] ?? null;
    let rowsAffected = rawsChanges?.rows?.[0]?.[0] ?? 0;

    const rows = client.convertRowsToObjects(raws.rows, raws.columns);

    const result = { rows, insertId, rowsAffected };

    return result;
  }

  function createTransaction() {
    const tx = {
      queries: [{ sql: "BEGIN TRANSACTION;", values: [] }],
      status: "active",
      onComplete: noop,
      onError: noop,
      onFinally: noop,
      executeSql(sql, values, callback, errorCallback) {
        if (this.status !== "active") {
          throw new Error("Transaction are " + this.status);
        }

        this.queries.push({
          sql,
          values,
          callback,
          errorCallback,
        });
      },
      _drainSchedule() {
        setTimeout(this._drain.bind(this), 1);
      },
      _drain() {
        if (this.status !== "active") return;

        const q = this.queries.shift();

        if (!q) {
          this.status = "completed";

          return _execute("COMMIT;")
            .then(() => {
              return callSafe(
                () => this.onComplete(),
                () => this.onFinally()
              );
            })
            .catch((err) => {
              console.error("Failed to commit transaction.", err);

              this.status = "failed";

              return callSafe(
                () => this.onError(err),
                () => this.onFinally()
              );
            });
        }

        _execute(q.sql, q.values)
          .then((results) => {
            if (q.callback) {
              callSafe(() => q.callback(tx, results));
            }
          })
          .then(() => this._drainSchedule())
          .catch((err) => {
            if (q.errorCallback) {
              callSafe(() => q.errorCallback(tx, err));
            } else {
              console.warn(
                "[SQL]",
                err,
                "\nQuery:\n",
                q.sql,
                "\nValues:\n",
                q.values
              );
            }

            this.status = "error";

            return _execute("ROLLBACK;")
              .then(() => {
                return callSafe(
                  () => this.onError(err),
                  () => this.onFinally()
                );
              })
              .catch((err) => {
                console.error("Failed to rollback transaction.", err);
              });
          });
      },
    };

    return tx;
  }
};
