require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function seed() {
    const t = await pool.query(
        `insert into tenants (slug, name) values ('demo', 'Demo Company')
     on conflict (slug) do nothing returning id`
    );
    const tenantId = t.rows[0]?.id ?? (await pool.query(`select id from tenants where slug='demo'`)).rows[0].id;

    await pool.query(
        `insert into tenant_config (tenant_id, persona_name, default_language)
     values ($1, 'Demo Bot', 'en') on conflict (tenant_id) do nothing`,
        [tenantId]
    );

    console.log('Demo tenant seeded. tenant_id =', tenantId);
    await pool.end();
}

seed().catch((e) => { console.error('Failed:', e.message); process.exit(1); });