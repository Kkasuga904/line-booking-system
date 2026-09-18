# Repository Guidelines
## Project Structure & Module Organization
- `server/` runs the Express app deployed on Cloud Run; `services/` and `middleware/` hold business logic; `api/` wraps external handlers.
- `src/` collects shared utilities and client scripts; `public/` is the single static source. Update `.deploy-src/` only through the build helpers.
- Infra lives in `infra/terraform`; operational scripts under `scripts/`; automated tests sit in `tests/` (Jest) while `test/` retains legacy smoke runners.

## Build, Test, and Development Commands
- `npm run dev` (or `dev:v2`) bootstraps the server with watching. Use `npm start` for production parity.
- `npm test` executes Jest; `npm run test:smoke` and `npm run test:store-a|b` probe live endpoints.
- `npm run lint` plus `npx prettier --check .` keep formatting clean; fix with `--write`.
- `node tools/verify-assets.js` must pass whenever `public/js/liff-booking-page.js` changes; it enforces parity with `.deploy-src`.
- `npm run optimize` followed by `node tools/fingerprint.js && node tools/patch-html.js` regenerates minified, fingerprinted assets before deploying.

## Coding Style & Naming Conventions
- Stick to Prettier defaults (2 spaces, 100-char width, single quotes, trailing commas, LF endings).
- Modules use ES syntax; `require`/`module.exports` are blocked by ESLint.
- Name files and env presets in kebab-case, classes in PascalCase, variables in camelCase.

## Testing Guidelines
- Place new specs under `tests/**/*.test.js`, mirroring the subject file name.
- Run `npx jest --coverage` when touching business logic; keep coverage trending upward for `api/**`.
- Execute `npm run test:store-a` or `npm run test:store-b` for tenant-specific flows before release.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`...); short imperative subjects, bilingual text acceptable.
- PRs should link the tracking ticket, note risk areas, and list verification steps (tests, `curl /debug/asset-hash`, screenshots).
- When asset fingerprints move, attach both Cloud Run SHA1 hashes in the PR body.

## Deployment & Verification
- Deploy with `gcloud run deploy line-booking-api`; confirm 100% traffic on the new revision via `gcloud run services describe ... --format="value(status.traffic)"`.
- Serve fresh JS by keeping fingerprinted filenames or, temporarily, the `Cache-Control: no-store` shim in `server_cjs_min.js`.
- After deploying, compare `curl https://booking-account1-.../debug/asset-hash?file=js/liff-booking-page.js` with the `line-booking-api` endpoint and reconcile any mismatch before closing the work.
