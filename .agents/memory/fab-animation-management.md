---
name: FAB Animation Management
description: Patterns for reliably running open/close FAB animations without state or touch-handler bugs across multiple taps.
---

## Rule
Always (1) stop the current animation, (2) reset Animated.Values to their initial state, then (3) start the new animation. Track the active animation in a ref.

## Why
If a user taps the FAB while an animation is still in progress, `Animated.parallel` can leave Values at intermediate positions, causing the next open/close sequence to animate from the wrong starting point. The `.start()` callback may also not fire if a new animation interrupts, leaving `fabOpen` state inconsistent.

## How to apply
```js
const currentAnim = useRef<Animated.CompositeAnimation | null>(null);

const openFab = () => {
  currentAnim.current?.stop();
  // Reset all values to closed position
  overlayOpacity.setValue(0);
  pill1TranslateY.setValue(40);
  // ... etc
  setFabOpen(true);
  currentAnim.current = Animated.parallel([...]);
  currentAnim.current.start();
};

const closeFab = (cb?) => {
  currentAnim.current?.stop();
  currentAnim.current = Animated.parallel([...]);
  currentAnim.current.start(({ finished }) => {
    if (finished) { setFabOpen(false); cb?.(); }
  });
};
```

## Touch layering on React Native (native)
For siblings all using `position: absolute`, the **last element in JSX order** is "on top" for touch handling — not z-index alone. Prefer wrapping the overlay backdrop and the FAB in the same container View with `pointerEvents="box-none"`, where the FAB Pressable is rendered LAST.
