"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const pool_1 = require("./pool");
let initialized = false;
async function initializeDatabase() {
    if (initialized) {
        return;
    }
    const schemaPath = (0, node_path_1.join)(process.cwd(), 'src', 'infra', 'db', 'schema.sql');
    const sql = (0, node_fs_1.readFileSync)(schemaPath, 'utf-8');
    await (0, pool_1.query)(sql);
    initialized = true;
}
