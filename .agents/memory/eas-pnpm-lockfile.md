---
name: EAS Build pnpm lockfile sync
description: EAS runs pnpm install --frozen-lockfile from the workspace root; mismatches between package.json and pnpm-lock.yaml cause instant "Install dependencies" failure.
---

EAS Build detects the workspace `pnpm-lock.yaml` and runs `pnpm install --frozen-lockfile` from the **git root** (all 9 workspace packages), not from `artifacts/mobile/`. Any edit to `artifacts/mobile/package.json` that isn't reflected in `pnpm-lock.yaml` fails immediately with `ERR_PNPM_OUTDATED_LOCKFILE`.

**Why:** EAS uses `--frozen-lockfile` by default in CI. The specifiers in the lockfile must exactly match those in every workspace package's `package.json`. `catalog:` references stay as `catalog:` in both files — replacing them with concrete versions in `package.json` without regenerating the lockfile breaks this invariant.

**How to apply:**
- After any edit to `artifacts/mobile/package.json`, run `pnpm install --no-frozen-lockfile` from the workspace root before triggering an EAS build.
- Keep `catalog:` references as `catalog:` in `package.json`; never swap them for concrete versions unless you regenerate the lockfile.
- Pin pnpm version in `eas.json` under `build.base.pnpm` to match the local version (e.g. `"10.26.1"`) — the lockfile format changed between pnpm 8/9/10 and a version mismatch also causes install failure.
- The `gitCommitHash` in EAS build metadata always shows the last committed HEAD; uncommitted-but-tracked file changes ARE included in the EAS archive via `git diff`.
