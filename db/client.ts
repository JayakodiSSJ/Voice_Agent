import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export async function withTenant<T>(
    tenantId: string,
    fn: (client: import("pg").PoolClient) => Promise<T>
): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

export async function withSuperAdmin<T>(
    fn: (client: import("pg").PoolClient) => Promise<T>
): Promise<T> {
    const client = await pool.connect();
    try {
        return await fn(client);
    } finally {
        client.release();
    }
}