import { authenticate, AUTH_SCOPE } from "../../utils/auth/authCore.js";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, authCode',
    'Access-Control-Max-Age': '86400',
};

function unauthorized(reason) {
    return new Response(reason, {
        status: 401,
        statusText: 'Unauthorized',
        headers: {
            'Content-Type': 'text/plain;charset=UTF-8',
            'Cache-Control': 'no-store',
            ...corsHeaders,
        },
    });
}

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    const url = new URL(context.request.url);
    const pathname = url.pathname.toLowerCase();
    const requiredPermission = pathname.includes('/delete/') ? 'delete' : 'list';

    const result = await authenticate({
        env: context.env,
        request: context.request,
        url,
        requiredPermission,
        authScope: AUTH_SCOPE.USER,
    });

    if (!result.authorized) {
        return unauthorized('Unauthorized');
    }

    const response = await context.next();
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
        headers.set(key, value);
    }
    if (!headers.has('Cache-Control')) {
        headers.set('Cache-Control', 'private, no-store, max-age=0');
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}
