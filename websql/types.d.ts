export interface SchedulerJob extends Function {
  id?: number;
}

export interface ExecuteResult {
  rows: Record<string, any>[];
  insertId: number | null;
  rowsAffected: number | null;
}

export interface Transaction {
  id: number;
  status: "pending" | "queued" | "active" | "failed" | "completed";
  queries: TransactionQuery[];
}

export interface TransactionQuery {
  sql: string;
  values: unknown[];
  callback?: (tx: TransactionApi, results: ExecuteResult) => void;
  errorCallback?: (tx: TransactionApi, error: Error) => void;
}

export interface TransactionApi extends Transaction {
  run: () => void;
  onInitial: ((tx: TransactionApi) => void)[];
  onComplete: (() => void)[];
  onError: ((error: Error) => void)[];
  onFinally: (() => void)[];
  executeSql(
    sql: string,
    values: any[],
    callback: (tx: TransactionApi, result: ExecuteResult) => void
  );
}
