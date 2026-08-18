/**
 * 数据库连接（单例）。
 *
 * 用 better-sqlite3 13（13 起提供 Node 26 预编译二进制，无需 node-gyp；11.x 在 Node 26 上编译失败）。
 * Node 26 内置的 node:sqlite 本可省掉这个原生依赖，但 Drizzle 0.45 还没有对应驱动，待其支持后再切。
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema.ts";

const dbPath = process.env.DATABASE_PATH ?? "./data/cosme.db";
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
