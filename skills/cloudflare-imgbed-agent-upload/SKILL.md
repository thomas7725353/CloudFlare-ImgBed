---
name: cloudflare-imgbed-agent-upload
description: Use when an agent, script, CLI, curl command, or automation needs to upload files to this CloudFlare-ImgBed deployment or use share.gorustai.com without opening the web UI.
---

# Cloudflare ImgBed Agent Upload

## Scope

Use this in `/Users/andy/RustroverProjects/CloudFlare-ImgBed` when uploading files through the deployed API.

Current endpoints:

```text
Preferred: https://share.gorustai.com
Fallback:  https://cloudflare-imgbed.tx991020.workers.dev
```

Do not commit or print actual upload auth codes, API tokens, admin passwords, cookies, or Cloudflare tokens. Use shell variables.

## Upload API

Upload endpoint:

```text
POST /upload
```

Required multipart field:

```text
file
```

Required for this deployment:

```text
uploadChannel=cfr2
```

Useful query parameters:

```text
returnFormat=full     return a full https URL
autoRetry=false       do not fall back to unconfigured channels
uploadFolder=<path>   optional folder prefix
```

Authentication options:

```text
Header authCode: <upload-auth-code>
Header Authorization: Bearer <api-token>
Query  authCode=<upload-auth-code>
```

Prefer the `authCode` header for curl/agent use. Query auth works but exposes the code in URLs and logs.

## One-Off Curl

```bash
export IMGBED_BASE="https://share.gorustai.com"
export IMGBED_AUTH_CODE="<upload-auth-code>"

curl -sS -X POST "$IMGBED_BASE/upload?uploadChannel=cfr2&returnFormat=full&autoRetry=false" \
  -H "authCode: $IMGBED_AUTH_CODE" \
  -F "file=@/path/to/file.png"
```

Expected response:

```json
[{"src":"https://share.gorustai.com/file/example.png"}]
```

Extract just the URL:

```bash
curl -sS -X POST "$IMGBED_BASE/upload?uploadChannel=cfr2&returnFormat=full&autoRetry=false" \
  -H "authCode: $IMGBED_AUTH_CODE" \
  -F "file=@/path/to/file.png" \
  | jq -r '.[0].src'
```

## Reusable Shell Script

```bash
#!/usr/bin/env bash
set -euo pipefail

IMGBED_BASE="${IMGBED_BASE:-https://share.gorustai.com}"
IMGBED_AUTH_CODE="${IMGBED_AUTH_CODE:?set IMGBED_AUTH_CODE first}"
FILE_PATH="${1:?usage: upload-imgbed FILE [folder]}"
UPLOAD_FOLDER="${2:-}"

query="uploadChannel=cfr2&returnFormat=full&autoRetry=false"
if [ -n "$UPLOAD_FOLDER" ]; then
  query="$query&uploadFolder=$UPLOAD_FOLDER"
fi

curl -sS -X POST "$IMGBED_BASE/upload?$query" \
  -H "authCode: $IMGBED_AUTH_CODE" \
  -F "file=@${FILE_PATH}" \
  | jq -r '.[0].src'
```

Usage:

```bash
export IMGBED_AUTH_CODE="<upload-auth-code>"
./upload-imgbed /Users/andy/Desktop/test.png
./upload-imgbed /Users/andy/Desktop/test.png agent-uploads
```

## API Token Variant

If the app admin panel has created an API token with `upload` permission:

```bash
export IMGBED_BASE="https://share.gorustai.com"
export IMGBED_API_TOKEN="<api-token>"

curl -sS -X POST "$IMGBED_BASE/upload?uploadChannel=cfr2&returnFormat=full&autoRetry=false" \
  -H "Authorization: Bearer $IMGBED_API_TOKEN" \
  -F "file=@/path/to/file.png" \
  | jq -r '.[0].src'
```

The code also accepts `Authorization: <api-token>` without `Bearer`, but `Bearer` is clearer.

## Verify A Returned URL

```bash
url="https://share.gorustai.com/file/example.png"
curl -I "$url"
curl -L "$url" -o /tmp/imgbed-download
```

## Common Failures

- `Unauthorized`: missing or wrong `IMGBED_AUTH_CODE`, missing upload-permission API token, or header name typo.
- `Error: No R2 channel provided`: missing `uploadChannel=cfr2` or broken R2 binding/config.
- Response uses `cloudflare-imgbed.tx991020.workers.dev`: the request used the fallback base URL; set `IMGBED_BASE=https://share.gorustai.com`.
- DNS or TLS failure on `share.gorustai.com`: fall back to `https://cloudflare-imgbed.tx991020.workers.dev` and check the custom domain deployment.
- Browser JavaScript CORS issue with `authCode` header: use curl/agent, or use query auth only for controlled internal scripts.

## Smoke Test

Use a non-sensitive temporary file:

```bash
export IMGBED_BASE="https://share.gorustai.com"
export IMGBED_AUTH_CODE="<upload-auth-code>"
printf 'imgbed smoke test\n' > /tmp/imgbed-smoke.txt

url=$(curl -sS -X POST "$IMGBED_BASE/upload?uploadChannel=cfr2&returnFormat=full&autoRetry=false&uploadFolder=agent-tests" \
  -H "authCode: $IMGBED_AUTH_CODE" \
  -F "file=@/tmp/imgbed-smoke.txt;type=text/plain" \
  | jq -r '.[0].src')

echo "$url"
curl -sS "$url"
```
