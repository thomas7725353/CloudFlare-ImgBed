---
name: cloudflare-imgbed-deploy
description: Use when deploying, repairing, or reconfiguring this CloudFlare-ImgBed fork on Cloudflare Workers with D1, KV, R2, GitHub Actions, or Wrangler.
---

# CloudFlare ImgBed Deploy

## Scope

Use this in `/Users/andy/RustroverProjects/CloudFlare-ImgBed` for the fork:

```text
upstream: https://github.com/MarSeventh/CloudFlare-ImgBed
fork:     https://github.com/thomas7725353/CloudFlare-ImgBed
```

The project supports Docker, Pages, and Workers. This setup uses Workers because the repo includes `deploy/worker/generate-routes.js`, `deploy/worker/generate-toml.js`, and `.github/workflows/deploy-worker.yml`.

Never commit API tokens, admin passwords, generated `deploy/worker/wrangler.toml` secrets, `.dev.vars`, `.env`, `.wrangler/`, or `node_modules/`.

## Current Deployment

Cloudflare account:

```text
email: tx991020@gmail.com
account_id: ad59371c9ca78f9556cb6a91a3fa7d0d
```

Production resources:

```text
Worker: cloudflare-imgbed
URL: https://cloudflare-imgbed.tx991020.workers.dev
D1: img_d1
D1 id: 7963929e-3cb3-4681-a2bb-a30bbd45e72f
KV: img_url
KV id: 174164f65d2b4ccf9412f09237270dab
R2: img-r2
```

D1 schema source:

```text
database/init.sql
```

## Resource Bootstrap

Prefer Cloudflare MCP only if authenticated. In this rollout MCP returned `Cloudflare API error: 10000: Authentication error`, so Wrangler OAuth was used.

Check auth:

```bash
rtk codex mcp list
rtk npx wrangler whoami
```

Create missing resources:

```bash
rtk env CLOUDFLARE_ACCOUNT_ID=ad59371c9ca78f9556cb6a91a3fa7d0d npx wrangler d1 create img_d1
rtk env CLOUDFLARE_ACCOUNT_ID=ad59371c9ca78f9556cb6a91a3fa7d0d npx wrangler kv namespace create img_url
rtk env CLOUDFLARE_ACCOUNT_ID=ad59371c9ca78f9556cb6a91a3fa7d0d npx wrangler r2 bucket create img-r2
```

Initialize D1:

```bash
rtk env CLOUDFLARE_ACCOUNT_ID=ad59371c9ca78f9556cb6a91a3fa7d0d npx wrangler d1 execute img_d1 --remote --file database/init.sql
```

Verify D1:

```bash
rtk env CLOUDFLARE_ACCOUNT_ID=ad59371c9ca78f9556cb6a91a3fa7d0d npx wrangler d1 execute img_d1 --remote --command 'SELECT name FROM sqlite_master WHERE type = "table" ORDER BY name;'
```

Expected tables include:

```text
files
settings
index_metadata
index_operations
other_data
```

## GitHub Fork and Secrets

Create/confirm the fork:

```bash
rtk gh repo fork MarSeventh/CloudFlare-ImgBed --clone=false --remote=false
rtk gh repo view thomas7725353/CloudFlare-ImgBed --json nameWithOwner,isFork,defaultBranchRef
```

Set non-token secrets:

```bash
rtk printf '%s' 'ad59371c9ca78f9556cb6a91a3fa7d0d' | gh secret set CLOUDFLARE_ACCOUNT_ID --repo thomas7725353/CloudFlare-ImgBed
rtk printf '%s' '7963929e-3cb3-4681-a2bb-a30bbd45e72f' | gh secret set D1_DATABASE_ID --repo thomas7725353/CloudFlare-ImgBed
rtk printf '%s' '174164f65d2b4ccf9412f09237270dab' | gh secret set KV_NAMESPACE_ID --repo thomas7725353/CloudFlare-ImgBed
rtk printf '%s' 'img-r2' | gh secret set R2_BUCKET_NAME --repo thomas7725353/CloudFlare-ImgBed
rtk printf '%s' 'cloudflare-imgbed' | gh secret set WORKER_NAME --repo thomas7725353/CloudFlare-ImgBed
```

Set `CLOUDFLARE_API_TOKEN` only through a terminal prompt:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo thomas7725353/CloudFlare-ImgBed
```

If a token appears in chat, tell the user to revoke it and create a new one.

Useful token permissions:

```text
Account - Workers Scripts - Edit
Account - Workers KV Storage - Edit
Account - D1 - Edit
Account - Workers R2 Storage - Edit
Account - Account Settings - Read
```

Add zone permissions only if binding a custom domain:

```text
Zone - Zone - Read
Zone - Workers Routes - Edit
Zone - DNS - Edit
```

## Initial Auth Variables

This deployment used `WORKER_VARS` to avoid an unauthenticated admin panel:

```json
{"BASIC_USER":"admin","BASIC_PASS":"<admin-password>","AUTH_CODE":"<upload-auth-code>"}
```

Store with:

```bash
printf '%s' '{"BASIC_USER":"admin","BASIC_PASS":"<admin-password>","AUTH_CODE":"<upload-auth-code>"}' | gh secret set WORKER_VARS --repo thomas7725353/CloudFlare-ImgBed
```

Generate credentials with:

```bash
rtk openssl rand -base64 24
rtk openssl rand -base64 18
```

Do not write actual passwords into this skill or commit them. After first login, tell the user to rotate the admin password in the app.

## Local Deploy Fallback

If GitHub workflow is not registered yet, deploy locally with the same generated config.

Install dependencies first; without this, Wrangler fails to resolve `@aws-sdk/client-s3`, `@cloudflare/pages-plugin-sentry`, and `@sentry/tracing`:

```bash
rtk npm ci --omit=dev --omit=optional
```

Generate Worker adapter and config:

```bash
rtk env WORKER_NAME=cloudflare-imgbed \
  D1_DATABASE_ID=7963929e-3cb3-4681-a2bb-a30bbd45e72f \
  KV_NAMESPACE_ID=174164f65d2b4ccf9412f09237270dab \
  R2_BUCKET_NAME=img-r2 \
  WORKER_VARS='{"BASIC_USER":"admin","BASIC_PASS":"<admin-password>","AUTH_CODE":"<upload-auth-code>"}' \
  node deploy/worker/generate-routes.js

rtk env WORKER_NAME=cloudflare-imgbed \
  D1_DATABASE_ID=7963929e-3cb3-4681-a2bb-a30bbd45e72f \
  KV_NAMESPACE_ID=174164f65d2b4ccf9412f09237270dab \
  R2_BUCKET_NAME=img-r2 \
  WORKER_VARS='{"BASIC_USER":"admin","BASIC_PASS":"<admin-password>","AUTH_CODE":"<upload-auth-code>"}' \
  node deploy/worker/generate-toml.js
```

Deploy:

```bash
rtk env CLOUDFLARE_ACCOUNT_ID=ad59371c9ca78f9556cb6a91a3fa7d0d npx wrangler deploy --config deploy/worker/wrangler.toml
```

After local deploy, restore generated config if it contains secrets:

```bash
rtk git restore deploy/worker/wrangler.toml
rtk git status --short --branch
```

## GitHub Actions Deploy

Once the fork workflow is registered:

```bash
rtk gh workflow list --repo thomas7725353/CloudFlare-ImgBed --all
rtk gh workflow run "Deploy to Cloudflare Workers" --repo thomas7725353/CloudFlare-ImgBed --ref main
rtk gh run watch <run-id> --repo thomas7725353/CloudFlare-ImgBed --exit-status
```

If the workflow does not appear immediately after forking, push a harmless empty commit to the fork:

```bash
rtk git remote add origin https://github.com/thomas7725353/CloudFlare-ImgBed.git
rtk git commit --allow-empty -m "chore: trigger fork deployment"
rtk git push origin main
```

## Verification

Verify the live app:

```bash
rtk curl -I https://cloudflare-imgbed.tx991020.workers.dev
rtk curl -sS https://cloudflare-imgbed.tx991020.workers.dev/api/auth/sessionCheck
```

Expected session check before login:

```json
{"valid":false,"adminRequired":true,"userRequired":true}
```

Verify admin login without printing credentials in final output:

```bash
rtk curl -sS -X POST https://cloudflare-imgbed.tx991020.workers.dev/api/auth/adminLogin \
  -H 'content-type: application/json' \
  --data '{"username":"admin","password":"<admin-password>"}'
```

Expected:

```json
{"success":true}
```

## Common Failures

- MCP `Authentication error [code: 10000]`: use Wrangler OAuth.
- `gh workflow list` returns no workflows after fork: push an empty commit, then list again.
- Wrangler build cannot resolve packages: run `npm ci --omit=dev --omit=optional`.
- `deploy/worker/wrangler.toml` contains live admin variables: restore it before ending or committing.
- GitHub workflow skips deploy: the upstream workflow runs only for forks and only when `CLOUDFLARE_API_TOKEN` is set.
