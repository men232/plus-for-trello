import type { CallbackUserFunction, DestroyMessage, FunctionMessage, OmitQueryKey, OutputMessage, QueryMessage, Sqlite3Method, TransactionMessage } from './types';
export declare class SQLocal {
    protected databasePath: string;
    protected worker: Worker;
    protected isWorkerDestroyed: boolean;
    protected userCallbacks: Map<string, (...args: any[]) => void>;
    protected queriesInProgress: Map<string, [resolve: (message: OutputMessage) => void, reject: (error: unknown) => void]>;
    constructor(databasePath: string);
    protected processMessageEvent: (event: MessageEvent<OutputMessage>) => void;
    protected createQuery: (message: OmitQueryKey<QueryMessage | TransactionMessage | DestroyMessage | FunctionMessage>) => Promise<OutputMessage>;
    protected convertSqlTemplate: (queryTemplate: TemplateStringsArray, ...params: any[]) => {
        sql: string;
        params: any[];
    };
    protected convertRowsToObjects: (rows: any[], columns: string[]) => Record<string, any>[];
    protected exec: (sql: string, params: any[], method: Sqlite3Method) => Promise<{
        rows: any[];
        columns: string[];
    }>;
    sql: <T extends Record<string, any>[]>(queryTemplate: TemplateStringsArray, ...params: any[]) => Promise<T>;
    transaction: (passStatements: (sql: SQLocal['convertSqlTemplate']) => ReturnType<SQLocal['convertSqlTemplate']>[]) => Promise<void>;
    createCallbackFunction: (functionName: string, handler: CallbackUserFunction['handler']) => Promise<void>;
    getDatabaseFile: () => Promise<File>;
    overwriteDatabaseFile: (databaseFile: FileSystemWriteChunkType) => Promise<void>;
    destroy: () => Promise<void>;
}
