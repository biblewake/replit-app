---
name: Bible Wake launch crash
description: Root cause and fix for the recurring TestFlight SIGABRT on launch; why Sentry was removed.
---

# Bible Wake Launch Crash (SIGABRT)

## The rule
`ErrorUtils.setGlobalHandler` must swallow fatal JS errors — never forward to the default handler. The default handler calls `RCTFatal`, which aborts the process with SIGABRT.

**Why:** React Native's default global error handler forwards fatal JS exceptions to `RCTExceptionsManager.reportFatal` → `RCTFatal` → process abort. The native crash trace only shows the RN reporting path, never the real JS error. App Review rejects apps that hard-crash on launch.

**How to apply:** Set `ErrorUtils.setGlobalHandler` once at module top level in `_layout.tsx`, after all other init blocks, so nothing can overwrite it. In dev, log to `console.error`. In prod, swallow silently (no forwarding).

## Why Sentry was removed
`Sentry.wrap()` (previously used as the default export wrapper) re-installs Sentry's own global fatal-forwarding handler at runtime, overwriting the custom `setGlobalHandler` fix on every app launch. Additionally: Sentry added a cold-launch network round-trip (`captureMessage` ping), required a custom Podfix plugin to compile against Xcode 26, and produced zero useful crash reports across builds 12, 14, 18, and 19.

## How to apply / caveats
- This only covers errors routed through `ErrorUtils` AFTER the handler is registered. It does NOT catch: native ObjC/SIGSEGV crashes, JS thrown during module import before `_layout.tsx` runs, or direct native `reportException`.
- `newArchEnabled: false` → old RCT bridge; this targets exactly that pipeline.
- Do not re-add any crash SDK that wraps the root component (e.g. `Sentry.wrap()`, `Bugsnag.start()`) — any SDK that installs its own global handler will undo this fix.
