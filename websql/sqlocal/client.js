import { nanoid } from './vendors/nanoid.js';
export class SQLocal {
    constructor(databasePath) {
        Object.defineProperty(this, "databasePath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "worker", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isWorkerDestroyed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "userCallbacks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "queriesInProgress", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "processMessageEvent", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (event) => {
                const message = event.data;
                const queries = this.queriesInProgress;
                switch (message.type) {
                    case 'success':
                    case 'data':
                    case 'error':
                        if (message.queryKey && queries.has(message.queryKey)) {
                            const [resolve, reject] = queries.get(message.queryKey);
                            if (message.type === 'error') {
                                reject(message.error);
                            }
                            else {
                                resolve(message);
                            }
                            queries.delete(message.queryKey);
                        }
                        else if (message.type === 'error') {
                            throw message.error;
                        }
                        break;
                    case 'callback':
                        const userCallback = this.userCallbacks.get(message.name);
                        if (userCallback) {
                            userCallback(...(message.args ?? []));
                        }
                        break;
                }
            }
        });
        Object.defineProperty(this, "createQuery", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (message) => {
                if (this.isWorkerDestroyed === true) {
                    throw new Error('This SQLocal client has been destroyed. You will need to initialize a new client in order to make further queries.');
                }
                const queryKey = nanoid();
                this.worker.postMessage({
                    ...message,
                    queryKey,
                });
                return new Promise((resolve, reject) => {
                    this.queriesInProgress.set(queryKey, [resolve, reject]);
                });
            }
        });
        Object.defineProperty(this, "convertSqlTemplate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (queryTemplate, ...params) => {
                return {
                    sql: queryTemplate.join('?'),
                    params,
                };
            }
        });
        Object.defineProperty(this, "convertRowsToObjects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (rows, columns) => {
                return rows.map((row) => {
                    const rowObj = {};
                    columns.forEach((column, columnIndex) => {
                        rowObj[column] = row[columnIndex];
                    });
                    return rowObj;
                });
            }
        });
        Object.defineProperty(this, "exec", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (sql, params, method) => {
                const message = await this.createQuery({
                    type: 'query',
                    sql,
                    params,
                    method,
                });
                let data = {
                    rows: [],
                    columns: [],
                };
                if (message.type === 'data') {
                    data.rows = message.rows;
                    data.columns = message.columns;
                }
                return data;
            }
        });
        Object.defineProperty(this, "sql", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (queryTemplate, ...params) => {
                const statement = this.convertSqlTemplate(queryTemplate, ...params);
                const { rows, columns } = await this.exec(statement.sql, statement.params, 'all');
                return this.convertRowsToObjects(rows, columns);
            }
        });
        Object.defineProperty(this, "transaction", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (passStatements) => {
                const statements = passStatements(this.convertSqlTemplate);
                await this.createQuery({
                    type: 'transaction',
                    statements,
                });
            }
        });
        Object.defineProperty(this, "createCallbackFunction", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (functionName, handler) => {
                await this.createQuery({
                    type: 'function',
                    functionName,
                });
                this.userCallbacks.set(functionName, handler);
            }
        });
        Object.defineProperty(this, "getDatabaseFile", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async () => {
                const opfs = await navigator.storage.getDirectory();
                const fileHandle = await opfs.getFileHandle(this.databasePath);
                return await fileHandle.getFile();
            }
        });
        Object.defineProperty(this, "overwriteDatabaseFile", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (databaseFile) => {
                const opfs = await navigator.storage.getDirectory();
                const fileHandle = await opfs.getFileHandle(this.databasePath, {
                    create: true,
                });
                const fileWritable = await fileHandle.createWritable();
                await fileWritable.truncate(0);
                await fileWritable.write(databaseFile);
                await fileWritable.close();
            }
        });
        Object.defineProperty(this, "destroy", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async () => {
                await this.createQuery({ type: 'destroy' });
                this.worker.removeEventListener('message', this.processMessageEvent);
                this.queriesInProgress.clear();
                this.userCallbacks.clear();
                this.worker.terminate();
                this.isWorkerDestroyed = true;
            }
        });
        this.worker = new Worker(new URL('./worker.js', import.meta.url), {
            type: 'module',
        });
        this.worker.addEventListener('message', this.processMessageEvent);
        this.databasePath = databasePath;
        this.worker.postMessage({
            type: 'config',
            key: 'databasePath',
            value: databasePath,
        });
    }
}
//# sourceMappingURL=client.js.map
