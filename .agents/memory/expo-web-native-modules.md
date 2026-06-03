---
name: Expo native-only modules crash the web bundle at import
description: Some Expo native modules throw at import time on web, taking down the whole route — import them lazily and platform-guard.
---

Some Expo modules that wrap a native module with no web implementation throw
synchronously at **import time** on web (e.g. `expo-tracking-transparency`:
"Cannot find native module 'ExpoTrackingTransparency'"). A static
`import { requestTrackingPermissionsAsync } from "expo-tracking-transparency"`
at the top of a screen file crashes the entire route (ContextNavigator error
boundary) the moment that file is evaluated in the web bundle — even before the
relevant code path runs.

**Why:** the Replit preview renders the Expo app on web. A top-level import of a
web-incompatible native module evaluates immediately and aborts render.

**How to apply:** for modules that have no web shim, do NOT import them at module
top level. Load them lazily and guard on platform inside the effect/handler:

```ts
if (Platform.OS !== "web") {
  import("expo-tracking-transparency")
    .then((m) => m.requestTrackingPermissionsAsync())
    .catch(() => {});
}
```

Modules that DO ship web shims (expo-camera, expo-store-review,
expo-notifications, expo-av) can stay as normal static imports — they no-op or
warn on web instead of throwing. When a new native module crashes the preview,
suspect a top-level import first and switch it to the lazy+guarded pattern.
