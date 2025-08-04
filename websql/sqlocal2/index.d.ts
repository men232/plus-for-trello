import type { CompiledQuery } from 'kysely';
import type { Database } from '@sqlite.org/sqlite-wasm';
import type { JsStorageDb } from '@sqlite.org/sqlite-wasm';
import type { RunnableQuery } from 'drizzle-orm/runnable-query';
import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { SqliteRemoteResult } from 'drizzle-orm/sqlite-proxy';

export declare type AggregateUserFunction = {
    type: 'aggregate';
    name: string;
    func: {
        step: (...args: any[]) => void;
        final: (...args: any[]) => any;
    };
};

declare type BatchMessage = {
    type: 'batch';
    queryKey: QueryKey;
    statements: {
        sql: string;
        params: unknown[];
        method?: Sqlite3Method;
    }[];
};

declare type BroadcastMessage = ReinitBroadcast | CloseBroadcast;

declare type BufferMessage = {
    type: 'buffer';
    queryKey: QueryKey;
    bufferName: string;
    buffer: ArrayBuffer | Uint8Array;
};

declare type CallbackMessage = {
    type: 'callback';
    name: string;
    args: unknown[];
};

export declare type CallbackUserFunction = {
    type: 'callback';
    name: string;
    func: (...args: any[]) => void;
};

export declare type ClientConfig = {
    databasePath: DatabasePath;
    readOnly?: boolean;
    verbose?: boolean;
    onInit?: (sql: typeof sqlTag) => void | Statement[];
    onConnect?: (reason: ConnectReason) => void;
    processor?: SQLocalProcessor | Worker;
};

declare type CloseBroadcast = {
    type: 'close';
    clientKey: QueryKey;
};

declare type ConfigMessage = {
    type: 'config';
    config: ProcessorConfig;
};

export declare type ConnectReason = 'initial' | 'overwrite' | 'delete';

export declare type DatabaseInfo = {
    databasePath?: DatabasePath;
    databaseSizeBytes?: number;
    storageType?: Sqlite3StorageType;
    persisted?: boolean;
};

export declare type DatabasePath = (string & {}) | ':memory:' | 'local' | ':localStorage:' | 'session' | ':sessionStorage:';

declare type DataMessage = {
    type: 'data';
    queryKey: QueryKey;
    data: {
        columns: string[];
        rows: unknown[] | unknown[][];
    }[];
};

declare type DeleteMessage = {
    type: 'delete';
    queryKey: QueryKey;
};

declare type DestroyMessage = {
    type: 'destroy';
    queryKey: QueryKey;
};

export declare type DriverConfig = {
    databasePath?: DatabasePath;
    readOnly?: boolean;
    verbose?: boolean;
};

export declare type DriverStatement = {
    sql: string;
    params?: any[];
    method?: Sqlite3Method;
};

declare type ErrorMessage = {
    type: 'error';
    queryKey: QueryKey | null;
    error: unknown;
};

declare type EventMessage = {
    type: 'event';
    event: 'connect';
    reason: ConnectReason;
};

declare type ExportMessage = {
    type: 'export';
    queryKey: QueryKey;
};

declare type FunctionMessage = {
    type: 'function';
    queryKey: QueryKey;
    functionName: string;
    functionType: UserFunction['type'];
};

declare type GetInfoMessage = {
    type: 'getinfo';
    queryKey: QueryKey;
};

declare type ImportMessage = {
    type: 'import';
    queryKey: QueryKey;
    database: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>;
};

declare type InfoMessage = {
    type: 'info';
    queryKey: QueryKey;
    info: DatabaseInfo;
};

declare type InputMessage = QueryMessage | BatchMessage | TransactionMessage | FunctionMessage | ConfigMessage | GetInfoMessage | ImportMessage | ExportMessage | DeleteMessage | DestroyMessage;

declare type Message = InputMessage | OutputMessage;

declare type OmitQueryKey<T> = T extends Message ? Omit<T, 'queryKey'> : never;

declare type OutputMessage = SuccessMessage | ErrorMessage | DataMessage | BufferMessage | CallbackMessage | InfoMessage | EventMessage;

export declare type ProcessorConfig = {
    databasePath?: DatabasePath;
    readOnly?: boolean;
    verbose?: boolean;
    clientKey?: QueryKey;
    onInitStatements?: Statement[];
};

export declare type QueryKey = string;

declare type QueryMessage = {
    type: 'query';
    queryKey: QueryKey;
    transactionKey?: QueryKey;
    sql: string;
    params: unknown[];
    method: Sqlite3Method;
};

export declare type RawResultData = {
    rows: unknown[] | unknown[][];
    columns: string[];
};

declare type ReinitBroadcast = {
    type: 'reinit';
    clientKey: QueryKey;
    reason: ConnectReason;
};

export declare type ReturningStatement<Result = unknown> = Statement | CompiledQuery<Result> | RunnableQuery<Result extends SqliteRemoteResult<unknown> ? any : Result[], 'sqlite'>;

export declare type ScalarUserFunction = {
    type: 'scalar';
    name: string;
    func: (...args: any[]) => any;
};

export declare type Sqlite3 = Sqlite3Static;

export declare type Sqlite3Db = Database;

export declare type Sqlite3InitModule = () => Promise<Sqlite3>;

export declare type Sqlite3Method = 'get' | 'all' | 'run' | 'values';

export declare type Sqlite3StorageType = (string & {}) | 'memory' | 'opfs' | 'local' | 'session';

export declare class SQLiteKvvfsDriver extends SQLiteMemoryDriver implements SQLocalDriver {
    readonly storageType: 'local' | 'session';
    protected db?: JsStorageDb;
    constructor(storageType: 'local' | 'session', sqlite3InitModule?: Sqlite3InitModule);
    init(config: DriverConfig): Promise<void>;
    isDatabasePersisted(): Promise<boolean>;
    getDatabaseSizeBytes(): Promise<number>;
    import(database: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>): Promise<void>;
    clear(): Promise<void>;
    destroy(): Promise<void>;
}

export declare class SQLiteMemoryDriver implements SQLocalDriver {
    protected sqlite3InitModule?: Sqlite3InitModule | undefined;
    protected sqlite3?: Sqlite3;
    protected db?: Sqlite3Db;
    protected config?: DriverConfig;
    protected pointers: number[];
    readonly storageType: Sqlite3StorageType;
    constructor(sqlite3InitModule?: Sqlite3InitModule | undefined);
    init(config: DriverConfig): Promise<void>;
    exec(statement: DriverStatement): Promise<RawResultData>;
    execBatch(statements: DriverStatement[]): Promise<RawResultData[]>;
    isDatabasePersisted(): Promise<boolean>;
    getDatabaseSizeBytes(): Promise<number>;
    createFunction(fn: UserFunction): Promise<void>;
    import(database: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>): Promise<void>;
    export(): Promise<{
        name: string;
        data: ArrayBuffer | Uint8Array;
    }>;
    clear(): Promise<void>;
    destroy(): Promise<void>;
    protected getFlags(config: DriverConfig): string;
    protected execOnDb(db: Sqlite3Db, statement: DriverStatement): RawResultData;
    protected closeDb(): void;
}

export declare class SQLiteOpfsDriver extends SQLiteMemoryDriver implements SQLocalDriver {
    readonly storageType: Sqlite3StorageType;
    init(config: DriverConfig): Promise<void>;
    isDatabasePersisted(): Promise<boolean>;
    import(database: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>): Promise<void>;
    export(): Promise<{
        name: string;
        data: ArrayBuffer | Uint8Array;
    }>;
    clear(): Promise<void>;
    destroy(): Promise<void>;
}

export declare class SQLocal {
    protected config: ClientConfig;
    protected clientKey: QueryKey;
    protected processor: SQLocalProcessor | Worker;
    protected isDestroyed: boolean;
    protected bypassMutationLock: boolean;
    protected userCallbacks: Map<string, (...args: any[]) => void>;
    protected queriesInProgress: Map<string, [resolve: (message: OutputMessage) => void, reject: (error: unknown) => void]>;
    protected proxy: WorkerProxy;
    protected reinitChannel: BroadcastChannel;
    constructor(databasePath: DatabasePath);
    constructor(config: ClientConfig);
    protected processMessageEvent: (event: OutputMessage | MessageEvent<OutputMessage>) => void;
    protected createQuery: (message: OmitQueryKey<QueryMessage | BatchMessage | TransactionMessage | FunctionMessage | GetInfoMessage | ImportMessage | ExportMessage | DeleteMessage | DestroyMessage>) => Promise<OutputMessage>;
    protected broadcast: (message: BroadcastMessage) => void;
    protected exec: (sql: string, params: unknown[], method?: Sqlite3Method, transactionKey?: QueryKey) => Promise<RawResultData>;
    protected execBatch: (statements: Statement[]) => Promise<RawResultData[]>;
    sql: <Result extends Record<string, any>>(queryTemplate: TemplateStringsArray | string, ...params: unknown[]) => Promise<Result[]>;
    batch: <Result extends Record<string, any>>(passStatements: (sql: typeof sqlTag) => Statement[]) => Promise<Result[][]>;
    beginTransaction: () => Promise<Transaction>;
    transaction: <Result>(transaction: (tx: {
        sql: Transaction["sql"];
        query: Transaction["query"];
    }) => Promise<Result>) => Promise<Result>;
    createCallbackFunction: (funcName: string, func: CallbackUserFunction["func"]) => Promise<void>;
    createScalarFunction: (funcName: string, func: ScalarUserFunction["func"]) => Promise<void>;
    createAggregateFunction: (funcName: string, func: AggregateUserFunction["func"]) => Promise<void>;
    getDatabaseInfo: () => Promise<DatabaseInfo>;
    getDatabaseFile: () => Promise<File>;
    overwriteDatabaseFile: (databaseFile: File | Blob | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>, beforeUnlock?: () => void | Promise<void>) => Promise<void>;
    deleteDatabaseFile: (beforeUnlock?: () => void | Promise<void>) => Promise<void>;
    destroy: () => Promise<void>;
    [Symbol.dispose]: () => void;
    [Symbol.asyncDispose]: () => Promise<void>;
}

export declare interface SQLocalDriver {
    readonly storageType: Sqlite3StorageType;
    init: (config: DriverConfig) => Promise<void>;
    exec: (statement: DriverStatement) => Promise<RawResultData>;
    execBatch: (statements: DriverStatement[]) => Promise<RawResultData[]>;
    isDatabasePersisted: () => Promise<boolean>;
    getDatabaseSizeBytes: () => Promise<number>;
    createFunction: (fn: UserFunction) => Promise<void>;
    import: (database: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>) => Promise<void>;
    export: () => Promise<{
        name: string;
        data: ArrayBuffer | Uint8Array;
    }>;
    clear: () => Promise<void>;
    destroy: () => Promise<void>;
}

export declare class SQLocalProcessor {
    protected driver: SQLocalDriver;
    protected config: ProcessorConfig;
    protected userFunctions: Map<string, UserFunction>;
    protected initMutex: {
        lock: () => Promise<void>;
        unlock: () => Promise<void>;
    };
    protected transactionMutex: {
        lock: () => Promise<void>;
        unlock: () => Promise<void>;
    };
    protected transactionKey: QueryKey | null;
    protected proxy: WorkerProxy;
    protected reinitChannel?: BroadcastChannel;
    onmessage?: (message: OutputMessage, transfer: Transferable[]) => void;
    constructor(driver: SQLocalDriver);
    protected init: (reason: ConnectReason) => Promise<void>;
    postMessage: (event: InputMessage | MessageEvent<InputMessage>, _transfer?: Transferable) => Promise<void>;
    protected emitMessage: (message: OutputMessage, transfer?: Transferable[]) => void;
    protected editConfig: (message: ConfigMessage) => void;
    protected exec: (message: QueryMessage | BatchMessage | TransactionMessage) => Promise<void>;
    protected execInitStatements: () => Promise<void>;
    protected getDatabaseInfo: (message: GetInfoMessage) => Promise<void>;
    protected createUserFunction: (message: FunctionMessage) => Promise<void>;
    protected initUserFunction: (fn: UserFunction) => Promise<void>;
    protected importDb: (message: ImportMessage) => Promise<void>;
    protected exportDb: (message: ExportMessage) => Promise<void>;
    protected deleteDb: (message: DeleteMessage) => Promise<void>;
    protected destroy: (message?: DestroyMessage) => Promise<void>;
}

declare function sqlTag(queryTemplate: TemplateStringsArray, ...params: unknown[]): Statement;

export declare type Statement = {
    sql: string;
    params: unknown[];
};

export declare type StatementInput<Result = unknown> = ReturningStatement<Result> | ((sql: typeof sqlTag) => ReturningStatement<Result>);

declare type SuccessMessage = {
    type: 'success';
    queryKey: QueryKey;
};

export declare type Transaction = {
    query: <Result extends Record<string, any>>(passStatement: StatementInput<Result>) => Promise<Result[]>;
    sql: <Result extends Record<string, any>>(queryTemplate: TemplateStringsArray | string, ...params: unknown[]) => Promise<Result[]>;
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
};

declare type TransactionMessage = {
    type: 'transaction';
    queryKey: QueryKey;
    transactionKey: QueryKey;
    action: 'begin' | 'rollback' | 'commit';
};

export declare type UserFunction = CallbackUserFunction | ScalarUserFunction | AggregateUserFunction;

declare type WorkerProxy = (typeof globalThis | ProxyHandler<Worker>) & Record<string, (...args: any) => any>;

export { }
