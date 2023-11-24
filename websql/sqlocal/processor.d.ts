import type { DestroyMessage, QueryMessage, Sqlite3, Sqlite3Db, TransactionMessage, ProcessorConfig, FunctionMessage, UserFunction, CallbackUserFunction, OutputMessage, InputMessage } from './types';
export declare class SQLocalProcessor {
    protected sqlite3: Sqlite3 | undefined;
    protected db: Sqlite3Db | undefined;
    protected config: ProcessorConfig;
    protected queuedMessages: InputMessage[];
    protected userFunctions: Map<string, CallbackUserFunction>;
    onmessage: ((message: OutputMessage) => void) | undefined;
    constructor();
    protected init: () => Promise<void>;
    postMessage: (message: InputMessage | MessageEvent<InputMessage>) => void;
    protected emitMessage: (message: OutputMessage) => void;
    protected editConfig: <T extends "databasePath">(key: T, value: ProcessorConfig[T]) => void;
    protected exec: (message: QueryMessage | TransactionMessage) => void;
    protected createCallbackFunction: (message: FunctionMessage) => void;
    protected initUserFunction: (fn: UserFunction) => void;
    protected flushQueue: () => void;
    protected destroy: (message: DestroyMessage) => void;
}
