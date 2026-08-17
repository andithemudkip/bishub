# Releasing

1. Bump `version` in `package.json`, commit as `chore: release vX.Y.Z`, push.
2. Export the secrets — electron-builder does **not** read `.env.local` (it only
   auto-loads a file named `electron-builder.env`):

   ```bash
   set -a; source .env.local; set +a
   ```

   `GH_TOKEN` publishes to GitHub; `APPLE_KEYCHAIN` / `APPLE_KEYCHAIN_PROFILE`
   notarize the mac build.
3. `npm run release:win` — Windows x64 NSIS.
4. `npm run release:mac` — arm64 dmg + zip, notarized (takes a few minutes).

   Order doesn't matter; both upload to the same release. Each runs
   `npm run build` first, so typecheck and lint must be green.
5. **Publish the draft release on GitHub.** electron-builder uploads it as a
   draft, and `electron-updater` ignores drafts — nothing reaches users until
   you publish it. GitHub creates the git tag at that point.

Dry run: `npm run build:win` / `npm run build:mac` are the same builds with
`--publish never`.

## Notes

- Windows builds are unsigned (no code-signing certificate), so users get a
  SmartScreen warning on first run.
- `release:win` is x64 only, `release:mac` is host arch (arm64) only.
- The TTML lyrics bundle publishes separately via GitHub Actions on push to
  `master` — not part of an app release.
- Upgrades over installs <= 0.1.9 rely on the recovery logic in
  `build/installer.nsh`; read the header comment there before touching it.
