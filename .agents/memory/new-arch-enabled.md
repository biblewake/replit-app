---
name: New Architecture enabled
description: Why newArchEnabled was flipped to true and what the prerequisites were
---

# New Architecture enabled in Bible Wake

## The rule
`newArchEnabled: true` is the correct, permanent setting for Bible Wake. Do not revert it to false.

**Why:** iOS 26 removes the Old Architecture bridge (`RCTNativeModule`) entirely. Every build with `newArchEnabled: false` crashes at launch with SIGABRT ~374ms after cold start. This is an OS-level removal, not a React Native bug.

**How to apply:** If a native crash resurfaces and someone suggests disabling New Arch again, first identify the specific module causing the crash rather than reverting the flag. Disabling New Arch is no longer a valid workaround on iOS 26+.

## History
- Builds 1–8: New Arch was disabled to work around a RevenueCat TurboModule void-method crash (NSException fired on background GCD thread → corrupted Hermes heap). This was correct at the time.
- Builds 9+: New Arch remained disabled; iOS 26 began rejecting Old Arch bridge → SIGABRT on every launch.
- RevenueCat (`react-native-purchases`) was fully removed; `lib/revenuecat.tsx` became a no-op stub returning `isSubscribed: true`. This removed the only known New Arch-incompatible native module.
- New Arch re-enabled. All remaining native deps confirmed compatible (gesture-handler ~2.28, reanimated ^3.16, screens ~4.16, safe-area ~5.6, svg 15.12.1, lottie ^7.3.8, all Expo SDK 54 modules).

## GestureWrapper workaround
`_layout.tsx` has a `GestureWrapper` that lazy-requires `GestureHandlerRootView` and skips it in Expo Go. This was added because Expo Go forced New Arch while `app.json` had it off, causing a crash on import. With New Arch now universally on, the mismatch is gone and the workaround is harmless — leave it in place.

## Xcode 26 / C++20 risk
Xcode 26 Clang may fail to compile some native pods without `CLANG_CXX_LANGUAGE_STANDARD = c++20`. The managed Expo workflow has no checked-in Podfile, so this fix requires a custom config plugin if EAS builds fail with C++ errors.
