---
name: expo-alarm-kit has no config plugin
description: expo-alarm-kit@0.1.11 ships no app.plugin.js — listing it in app.json plugins crashes Expo at startup.
---

# expo-alarm-kit has no config plugin

## The rule
Do NOT add `"expo-alarm-kit"` to the `plugins` array in `app.json`. The package ships no `app.plugin.js`, so Expo's config plugin resolver throws a fatal `PluginError` at startup and the app never loads.

**Why:** expo-alarm-kit@0.1.11 is a native module that does not require any Expo config plugin for its native setup. It is consumed purely as a JS import via lazy `require()` inside `lib/alarmKitScheduler.ts`. Adding it to `plugins` causes:
```
PluginError: Unable to resolve a valid config plugin for expo-alarm-kit.
```
which prevents `expo start` from running at all.

**How to apply:** Only list packages in `app.json` `plugins` when they explicitly document having a config plugin (e.g., `expo-router`, `expo-camera`, `expo-notifications`). expo-alarm-kit needs no entry there.
