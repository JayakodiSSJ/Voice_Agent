import { withTenant } from "./client";

export interface Turn {
    role: "user" | "assistant";
    content: string;
}

export async function saveTurn(
    tenantId: string,
    sessionId: string,
    role: Turn["role"],
    content: string
) {
    await withTenant(tenantId, async (c) => {
        // ensure a session row exists for this external session id
        await c.query(
            `insert into sessions (id, tenant_id, external_session_id)
       values (gen_random_uuid(), $1, $2)
       on conflict do nothing`,
            [tenantId, sessionId]
        );

        const sess = await c.query(
            `select id from sessions where tenant_id = $1 and external_session_id = $2`,
            [tenantId, sessionId]
        );

        await c.query(
            `insert into turns (tenant_id, session_id, role, content) values ($1, $2, $3, $4)`,
            [tenantId, sess.rows[0].id, role, content]
        );
    });
}

export async function getHistory(
    tenantId: string,
    sessionId: string,
    limit = 10
): Promise<Turn[]> {
    return withTenant(tenantId, async (c) => {
        const res = await c.query(
            `select t.role, t.content from turns t
       join sessions s on s.id = t.session_id
       where t.tenant_id = $1 and s.external_session_id = $2
       order by t.created_at asc
       limit $3`,
            [tenantId, sessionId, limit]
        );
        return res.rows;
    });
}