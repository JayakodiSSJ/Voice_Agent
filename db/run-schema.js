require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const sql = fs.readFileSync('db/schema.sql', 'utf8');
    await pool.query(sql);
    console.log('Schema applied successfully.');
    await pool.end();
}

run().catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
});