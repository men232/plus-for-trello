import { SQLocal } from '..';
import { CompiledQuery, DatabaseConnection, Driver, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from 'kysely';
export declare class SQLocalKysely extends SQLocal {
    private executor;
    dialect: {
        createAdapter: () => SqliteAdapter;
        createDriver: () => SQLocalKyselyDriver;
        createIntrospector: (db: import("kysely").Kysely<any>) => SqliteIntrospector;
        createQueryCompiler: () => SqliteQueryCompiler;
    };
}
declare class SQLocalKyselyDriver implements Driver {
    private client;
    private executor;
    constructor(client: SQLocalKysely, executor: SQLocalKysely['executor']);
    acquireConnection(): Promise<SQLocalKyselyConnection>;
    beginTransaction(connection: DatabaseConnection): Promise<void>;
    commitTransaction(connection: DatabaseConnection): Promise<void>;
    rollbackTransaction(connection: DatabaseConnection): Promise<void>;
    destroy(): Promise<void>;
    init(): Promise<void>;
    releaseConnection(): Promise<void>;
}
declare class SQLocalKyselyConnection implements DatabaseConnection {
    private executor;
    constructor(executor: SQLocalKysely['executor']);
    executeQuery<T>(query: CompiledQuery): Promise<{
        rows: T[];
    }>;
    streamQuery(): AsyncGenerator<never, void, unknown>;
}
export {};
