---
name: RN layout null navigator trap
description: Returning null from an Expo Router root layout unmounts the Stack — router.replace() then has nowhere to render, causing a permanent black screen.
---

# Expo Router: never return null when you also need to navigate

## The rule
In an Expo Router `_layout.tsx`, the Stack (or Tabs) navigator MUST stay
mounted for `router.replace()` / `router.push()` to render its destination.
Returning `null` from the layout component unmounts the navigator entirely.
The router updates its navigation state, but nothing renders the new route →
permanent black screen.

**Why:** Expo Router routes are file-based, but they are rendered INSIDE the
navigator component returned by the layout. No navigator → no rendering context
for the route.

## Safe guard
```ts
// SAFE — only blocks the very first paint (< 100 ms, before AsyncStorage resolves)
if (onboardingComplete === null) return null;
```
This is safe because no redirect fires while the flag is null; once it resolves,
the component re-renders and returns the Stack.

## Unsafe guard (causes black screen)
```ts
// WRONG — these states all trigger router.replace() in a sibling useEffect,
// but with null returned, the Stack is unmounted and navigation can't render.
if (onboardingComplete === false) return null;
if (isAnonymous) return null;
if (!isSubscribed) return null;
```

## How to apply
Any time you are tempted to add a `return null` guard that corresponds to a
`router.replace()` call in a `useEffect`, reconsider. Instead:
- Keep the Stack rendered (return the Stack element).
- Let the useEffect handle navigation.
- Accept the one-frame flash of tab content; with `animation: "none"` it is
  imperceptible.
- Use a spinner (returning a real element, not null) only for states where
  NO redirect fires (e.g. `subscriptionLoading` while auth is already resolved).
