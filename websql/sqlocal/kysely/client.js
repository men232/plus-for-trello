import { SQLocal } from '..';
import { CompiledQuery, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler, } from 'kysely';
export class SQLocalKysely extends SQLocal {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "executor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (query) => {
                const { rows, columns } = await this.exec(query.sql, query.parameters, 'all');
                return {
                    rows: this.convertRowsToObjects(rows, columns),
                };
            }
        });
        Object.defineProperty(this, "dialect", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                createAdapter: () => new SqliteAdapter(),
                createDriver: () => new SQLocalKyselyDriver(this, this.executor),
                createIntrospector: (db) => new SqliteIntrospector(db),
                createQueryCompiler: () => new SqliteQueryCompiler(),
            }
        });
    }
}
class SQLocalKyselyDriver {
    constructor(client, executor) {
        Object.defineProperty(this, "client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "executor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.client = client;
        this.executor = executor;
    }
    async acquireConnection() {
        return new SQLocalKyselyConnection(this.executor);
    }
    async beginTransaction(connection) {
        await connection.executeQuery(CompiledQuery.raw('BEGIN'));
    }
    async commitTransaction(connection) {
        await connection.executeQuery(CompiledQuery.raw('COMMIT'));
    }
    async rollbackTransaction(connection) {
        await connection.executeQuery(CompiledQuery.raw('ROLLBACK'));
    }
    async destroy() {
        await this.client.destroy();
    }
    async init() { }
    async releaseConnection() { }
}
class SQLocalKyselyConnection {
    constructor(executor) {
        Object.defineProperty(this, "executor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.executor = executor;
    }
    async executeQuery(query) {
        return await this.executor(query);
    }
    async *streamQuery() {
        throw new Error('SQLite3 does not support streaming.');
    }
}
//# sourceMappingURL=client.js.map