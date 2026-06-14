/**
 * alarmKitScheduler — iOS 26+ AlarmKit scheduling layer.
 *
 * Uses Apple's AlarmKit framework (via expo-alarm-kit) to schedule alarms that:
 *  - Break through silent mode and all Focus filters
 *  - Display a full-screen alert on the Lock Screen and Dynamic Island
 *  - Appear on Apple Watch
 *
 * This module is a no-op on Android. All Platform.OS checks are explicit
 * so AlarmKit code never executes on non-iOS platforms.
 *
 * Storage:
 *  "@bible_wake_ak_ids"      — app alarm ID → AlarmKit UUID (forward map)
 *  "@bible_wake_ak_reverse"  — AlarmKit UUID → app alarm ID (reverse map)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { Alarm } from "@/context/AlarmContext";

const AK_IDS_KEY = "@bible_wake_ak_ids";
const AK_REVERSE_KEY = "@bible_wake_ak_reverse";

// ── AlarmKit module type (expo-alarm-kit) ─────────────────────────────────────

interface AlarmKitModule {
  configure(appGroup: string): Promise<void>;
  requestAuthorization(): Promise<string>;
  scheduleAlarm(options: AlarmKitOneOffOptions): Promise<string>;
  scheduleRepeatingAlarm(options: AlarmKitRepeatingOptions): Promise<string>;
  cancelAlarm(uuid: string): Promise<void>;
  getLaunchPayload(): AlarmKitPayload | null;
}

interface AlarmKitOneOffOptions {
  /** Unix timestamp (ms) for the alarm fire time */
  timestamp: number;
  title: string;
  soundName?: string;
  launchAppOnDismiss?: boolean;
  launchAppOnSnooze?: boolean;
}

interface AlarmKitRepeatingOptions {
  hour: number;
  minute: number;
  /** 1=Sunday … 7=Saturday, matching iOS Calendar weekday convention */
  weekdays: number[];
  title: string;
  soundName?: string;
  launchAppOnDismiss?: boolean;
  launchAppOnSnooze?: boolean;
}

export interface AlarmKitPayload {
  /** AlarmKit UUID of the alarm that fired */
  alarmId?: string;
  action?: "dismiss" | "snooze";
}

/** Possible outcomes of a scheduleAlarmKit call. */
export type AlarmKitScheduleResult = "ok" | "denied" | "unavailable" | "error";

function getAlarmKitModule(): AlarmKitModule | null {
  if (Platform.OS !== "ios") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-alarm-kit") as AlarmKitModule;
  } catch {
    return null;
  }
}

// ── Singleton configure guarantee ─────────────────────────────────────────────
// Ensures configure() is awaited exactly once before any scheduling attempt,
// including calls from background task context where initAlarmKit() may not
// have run.

let _configurePromise: Promise<void> | null = null;

async function ensureConfigured(): Promise<boolean> {
  const ak = getAlarmKitModule();
  if (!ak) return false;
  if (!_configurePromise) {
    _configurePromise = ak.configure("group.com.tinochiwara.biblewake").catch(() => {
      // Reset so next call retries if configure threw
      _configurePromise = null;
    });
  }
  await _configurePromise;
  return true;
}

// ── AsyncStorage helpers ───────────────────────────────────────────────────────

async function loadAkIds(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(AK_IDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveAkIds(map: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(AK_IDS_KEY, JSON.stringify(map));
  } catch {}
}

async function loadAkReverse(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(AK_REVERSE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveAkReverse(map: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(AK_REVERSE_KEY, JSON.stringify(map));
  } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize AlarmKit (configure the App Group). Safe to call eagerly, but
 * scheduling calls also call this implicitly via ensureConfigured() so it is
 * not required to call this first.
 * No-op on Android.
 */
export async function initAlarmKit(): Promise<void> {
  await ensureConfigured();
}

/**
 * Request Alarms permission explicitly. Shows the iOS system prompt on first
 * call; subsequent calls return the cached status without prompting.
 * Returns "authorized", "denied", or "unavailable".
 * No-op on Android (returns "unavailable").
 *
 * NOTE: For spec-compliant behavior, prefer calling scheduleAlarmKit() on
 * first alarm save — it requests authorization automatically and returns the
 * result. Only call this directly when you need to pre-warm the status without
 * scheduling an alarm (e.g. for status checks).
 */
export async function requestAlarmKitPermission(): Promise<string> {
  const ak = getAlarmKitModule();
  if (!ak) return "unavailable";
  const configured = await ensureConfigured();
  if (!configured) return "unavailable";
  try {
    return await ak.requestAuthorization();
  } catch {
    return "denied";
  }
}

/**
 * Resolve a Bible Wake alarm ID from an AlarmKit UUID.
 * Used in _layout.tsx to navigate to alarm-ringing when launched by AlarmKit.
 */
export async function resolveAlarmIdFromAkUuid(akUuid: string): Promise<string | null> {
  const reverse = await loadAkReverse();
  return reverse[akUuid] ?? null;
}

/**
 * Options for scheduleAlarmKit.
 */
export interface ScheduleAlarmKitOptions {
  /**
   * When true, skip the requestAuthorization() call and proceed directly to
   * scheduling. Use this for background reschedule paths (e.g. rescheduleAllAlarms
   * called on foreground) so the iOS auth dialog is never triggered outside an
   * explicit user action.
   *
   * Default: false — authorization is requested (triggers system prompt on first call).
   */
  skipAuth?: boolean;
}

/**
 * Schedule (or reschedule) an alarm via AlarmKit on iOS.
 *
 * Lifecycle:
 *  1. Ensures AlarmKit is configured (configure() singleton).
 *  2. Unless skipAuth=true, requests Alarms authorization — this triggers the
 *     iOS system prompt on the first alarm save. Returns "denied" if the user
 *     refuses; the caller should surface a clear UI message.
 *  3. Cancels any existing AlarmKit alarm for this app alarm ID.
 *  4. Schedules a repeating or one-off alarm.
 *  5. Persists the AlarmKit UUID in AsyncStorage.
 *
 * Returns "ok" on success, "denied" if permission is denied, "unavailable" on
 * non-iOS, or "error" on unexpected failure.
 */
export async function scheduleAlarmKit(
  alarm: Alarm,
  { skipAuth = false }: ScheduleAlarmKitOptions = {}
): Promise<AlarmKitScheduleResult> {
  const ak = getAlarmKitModule();
  if (!ak) return "unavailable";

  const configured = await ensureConfigured();
  if (!configured) return "error";

  // Request authorization — triggers the iOS system prompt on the first call.
  // Skipped in reschedule paths (skipAuth=true) to avoid prompting outside
  // an explicit user action. If auth is denied, scheduling will fail silently.
  if (!skipAuth) {
    let authStatus: string;
    try {
      authStatus = await ak.requestAuthorization();
    } catch {
      authStatus = "denied";
    }
    if (authStatus !== "authorized") return "denied";
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

  // Custom alarm sounds are out of scope for this release (task spec: "uses
  // system default for now"). soundName is left undefined so AlarmKit uses
  // the default iOS alarm tone. A follow-up task (#155) will bundle the app's
  // custom sounds as Xcode resources and wire them here.
  const title = alarm.name || "Bible Wake";
  const hasAnyDay = alarm.days.some(Boolean);

  // Bible Wake days array: index 0 = Sunday … 6 = Saturday
  // AlarmKit weekdays: 1 = Sunday … 7 = Saturday (iOS Calendar convention)
  const weekdays: number[] = [];
  for (let i = 0; i < 7; i++) {
    if (alarm.days[i]) weekdays.push(i + 1);
  }

  let akUuid: string;
  try {
    if (hasAnyDay) {
      akUuid = await ak.scheduleRepeatingAlarm({
        hour: hour24,
        minute: alarm.minute,
        weekdays,
        title,
        launchAppOnDismiss: true,
        launchAppOnSnooze: true,
      });
    } else {
      const now = new Date();
      const target = new Date();
      target.setHours(hour24, alarm.minute, 0, 0);
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }
      akUuid = await ak.scheduleAlarm({
        timestamp: target.getTime(),
        title,
        launchAppOnDismiss: true,
        launchAppOnSnooze: true,
      });
    }
  } catch {
    return "error";
  }

  // Persist forward and reverse UUID mappings.
  const [fwd, rev] = await Promise.all([loadAkIds(), loadAkReverse()]);
  fwd[alarm.id] = akUuid;
  rev[akUuid] = alarm.id;
  await Promise.all([saveAkIds(fwd), saveAkReverse(rev)]);

  return "ok";
}

/**
 * Cancel an AlarmKit alarm by the app's alarm ID.
 * No-op if no AlarmKit UUID is stored for this alarm or platform is not iOS.
 */
export async function cancelAlarmKit(alarmId: string): Promise<void> {
  const ak = getAlarmKitModule();
  if (!ak) return;

  const fwd = await loadAkIds();
  const akUuid = fwd[alarmId];
  if (!akUuid) return;

  try {
    await ak.cancelAlarm(akUuid);
  } catch {}

  const rev = await loadAkReverse();
  delete fwd[alarmId];
  delete rev[akUuid];
  await Promise.all([saveAkIds(fwd), saveAkReverse(rev)]);
}

/**
 * Returns the AlarmKit launch payload if the app was opened by an AlarmKit
 * alarm (dismiss or snooze action), or null otherwise.
 * Must be called on the JS thread; safe to call on every app open.
 */
export function getLaunchPayload(): AlarmKitPayload | null {
  const ak = getAlarmKitModule();
  if (!ak) return null;
  try {
    return ak.getLaunchPayload();
  } catch {
    return null;
  }
}
