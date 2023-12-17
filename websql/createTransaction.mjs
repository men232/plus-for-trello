import { createExecutor } from "./createExecutor.mjs";
import {
  callWithErrorHandling,
  callWithAsyncErrorHandling,
  nextTick,
  queueJob,
} from "./scheduler.mjs";

let idSec = 1;

/**
 * @param {import('./sqlocal').SQLocal} client
 */
export function createTransaction(client) {
  const _execute = createExecutor(client);

  /**
   * @return {import('./types').TransactionApi}
   */
  return function () {
    /** @type {import('./types').TransactionApi} */
    const tx = {
      id: idSec++,
      queries: [{ sql: "BEGIN TRANSACTION;", values: [] }],
      status: "pending",
      onComplete: [],
      onError: [],
      onFinally: [],
      onInitial: [],
      log(level, ...args) {
        console[level](`[TX ${this.id}]`, ...args);
      },
      run() {
        if (this.status !== "pending") {
          throw new Error("Transaction are " + this.status);
        }

        tx.status = "queued";

        queueJob(async () => {
          tx.status = "active";

          this.log("info", "--- OPEN ---");

          await callWithAsyncErrorHandling(tx.onInitial, [tx]);

          setTimeout(() => callWithAsyncErrorHandling(_drainQuery, [tx]), 1);

          return new Promise((resolve) => {
            tx.onFinally.push(() => {
              this.log("info", `--- CLOSE --- (status = ${tx.status})`);
              resolve();
            });
          });
        });
      },
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
    };

    return tx;
  };

  /**
   * @param {import('./types').TransactionApi} tx
   */
  async function commit(tx) {
    try {
      await _execute("COMMIT;");
      await callWithAsyncErrorHandling(tx.onComplete);
      await callWithAsyncErrorHandling(tx.onFinally);
    } catch (err) {
      tx.log("error", "Failed to commit transaction.", err);

      tx.status = "failed";

      await callWithAsyncErrorHandling(tx.onError, [err]);
      await callWithAsyncErrorHandling(tx.onFinally);
    }
  }

  /**
   * @param {import('./types').TransactionApi} tx
   * @param {Error} withError
   */
  async function rollback(tx, withError) {
    try {
      await _execute("ROLLBACK;");
      await callWithAsyncErrorHandling(tx.onError, [withError]);
      await callWithAsyncErrorHandling(tx.onFinally);
    } catch (err) {
      tx.log("error", "Failed to rollback transaction.", err);
      await callWithAsyncErrorHandling(tx.onError, [withError]);
      await callWithAsyncErrorHandling(tx.onFinally);
    }
  }

  /**
   * @param {import('./types').TransactionApi} tx
   */
  async function _drainQuery(tx) {
    tx.log(
      "info",
      `DRAIN (status = ${tx.status}, queries = ${tx.queries.length})`
    );

    if (tx.status !== "active") return;

    let q = tx.queries.shift();

    if (!q) {
      tx.status = "completed";

      await commit(tx);
      return;
    }

    let results;

    try {
      do {
        results = await _execute(q.sql, q.values);

        if (q.callback) {
          await callWithErrorHandling(q.callback, [tx, results]);
        }
      } while ((q = tx.queries.shift()));
    } catch (err) {
      if (q.errorCallback) {
        callWithErrorHandling(q.errorCallback, [tx, err]);
      } else {
        tx.log(
          "warn",
          "[SQL]",
          err,
          "\nQuery:\n",
          q.sql,
          "\nValues:\n",
          q.values
        );
      }

      tx.status = "failed";

      await rollback(tx, err);
      return;
    }

    setTimeout(() => callWithAsyncErrorHandling(_drainQuery, [tx]), 1);
  }
}
