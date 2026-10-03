#!/usr/bin/env node
// Upload build/screshot-<version>.zip to the Chrome Web Store (API v2) and submit it for review.
//
// Required env: CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_PUBLISHER_ID, CWS_EXTENSION_ID
// Optional env: CWS_PUBLISH=false            -> upload only, leave as draft in the dashboard
//               CWS_DEPLOY_PERCENTAGE=<0-100> -> partial rollout
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://chromewebstore.googleapis.com';

const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
};

const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const zipFile = process.argv[2] ?? path.join(ROOT, 'build', `screshot-${version}.zip`);
const item = `publishers/${env('CWS_PUBLISHER_ID')}/items/${env('CWS_EXTENSION_ID')}`;
const shouldPublish = process.env.CWS_PUBLISH !== 'false';

const token = await getAccessToken();

console.log(`Uploading ${path.relative(ROOT, zipFile)} ...`);
const upload = await call(`${API}/upload/v2/${item}:upload`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/zip' },
  body: fs.readFileSync(zipFile),
});

let state = upload.uploadState;
for (let i = 0; state === 'IN_PROGRESS' && i < 60; i++) {
  await sleep(5000);
  state = (await call(`${API}/v2/${item}:fetchStatus`)).lastAsyncUploadState;
}
if (state !== 'SUCCEEDED') {
  throw new Error(`Upload did not succeed (state: ${state})\n${JSON.stringify(upload, null, 2)}`);
}
console.log(`✔ Uploaded version ${upload.crxVersion ?? version}`);

if (!shouldPublish) {
  console.log('CWS_PUBLISH=false, leaving the upload as a draft.');
  process.exit(0);
}

const body = { publishType: 'DEFAULT_PUBLISH' };
if (process.env.CWS_DEPLOY_PERCENTAGE) {
  body.deployInfos = [{ deployPercentage: Number(process.env.CWS_DEPLOY_PERCENTAGE) }];
}
const published = await call(`${API}/v2/${item}:publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
for (const warning of published.warningInfo?.warnings ?? []) {
  console.warn(`⚠ ${warning.reason}: ${warning.description}`);
}
console.log(`✔ Submitted for review (state: ${published.state})`);

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env('CWS_CLIENT_ID'),
      client_secret: env('CWS_CLIENT_SECRET'),
      refresh_token: env('CWS_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OAuth token request failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function call(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${url} -> ${res.status}\n${text}`);
  return text ? JSON.parse(text) : {};
}
