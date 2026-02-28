# Desktop GitHub Actions Releases

This project uses GitHub Actions to build and publish desktop release artifacts when a tag matching `v*` is pushed.

## Workflow

- File: `.github/workflows/desktop-release.yml` (repository root)
- Trigger: `push` tags matching `v*` (example: `v0.1.1`)
- Jobs:
  - `build-macos` runs `npm run tauri:build -- --bundles app`
  - `build-windows` runs `npm run tauri:build`

Both jobs run from repository root and target the desktop project with `working-directory: desktop`.

## Required GitHub Secrets

Add these repository secrets before cutting a release:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## macOS Notarization Secrets

For macOS signing/notarization in GitHub Actions, add these secrets.

Required:
- `APPLE_CERTIFICATE` (base64 `.p12`)
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_API_KEY` (Key ID)
- `APPLE_API_ISSUER` (Issuer ID)
- `APPLE_API_KEY_P8` (contents of the `AuthKey_<KEYID>.p8` file)

Optional:
- `APPLE_SIGNING_IDENTITY` (`Developer ID Application: …`)

The workflow writes the `.p8` file at runtime to `desktop/private_keys/AuthKey_<KEYID>.p8`. No private keys are committed.

The updater public key is already committed in `desktop/src-tauri/tauri.conf.json` (`plugins.updater.pubkey`).

## Windows Code Signing Secrets

Required:
- `WINDOWS_CERT_PFX_B64` (base64 `.pfx`)
- `WINDOWS_CERT_PASSWORD`

Optional:
- `WINDOWS_TIMESTAMP_URL` (defaults to `http://timestamp.digicert.com`)

CI writes the `.pfx` file into `RUNNER_TEMP` at runtime and does not commit it.

CI signs `.exe`/`.msi` files under `desktop/src-tauri/target/release/bundle/**` and verifies signatures strictly.

## Updater Metadata

`desktop/src-tauri/tauri.conf.json` already has:

- `bundle.createUpdaterArtifacts: true`

This enables generation of updater metadata/signatures during build.

## Uploaded Release Assets

The workflow uploads everything under desktop/src-tauri/target/release/bundle/**, including updater manifests (e.g., latest.json) and *.sig files depending on platform output paths.

## How To Cut A Release

1. Bump the app version in:
   - `desktop/package.json`
   - `desktop/src-tauri/tauri.conf.json`
2. Commit and push your version bump.
3. Create and push a release tag:

```bash
git tag v0.1.1
git push origin v0.1.1
```

4. Wait for the `Desktop Release` workflow to finish.
5. Verify the GitHub Release for tag `v0.1.1` contains bundle artifacts, `*.sig`, and `latest.json`.
