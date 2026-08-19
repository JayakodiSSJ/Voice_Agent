require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function verify() {
    const res = await pool.query(
        "select table_name from information_schema.tables where table_schema='public'"
    );
    console.log(res.rows.map((x) => x.table_name));
    await pool.end();
}

verify().catch((e) => {
    console.error('Failed:', e.message);
    process.exit(1);
});