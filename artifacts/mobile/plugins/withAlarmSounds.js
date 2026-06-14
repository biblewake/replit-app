/**
 * withAlarmSounds — Expo config plugin that registers the app's alarm sound
 * files as Xcode bundle resources so AlarmKit can play them through the
 * system-level alarm UI (Lock Screen / Dynamic Island).
 *
 * What this does:
 *  1. Copies every .mp3 under assets/sounds/ (flattened — filename only,
 *     no subdirectory) into ios/AlarmSounds/ during Expo prebuild.
 *  2. Adds each file to the Xcode project's "Copy Bundle Resources" build
 *     phase so iOS bundles them at the app bundle root.
 *
 * AlarmKit looks up sounds by filename stem (no path prefix, no extension),
 * so "bright/chirps.mp3" becomes soundName="chirps".
 * All filenames across categories are unique so flattening is safe.
 */

const { withXcodeProject, withDangerousMod } = require("expo/config-plugins");
const path = require("path");
const fs = require("fs");

const ALARM_SOUNDS_DIR = "AlarmSounds";

/**
 * Recursively find all .mp3 files under `dir`.
 * Returns an array of { fullPath, name } objects where `name` is just the
 * filename (e.g. "chirps.mp3") — the category subdirectory is dropped.
 */
function collectMp3Files(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      results.push(...collectMp3Files(fullPath));
    } else if (entry.toLowerCase().endsWith(".mp3")) {
      results.push({ fullPath, name: entry });
    }
  }
  return results;
}

/**
 * Step 1 — copy sound files into the generated ios/ directory so Xcode can
 * reference them. Runs as a dangerous mod for the "ios" platform.
 */
function withCopySounds(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const platformRoot = cfg.modRequest.platformProjectRoot;

      const soundsSrcDir = path.join(projectRoot, "assets", "sounds");
      const soundsDestDir = path.join(platformRoot, ALARM_SOUNDS_DIR);

      if (!fs.existsSync(soundsSrcDir)) {
        console.warn(`[withAlarmSounds] Source directory not found: ${soundsSrcDir}`);
        return cfg;
      }

      fs.mkdirSync(soundsDestDir, { recursive: true });

      const files = collectMp3Files(soundsSrcDir);
      for (const { fullPath, name } of files) {
        fs.copyFileSync(fullPath, path.join(soundsDestDir, name));
      }

      console.log(`[withAlarmSounds] Copied ${files.length} sound files to ${ALARM_SOUNDS_DIR}/`);
      return cfg;
    },
  ]);
}

/**
 * Step 2 — add each sound file to the Xcode project's "Copy Bundle
 * Resources" build phase. Runs after the ios platform project is generated.
 */
function withRegisterSounds(config) {
  return withXcodeProject(config, (cfg) => {
    const xcodeProject = cfg.modResults;
    const projectRoot = cfg.modRequest.projectRoot;

    const soundsSrcDir = path.join(projectRoot, "assets", "sounds");
    if (!fs.existsSync(soundsSrcDir)) {
      return cfg;
    }

    const files = collectMp3Files(soundsSrcDir);
    const targetUuid = xcodeProject.getFirstTarget().uuid;

    // Track which filenames are already registered to avoid duplicates on
    // repeated prebuild runs.
    const existingRefs = xcodeProject.pbxFileReferenceSection();
    const registeredNames = new Set(
      Object.values(existingRefs)
        .filter((ref) => typeof ref === "object" && ref.name)
        .map((ref) => String(ref.name).replace(/^"(.*)"$/, "$1"))
    );

    let added = 0;
    for (const { name } of files) {
      if (registeredNames.has(name)) continue;

      // Path is relative to the ios/ directory (platformProjectRoot).
      xcodeProject.addResourceFile(
        path.join(ALARM_SOUNDS_DIR, name),
        { target: targetUuid }
      );
      added++;
    }

    console.log(`[withAlarmSounds] Registered ${added} new sound file(s) in Xcode project.`);
    return cfg;
  });
}

module.exports = function withAlarmSounds(config) {
  config = withCopySounds(config);
  config = withRegisterSounds(config);
  return config;
};
