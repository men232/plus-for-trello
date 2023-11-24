import { SQLocal } from '..';
import type { Sqlite3Method } from '../types';
export declare class SQLocalDrizzle extends SQLocal {
    driver: (sql: string, params: any[], method: Sqlite3Method) => Promise<{
        rows: any[];
        columns: string[];
    }>;
}
