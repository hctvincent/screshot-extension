# Screshot

Monorepo gồm:

- `drawing-tool/` – thư viện vẽ/chỉnh sửa ảnh (webpack → `drawing-tool/dist/index.js`)
- `extension/` – source Chrome extension (không chứa `index.js`, file này được build tự động)
- `scripts/` – build & publish

## Phát triển

```bash
npm run setup     # cài deps cho drawing-tool
npm run dev       # watch drawing-tool + extension → build/extension
```

Mở `chrome://extensions` → *Load unpacked* → chọn `build/extension`, bấm reload sau mỗi lần sửa.

## Build

```bash
npm run build     # → build/extension/ và build/screshot-<version>.zip
```

`package.json` ở root là nguồn version duy nhất; build sẽ ghi version vào manifest và bỏ `update_url`.

## Release lên Chrome Web Store

```bash
npm version patch   # bump version, sync extension/manifest.json, commit + tag vX.Y.Z
git push --follow-tags
```

Tag `v*.*.*` kích hoạt `.github/workflows/release.yml`: build → upload + submit review lên Chrome Web Store → tạo GitHub Release kèm file zip.

### Cấu hình GitHub (Settings → Environments → `chrome-web-store`)

| Loại     | Tên                 | Giá trị                                                 |
| -------- | ------------------- | ------------------------------------------------------- |
| Secret   | `CWS_CLIENT_ID`     | OAuth client ID (Google Cloud, bật Chrome Web Store API) |
| Secret   | `CWS_CLIENT_SECRET` | OAuth client secret                                     |
| Secret   | `CWS_REFRESH_TOKEN` | Refresh token với scope `https://www.googleapis.com/auth/chromewebstore` |
| Secret   | `CWS_PUBLISHER_ID`  | Developer Dashboard → Publisher → Settings              |
| Variable | `CWS_EXTENSION_ID`  | ID của extension trên Store                             |
| Variable | `CWS_PUBLISH`       | (tuỳ chọn) `false` = chỉ upload bản nháp, không submit  |

Hướng dẫn lấy OAuth credentials: https://developer.chrome.com/docs/webstore/using-api
