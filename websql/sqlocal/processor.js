import sqlite3InitModule from './vendors/sqlite-wasm/index.mjs';
export class SQLocalProcessor {
    constructor() {
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
            value: {}
        });
        Object.defineProperty(this, "queuedMessages", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "userFunctions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
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
            value: async () => {
                if (!this.config.databasePath)
                    return;
                try {
                    if (!this.sqlite3) {
                        this.sqlite3 = await sqlite3InitModule();
                    }
                    if (this.db) {
                        this.db?.close();
                        this.db = undefined;
                    }
                    if ('opfs' in this.sqlite3) {
                        this.db = new this.sqlite3.oo1.OpfsDb(this.config.databasePath, 'cw');
                    }
                    else {
                        this.db = new this.sqlite3.oo1.DB(this.config.databasePath, 'cw');
                        console.warn(`The origin private file system is not available, so ${this.config.databasePath} will not be persisted. Make sure your web server is configured to use the correct HTTP response headers (See https://sqlocal.dallashoffman.com/guide/setup#cross-origin-isolation).`);
                    }
                }
                catch (error) {
                    this.emitMessage({
                        type: 'error',
                        error,
                        queryKey: null,
                    });
                    this.db?.close();
                    this.db = undefined;
                    return;
                }
                this.userFunctions.forEach(this.initUserFunction);
                this.flushQueue();
            }
        });
        Object.defineProperty(this, "postMessage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (message) => {
                if (message instanceof MessageEvent) {
                    message = message.data;
                }
                if (!this.db && message.type !== 'config') {
                    this.queuedMessages.push(message);
                    return;
                }
                switch (message.type) {
                    case 'config':
                        this.editConfig(message.key, message.value);
                        break;
                    case 'query':
                    case 'transaction':
                        this.exec(message);
                        break;
                    case 'function':
                        this.createCallbackFunction(message);
                        break;
                    case 'destroy':
                        this.destroy(message);
                        break;
                }
            }
        });
        Object.defineProperty(this, "emitMessage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (message) => {
                if (this.onmessage) {
                    this.onmessage(message);
                }
            }
        });
        Object.defineProperty(this, "editConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (key, value) => {
                if (this.config[key] === value)
                    return;
                this.config[key] = value;
                if (key === 'databasePath') {
                    this.init();
                }
            }
        });
        Object.defineProperty(this, "exec", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (message) => {
                if (!this.db)
                    return;
                try {
                    const response = {
                        type: 'data',
                        queryKey: message.queryKey,
                        rows: [],
                        columns: [],
                    };
                    switch (message.type) {
                        case 'query':
                            const rows = this.db.exec({
                                sql: message.sql,
                                bind: message.params,
                                returnValue: 'resultRows',
                                rowMode: 'array',
                                columnNames: response.columns,
                            });
                            switch (message.method) {
                                case 'run':
                                    break;
                                case 'get':
                                    response.rows = rows[0];
                                    break;
                                case 'all':
                                default:
                                    response.rows = rows;
                                    break;
                            }
                            break;
                        case 'transaction':
                            this.db.transaction((db) => {
                                for (let statement of message.statements) {
                                    db.exec({
                                        sql: statement.sql,
                                        bind: statement.params,
                                    });
                                }
                            });
                            break;
                    }
                    this.emitMessage(response);
                }
                catch (error) {
                    this.emitMessage({
                        type: 'error',
                        error,
                        queryKey: message.queryKey,
                    });
                }
            }
        });
        Object.defineProperty(this, "createCallbackFunction", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (message) => {
                const { functionName, queryKey } = message;
                const handler = (...args) => {
                    this.emitMessage({
                        type: 'callback',
                        name: functionName,
                        args: args,
                    });
                };
                if (this.userFunctions.has(functionName)) {
                    this.emitMessage({
                        type: 'error',
                        error: new Error(`A user-defined function with the name "${functionName}" has already been created for this SQLocal instance.`),
                        queryKey,
                    });
                    return;
                }
                try {
                    const callbackFunction = {
                        type: 'callback',
                        name: functionName,
                        handler,
                    };
                    this.initUserFunction(callbackFunction);
                    this.userFunctions.set(functionName, callbackFunction);
                    this.emitMessage({
                        type: 'success',
                        queryKey,
                    });
                }
                catch (error) {
                    this.emitMessage({
                        type: 'error',
                        error,
                        queryKey,
                    });
                }
            }
        });
        Object.defineProperty(this, "initUserFunction", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (fn) => {
                if (!this.db)
                    return;
                this.db.createFunction(fn.name, (_, ...args) => fn.handler(...args), { arity: -1 });
            }
        });
        Object.defineProperty(this, "flushQueue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                while (this.queuedMessages.length > 0) {
                    const message = this.queuedMessages.shift();
                    if (message === undefined)
                        continue;
                    this.postMessage(message);
                }
            }
        });
        Object.defineProperty(this, "destroy", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (message) => {
                this.db?.close();
                this.db = undefined;
                this.emitMessage({
                    type: 'success',
                    queryKey: message.queryKey,
                });
            }
        });
        this.init();
    }
}
//# sourceMappingURL=processor.js.map
