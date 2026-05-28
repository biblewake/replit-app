---
name: Nested Modals on Native
description: Why separate Modal-based BottomSheet components fail when opened from inside another Modal in Expo native, and the fix.
---

## Rule
Do NOT render sub-sheets as separate `<Modal>` components from inside a parent Modal. They will fail to appear (or appear behind) on iOS/Android Expo native.

## Why
React Native on iOS creates a native window layer per `<Modal>`. When a sub-sheet Modal is mounted inside or as a sibling of a parent Modal-controlled component, the native layering order is unreliable — sub-sheets may not appear at all, or render behind the parent sheet.

## How to apply
When an AlarmEditSheet (or any full-screen sheet) needs to show sub-sheets (time picker, verse picker, etc.):
- Keep a **single `<Modal>`** for the whole sheet
- Render sub-sheet content as `position: absolute, bottom: 0` `Animated.View` panels **within the same Modal JSX**
- Track `activePanelType` state; animate `panelTranslateY` from SCREEN_HEIGHT → 0 to slide in
- Use `requestAnimationFrame(() => animation.start())` after setting state so the panel content renders before the animation fires
- The panel backdrop press (`onPress={closePanel}`) also lives within the same Modal context — no nested Modals needed

Current implementation: `artifacts/mobile/components/AlarmEditSheet.tsx`
