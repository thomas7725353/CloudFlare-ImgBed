import { readIndex } from '../../utils/indexManager.js';
import { getDatabase } from '../../utils/databaseAdapter.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, authCode',
    'Access-Control-Max-Age': '86400',
};

function normalizeDir(dir) {
    let normalized = dir || '';
    normalized = normalized.replace(/\.\./g, '_').replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    if (normalized.startsWith('/')) {
        normalized = normalized.substring(1);
    }
    if (normalized && !normalized.endsWith('/')) {
        normalized += '/';
    }
    return normalized;
}

function toHistoryItem(url, file) {
    const metadata = file.metadata || {};
    const name = file.id || file.name;
    const displayName = metadata.FileName || name.split('/').pop() || name;

    return {
        name,
        displayName,
        url: `${url.origin}/file/${name}`,
        time: metadata.TimeStamp || 0,
        size: metadata.FileSize || '',
        sizeBytes: metadata.FileSizeBytes || 0,
        fileType: metadata.FileType || 'application/octet-stream',
        channel: metadata.Channel || '',
        channelName: metadata.ChannelName || '',
        directory: metadata.Directory || '',
        metadata,
    };
}

async function listFromDatabase(context, dir) {
    const db = getDatabase(context.env);
    const files = [];
    let cursor = null;

    do {
        const response = await db.list({
            prefix: dir,
            limit: 1000,
            cursor,
        });

        if (!response || !Array.isArray(response.keys)) {
            break;
        }

        for (const item of response.keys) {
            if (item.name.startsWith('manage@') || item.name.startsWith('chunk_') || item.name.startsWith('upload_session_') || item.name.startsWith('multipart_')) {
                continue;
            }
            if (!item.metadata || !item.metadata.TimeStamp) {
                continue;
            }
            files.push({
                id: item.name,
                metadata: item.metadata,
            });
        }

        cursor = response.cursor;
    } while (cursor);

    return files;
}

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    if (request.method !== 'GET') {
        return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    const start = Math.max(0, parseInt(url.searchParams.get('start'), 10) || 0);
    const count = parseInt(url.searchParams.get('count'), 10) || 50;
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const dir = normalizeDir(url.searchParams.get('dir') || '');
    const recursive = url.searchParams.get('recursive') !== 'false';

    try {
        const indexed = await readIndex(context, {
            directory: dir,
            start,
            count,
            search,
            includeSubdirFiles: recursive,
        });

        let files = indexed.success
            ? indexed.files
            : await listFromDatabase(context, dir);

        if (!indexed.success) {
            if (search) {
                files = files.filter(file => {
                    const metadata = file.metadata || {};
                    return file.id.toLowerCase().includes(search) || metadata.FileName?.toLowerCase().includes(search);
                });
            }
            files.sort((a, b) => (b.metadata?.TimeStamp || 0) - (a.metadata?.TimeStamp || 0));
        }

        const totalCount = indexed.success ? indexed.totalCount : files.length;
        const pagedFiles = indexed.success || count === -1
            ? files
            : files.slice(start, start + Math.max(1, count));

        return new Response(JSON.stringify({
            success: true,
            files: pagedFiles.map(file => toHistoryItem(url, file)),
            totalCount,
            returnedCount: pagedFiles.length,
            indexLastUpdated: indexed.indexLastUpdated || Date.now(),
            isIndexedResponse: !!indexed.success,
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            files: [],
            totalCount: 0,
            returnedCount: 0,
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }
}
