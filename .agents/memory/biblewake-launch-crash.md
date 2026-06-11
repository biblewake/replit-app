---
name: Bible Wake TestFlight launch crash (RCTFatal SIGABRT)
description: Why every TestFlight build crashed on launch and the decision to swallow fatal JS errors
---

# Bible Wake launch crash: the global handler was the crash

Every iOS TestFlight build (through build 18) crashed ~575ms after launch with
`EXC_CRASH (SIGABRT)` → `RCTFatal` → `RCTExceptionsManager.reportException` on a
background GCD queue. The native trace ONLY shows the error-**reporting** path,
never the source JS error — so per-file patches kept missing it.

**Root cause:** the app's own global error handler (`ErrorUtils.setGlobalHandler`
in `artifacts/mobile/app/_layout.tsx`) was explicitly forwarding fatal errors to
RN's `defaultFatalHandler`, which calls `RCTFatal` and aborts the process. So
*any* uncaught fatal JS error anywhere at startup was converted into a hard
launch crash.

**Decision:** the global handler now SWALLOWS uncaught JS errors (reports to
Sentry, logs in dev) and never forwards to `defaultFatalHandler`.

**Why:** a shipped app must degrade gracefully — App Review rejects launch
crashes outright. A blank/degraded screen is debuggable; a SIGABRT on launch is
not. Errors still reach Sentry with a full JS stack so the true root throw can be
found once the app survives.

**How to apply / caveats:**
- This only covers errors routed through `ErrorUtils` AFTER the handler is
  registered. It does NOT catch: native ObjC/SIGSEGV crashes, JS thrown during
  module import before `_layout.tsx` runs, or direct native `reportException`.
- Treat the swallow as a containment layer, not the final root-cause fix. To find
  the real throw, confirm Sentry DSN is in the EAS build (separate from Replit
  secrets — must be set in expo.dev EAS env vars) and read the captured event.
- `newArchEnabled: false` → old RCT bridge; this targets exactly that pipeline.
- Sentry verification ping (`captureMessage("Bible Wake: app launched")`) lives in
  `_layout.tsx`; remove it once Sentry delivery is confirmed in a real build.
