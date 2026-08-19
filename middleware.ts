import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
    const host = req.headers.get("host") || "";
    const headerOverride = req.headers.get("x-tenant-slug");

    let slug: string;

    if (headerOverride) {
        // explicit override — useful for local testing with curl/Postman
        slug = headerOverride;
    } else if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
        // local dev has no subdomains — default to SLT
        slug = "slt";
    } else {
        // production: companya.workmate.ai -> "companya"
        slug = host.split(".")[0];
    }

    const res = NextResponse.next();
    res.headers.set("x-tenant-slug", slug);
    return res;
}

export const config = {
    matcher: "/api/:path*",
};