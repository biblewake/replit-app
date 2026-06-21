/**
 * alarmKitScheduler — iOS 26+ AlarmKit scheduling layer.
 *
 * Uses Apple's AlarmKit framework (via expo-alarm-kit) to schedule alarms that:
 *  - Break through silent mode and all Focus filters
 *  - Display a full-screen alert on the Lock Screen and Dynamic Island
 *  - Appear on Apple Watch
 *
 * This module is a no-op on Android / web. All Platform.OS checks are explicit
 * so AlarmKit code never executes on non-iOS platforms.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import type { LaunchPayload, AuthorizationStatus } from "expo-alarm-kit";

import { Alarm } from "@/context/AlarmContext";

// Re-export LaunchPayload as AlarmKitPayload for backward compatibility.
export type AlarmKitPayload = LaunchPayload;
export type { AuthorizationStatus };

/** Possible outcomes of a scheduleAlarmKit call. */
export type AlarmKitScheduleResult = "ok" | "denied" | "unavailable" | "error";

export interface ScheduleAlarmKitOptions {
  /**
   * When true, skip the requestAuthorization() call and proceed directly to
   * scheduling. Use this for background reschedule paths so the iOS auth
   * dialog is never triggered outside an explicit user action.
   *
   * Default: false — authorization is requested (triggers system prompt on first call).
   */
  skipAuth?: boolean;
}

// ── Persisted authorization status ───────────────────────────────────────────
// We persist whether AlarmKit authorization is denied so useAlarmPermission can
// reflect the state without calling requestAuthorization() passively (which
// would trigger the system prompt when status is notDetermined).

const AK_AUTH_DENIED_KEY = "@bible_wake_ak_auth_denied";

/**
 * Read the persisted AlarmKit denied flag (set by scheduleAlarmKit).
 * Safe to call at any time — never triggers the iOS system prompt.
 * Returns false on Android / web / any read error.
 */
export async function getAlarmKitAuthDenied(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    const val = await AsyncStorage.getItem(AK_AUTH_DENIED_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

/**
 * Check the live AlarmKit authorization status and sync AsyncStorage when the
 * cached state says "denied".
 *
 * Safe to call on every app foreground — it only calls requestAuthorization()
 * when the cached flag is already "true" (denied), meaning the user has already
 * made a decision, so iOS will NOT re-show the system prompt.
 *
 * If the cached flag is not set (authorized or notDetermined), the function
 * returns false immediately without calling requestAuthorization(), preventing
 * an unwanted permission prompt during passive checks.
 *
 * Returns the up-to-date "denied" state (true = still denied, false = authorized).
 * Always returns false on Android / web.
 */
export async function syncAlarmKitAuthIfDenied(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;

  // Only hit the live API when we already have a persisted "denied" flag.
  // If no flag exists, the user is authorized (or never asked) — skip the call
  // to avoid triggering the system prompt while status is notDetermined.
  const wasDenied = await getAlarmKitAuthDenied();
  if (!wasDenied) return false;

  const ak = getAk();
  if (!ak || !ensureConfigured()) {
    // AlarmKit unavailable — leave the cached flag as-is and report denied.
    return true;
  }

  let status: AuthorizationStatus;
  try {
    status = await ak.requestAuthorization();
  } catch {
    // Treat errors conservatively — keep "denied" state.
    return true;
  }

  if (status === "authorized") {
    try {
      await AsyncStorage.removeItem(AK_AUTH_DENIED_KEY);
    } catch {
      // best-effort
    }
    return false;
  }

  // Still denied or notDetermined — ensure the flag is written.
  try {
    await AsyncStorage.setItem(AK_AUTH_DENIED_KEY, "true");
  } catch {
    // best-effort
  }
  return true;
}

/**
 * Persist the AlarmKit authorization result so useAlarmPermission can reflect
 * the real state without triggering the system prompt on passive checks.
 *
 * Call this immediately after requestAlarmKitPermission() resolves:
 *   - "authorized"        → remove the key (permission granted)
 *   - "denied"            → write "true" (user explicitly denied)
 *   - "notDetermined"     → write "true" (asked but not yet answered)
 *   - "unavailable"       → no-op (AlarmKit not available on this build/device;
 *                           do NOT set the denied flag — the user was never asked)
 */
export async function persistAlarmKitAuthStatus(
  status: AuthorizationStatus | "unavailable"
): Promise<void> {
  if (Platform.OS !== "ios") return;
  if (status === "unavailable") return;
  try {
    if (status === "authorized") {
      await AsyncStorage.removeItem(AK_AUTH_DENIED_KEY);
    } else {
      await AsyncStorage.setItem(AK_AUTH_DENIED_KEY, "true");
    }
  } catch {
    // best-effort
  }
}

// ── Lazy require guard ────────────────────────────────────────────────────────
// expo-alarm-kit is iOS-only. Using require() keeps the module from being
// evaluated on Android/web and avoids a hard import that would fail on those
// platforms.

type ExpoAlarmKitModule = typeof import("expo-alarm-kit");

function getAk(): ExpoAlarmKitModule | null {
  if (Platform.OS !== "ios") return null;
  // Pre-check: on New Architecture (JSI), requireNativeModule throws an ObjC
  // exception when the module isn't linked — uncatchable by JS try/catch.
  // NativeModules.ExpoAlarmKit is undefined in Expo Go and in any device build
  // that was compiled before expo-alarm-kit was added as a native dependency.
  if (!NativeModules.ExpoAlarmKit) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-alarm-kit") as ExpoAlarmKitModule;
  } catch {
    return null;
  }
}

// ── configure() — synchronous, called once ───────────────────────────────────
// The real expo-alarm-kit API has configure() as a synchronous call that
// returns boolean. We call it lazily on first use and cache the result.
//
// IMPORTANT — One-time manual setup required for configure() to return true:
//   The App Group "group.com.tinochiwara.biblewake" must be registered in the
//   Apple Developer Portal (Identifiers → App Groups) and included in the app's
//   provisioning profile before configure() will succeed on device builds. EAS
//   must be re-run with credentials after adding the App Group so the profile is
//   regenerated. Without this, configure() returns false and alarms will not fire
//   even though the permission dialog appears. This is a one-time manual step.

let _configured = false;

function ensureConfigured(): boolean {
  if (_configured) return true;
  const ak = getAk();
  if (!ak) return false;
  try {
    const ok = ak.configure("group.com.tinochiwara.biblewake");
    if (!ok) {
      console.warn(
        "[AlarmKit] configure() returned false — App Group " +
        "'group.com.tinochiwara.biblewake' may not be registered in Apple " +
        "Developer Portal or included in the provisioning profile. " +
        "Alarm scheduling will fail, but permission requests will still proceed."
      );
    }
    _configured = ok;
    return ok;
  } catch {
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive the AlarmKit soundName from a Bible Wake sound ID.
 *
 * Sound IDs follow the pattern "<category>_<filename_stem>", e.g.:
 *   "bright_chirps"        → "chirps"
 *   "calm_morning_chirp"   → "morning_chirp"
 *   "energetic_pop_it_up"  → "pop_it_up"
 *
 * withAlarmSounds.js flattens all .mp3 files from assets/sounds/ to the
 * app bundle root, so AlarmKit needs just the stem — no path prefix and no
 * file extension.
 *
 * Returns undefined if soundId is falsy so that AlarmKit falls back to its
 * built-in default tone.
 */
function soundNameFromSoundId(soundId: string | undefined): string | undefined {
  if (!soundId) return undefined;
  const idx = soundId.indexOf("_");
  if (idx === -1) return soundId;
  return soundId.slice(idx + 1);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize AlarmKit (configure the App Group). Safe to call eagerly on iOS,
 * but scheduling calls also call ensureConfigured() implicitly.
 * No-op on Android / web.
 */
export async function initAlarmKit(): Promise<void> {
  ensureConfigured();
}

/**
 * Request Alarms permission explicitly.
 *
 * On iOS, shows the iOS system prompt on the first call; subsequent calls
 * return the cached status without prompting.
 *
 * Returns "authorized", "denied", "notDetermined", or "unavailable".
 * No-op on Android / web (returns "unavailable").
 *
 * NOTE: For spec-compliant behavior, prefer calling scheduleAlarmKit() on
 * first alarm save — it requests authorization automatically. Only call this
 * directly when you need the status without scheduling (e.g. permission checks).
 */
export async function requestAlarmKitPermission(): Promise<AuthorizationStatus | "unavailable"> {
  const ak = getAk();
  if (!ak) return "unavailable";
  // configure() is only needed for scheduling, NOT for authorization.
  // Calling it here can leave the native module in a bad state and cause
  // requestAuthorization() to throw silently, preventing the dialog from appearing.
  try {
    return await ak.requestAuthorization();
  } catch (error) {
    console.error("[AlarmKit] requestAuthorization threw:", error);
    return "denied";
  }
}

/**
 * Schedule (or reschedule) an alarm via AlarmKit on iOS.
 *
 * Lifecycle:
 *  1. Ensures AlarmKit is configured (synchronous configure() singleton).
 *  2. Unless skipAuth=true, requests Alarms authorization — this triggers the
 *     iOS system prompt on the first alarm save. Returns "denied" if the user
 *     refuses; the caller should surface a clear UI message.
 *  3. Cancels any existing AlarmKit alarm for this app alarm ID.
 *  4. Schedules a repeating or one-off alarm.
 *  5. Persists the authorization status (denied flag) for passive checks.
 *
 * Returns "ok" on success, "denied" if permission is denied, "unavailable" on
 * non-iOS, or "error" on unexpected failure.
 */
export async function scheduleAlarmKit(
  alarm: Alarm,
  { skipAuth = false }: ScheduleAlarmKitOptions = {}
): Promise<AlarmKitScheduleResult> {
  const ak = getAk();
  if (!ak) return "unavailable";
  if (!ensureConfigured()) return "error";

  if (!skipAuth) {
    let authStatus: AuthorizationStatus;
    try {
      authStatus = await ak.requestAuthorization();
    } catch {
      authStatus = "denied";
    }
    if (authStatus === "authorized") {
      // User has (re-)authorized — clear any stale denied flag.
      AsyncStorage.removeItem(AK_AUTH_DENIED_KEY).catch(() => {});
    } else {
      // denied or notDetermined: persist denied flag so passive checks reflect it.
      AsyncStorage.setItem(AK_AUTH_DENIED_KEY, "true").catch(() => {});
      return "denied";
    }
  }

  // Cancel any previously scheduled AlarmKit alarm for this app alarm ID.
  await cancelAlarmKit(alarm.id);
  if (!alarm.enabled) return "ok";

  const hour24 = alarm.isPM
    ? alarm.hour === 12
      ? 12
      : alarm.hour + 12
    : alarm.hour === 12
    ? 0
    : alarm.hour;

  const title = alarm.name || "Bible Wake";
  const soundName = soundNameFromSoundId(alarm.soundId);

  // Respect scheduleType: "one-time" always takes the one-off path regardless
  // of which day toggles were last active.
  const isRepeating = alarm.scheduleType !== "one-time" && alarm.days.some(Boolean);

  // Bible Wake days array: index 0 = Sunday … 6 = Saturday
  // AlarmKit weekdays: 1 = Sunday … 7 = Saturday (iOS Calendar convention)
  const weekdays: number[] = [];
  for (let i = 0; i < 7; i++) {
    if (alarm.days[i]) weekdays.push(i + 1);
  }

  try {
    if (isRepeating) {
      const ok = await ak.scheduleRepeatingAlarm({
        id: alarm.id,
        hour: hour24,
        minute: alarm.minute,
        weekdays,
        title,
        soundName,
        launchAppOnDismiss: true,
        launchAppOnSnooze: true,
        dismissPayload: alarm.id,
        snoozePayload: alarm.id,
      });
      if (!ok) return "error";
    } else {
      const now = new Date();
      const target = new Date();
      target.setHours(hour24, alarm.minute, 0, 0);
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }
      const ok = await ak.scheduleAlarm({
        id: alarm.id,
        epochSeconds: Math.floor(target.getTime() / 1000),
        title,
        soundName,
        launchAppOnDismiss: true,
        launchAppOnSnooze: true,
        dismissPayload: alarm.id,
        snoozePayload: alarm.id,
      });
      if (!ok) return "error";
    }
  } catch {
    return "error";
  }

  return "ok";
}

/**
 * Cancel an AlarmKit alarm by the app's alarm ID.
 * No-op if the platform is not iOS.
 */
export async function cancelAlarmKit(alarmId: string): Promise<void> {
  const ak = getAk();
  if (!ak) return;
  try {
    await ak.cancelAlarm(alarmId);
    // Ignore the boolean return — best-effort cancel; failure is non-fatal.
  } catch {}
}

/**
 * Returns the AlarmKit launch payload if the app was opened by an AlarmKit
 * alarm (dismiss or snooze action), or null otherwise.
 *
 * The payload's `alarmId` field is the same ID that was passed to
 * scheduleAlarm / scheduleRepeatingAlarm — no reverse-lookup needed.
 *
 * Must be called on the JS thread; safe to call on every app open.
 * The payload is cleared after retrieval (subsequent calls return null).
 */
export function getLaunchPayload(): LaunchPayload | null {
  const ak = getAk();
  if (!ak) return null;
  try {
    return ak.getLaunchPayload();
  } catch {
    return null;
  }
}
