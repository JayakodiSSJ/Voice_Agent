import { NextRequest } from "next/server";
import { withSuperAdmin } from "@/db/client";

export interface Tenant {
    id: string;
    slug: string;
}

export async function getTenant(req: NextRequest): Promise<Tenant | null> {
    const slug = req.headers.get("x-tenant-slug");
    if (!slug) return null;

    return withSuperAdmin(async (c) => {
        const res = await c.query(
            `select id, slug from tenants where slug = $1 and status = 'active'`,
            [slug]
        );
        return res.rows[0] ?? null;
    });
}