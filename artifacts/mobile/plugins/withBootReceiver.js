/**
 * withBootReceiver — Expo config plugin that adds an Android BroadcastReceiver
 * for BOOT_COMPLETED. On reboot, Android cancels all AlarmManager-based
 * notifications (used by expo-notifications). This receiver fires immediately
 * after boot and triggers the BACKGROUND_ALARM_CHECK task so that all enabled
 * alarms are rescheduled before the first one could fire.
 *
 * expo-task-manager's TaskBroadcastReceiver already listens for BOOT_COMPLETED,
 * but BackgroundFetchTaskConsumer only restarts the *periodic* alarm on boot —
 * it does NOT execute the task immediately. Our receiver sends a second explicit
 * broadcast that causes immediate execution.
 */

const {
  withAndroidManifest,
  withDangerousMods,
} = require("expo/config-plugins");
const path = require("path");
const fs = require("fs");

const PACKAGE_NAME = "com.tinochiwara.biblewake";
const TASK_NAME = "BACKGROUND_ALARM_CHECK";
const RECEIVER_CLASS = ".BootReceiver";

/** Append the BootReceiver declaration to the app's AndroidManifest. */
function addReceiverToManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    if (!app.receiver) {
      app.receiver = [];
    }

    const alreadyAdded = app.receiver.some(
      (r) => r.$?.["android:name"] === RECEIVER_CLASS
    );
    if (!alreadyAdded) {
      app.receiver.push({
        $: {
          "android:name": RECEIVER_CLASS,
          "android:enabled": "true",
          // Must be exported so the Android OS can deliver system broadcasts.
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
              // HTC / older Samsung devices use this action instead.
              {
                $: {
                  "android:name":
                    "android.intent.action.QUICKBOOT_POWERON",
                },
              },
            ],
          },
        ],
      });
    }

    return cfg;
  });
}

/** Write the BootReceiver.kt Kotlin source file into the Android project. */
function addKotlinSource(config) {
  return withDangerousMods(config, [
    [
      "android",
      async (cfg) => {
        const packageDir = PACKAGE_NAME.replace(/\./g, "/");
        const sourceDir = path.join(
          cfg.modRequest.platformProjectRoot,
          "app",
          "src",
          "main",
          "java",
          packageDir
        );
        fs.mkdirSync(sourceDir, { recursive: true });

        const filePath = path.join(sourceDir, "BootReceiver.kt");
        const contents = `package ${PACKAGE_NAME}

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log

/**
 * BootReceiver — re-schedules Bible Wake alarms after a device reboot.
 *
 * Android cancels all AlarmManager-based notifications on reboot.
 * expo-task-manager's TaskBroadcastReceiver already handles BOOT_COMPLETED by
 * re-enqueuing the *periodic* background-fetch alarm, but that can fire up to
 * 60 minutes later. This receiver sends an additional explicit broadcast that
 * triggers *immediate* execution of the BACKGROUND_ALARM_CHECK task so that
 * all enabled alarms are rescheduled before any of them could be missed.
 */
class BootReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "BibleWakeBootReceiver"
        private const val TASK_MANAGER_BROADCAST_ACTION =
            "expo.modules.taskManager.TaskBroadcastReceiver"
        private const val TASK_MANAGER_RECEIVER_CLASS =
            "expo.modules.taskManager.TaskBroadcastReceiver"
        private const val TASK_NAME = "${TASK_NAME}"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON"
        ) return

        Log.i(TAG, "Boot completed — triggering alarm reschedule task immediately.")

        // Build the same data URI that TaskManagerUtils.createTaskIntent() uses.
        // The "appId" query parameter is the app's scope key, which equals the
        // package name in standalone (non-Expo-Go) builds.
        val dataUri: Uri = Uri.Builder()
            .appendQueryParameter("appId", context.packageName)
            .appendQueryParameter("taskName", TASK_NAME)
            .build()

        // Send an explicit broadcast directly to expo-task-manager's receiver.
        // Explicit targeting is required because TaskBroadcastReceiver is
        // android:exported="false" — only same-package senders can reach it.
        val taskIntent = Intent(TASK_MANAGER_BROADCAST_ACTION).apply {
            component = ComponentName(context.packageName, TASK_MANAGER_RECEIVER_CLASS)
            data = dataUri
        }

        try {
            context.sendBroadcast(taskIntent)
            Log.i(TAG, "Immediate alarm reschedule broadcast sent.")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send alarm reschedule broadcast: \${e.message}")
        }
    }
}
`;

        fs.writeFileSync(filePath, contents, "utf8");
        return cfg;
      },
    ],
  ]);
}

module.exports = function withBootReceiver(config) {
  config = addReceiverToManifest(config);
  config = addKotlinSource(config);
  return config;
};
