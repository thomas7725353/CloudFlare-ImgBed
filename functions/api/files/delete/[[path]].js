import { getDatabase } from '../../../utils/databaseAdapter.js';
import { removeFileFromIndex } from '../../../utils/indexManager.js';
import { purgeCFCache, purgeRandomFileListCache, purgePublicFileListCache } from '../../../utils/purgeCache.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, authCode',
    'Access-Control-Max-Age': '86400',
};

function decodeFileId(pathParam) {
    const rawPath = Array.isArray(pathParam) ? pathParam.join('/') : pathParam;
    return decodeURIComponent(rawPath || '').split(',').join('/');
}

export async function onRequest(context) {
    const { request, env, params, waitUntil } = context;
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    if (request.method !== 'DELETE') {
        return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    const fileId = decodeFileId(params.path);
    if (!fileId) {
        return new Response(JSON.stringify({ success: false, error: 'File ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    try {
        const db = getDatabase(env);
        const fileData = await db.getWithMetadata(fileId);

        if (fileData?.metadata?.Channel === 'CloudflareR2' && env.img_r2) {
            await env.img_r2.delete(fileId);
        }

        await db.delete(fileId);

        const cdnUrl = `${url.origin}/file/${fileId}`;
        await purgeCFCache(env, cdnUrl);

        const normalizedFolder = fileId.split('/').slice(0, -1).join('/');
        await purgeRandomFileListCache(url.origin, normalizedFolder);
        await purgePublicFileListCache(url.origin, normalizedFolder);

        waitUntil(removeFileFromIndex(context, fileId));

        return new Response(JSON.stringify({
            success: true,
            fileId,
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }
}
