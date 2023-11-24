import { SQLocal } from '..';
export class SQLocalDrizzle extends SQLocal {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "driver", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (sql, params, method) => {
                return await this.exec(sql, params, method);
            }
        });
    }
}
//# sourceMappingURL=client.js.map