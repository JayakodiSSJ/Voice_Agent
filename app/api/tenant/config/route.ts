// app/api/tenant/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTenant } from '../../../lib/tenant/resolve';
import { withTenant } from '../../../../db/client';

export async function GET(req: NextRequest) {
    const tenant = await getTenant(req);
    if (!tenant) {
        return NextResponse.json({ error: 'unknown tenant' }, { status: 404 });
    }

    const config = await withTenant(tenant.id, async (c) => {
        const res = await c.query(
            `select persona_name, avatar_model_url, brand_color, default_language
       from tenant_config where tenant_id = $1`,
            [tenant.id]
        );
        return res.rows[0];
    });

    return NextResponse.json({
        personaName: config?.persona_name || 'Vidya',
        avatarModelUrl: config?.avatar_model_url || null,
        brandColor: config?.brand_color || null,
        defaultLanguage: config?.default_language || 'en',
    });
}