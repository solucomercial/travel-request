"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
exports.withTransaction = withTransaction;
const pg_1 = require("pg");
const env_1 = require("../../config/env");
exports.pool = new pg_1.Pool({
    connectionString: env_1.env.DATABASE_URL
});
async function query(text, params = []) {
    return exports.pool.query(text, params);
}
async function withTransaction(executor) {
    const client = await exports.pool.connect();
    try {
        await client.query('BEGIN');
        const result = await executor(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
