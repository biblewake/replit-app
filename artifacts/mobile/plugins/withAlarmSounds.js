/**
 * withAlarmSounds — Expo config plugin that registers the app's alarm sound
 * files as Xcode bundle resources so AlarmKit can play them through the
 * system-level alarm UI (Lock Screen / Dynamic Island).
 *
 * What this does:
 *  1. Copies every .mp3 under assets/sounds/ (flattened — filename only,
 *     no subdirectory) into ios/AlarmSounds/ during Expo prebuild.
 *  2. Creates an "AlarmSounds" group in the Xcode project and adds each file
 *     to the "Copy Bundle Resources" build phase so iOS bundles them at the
 *     app bundle root.
 *
 * AlarmKit looks up sounds by filename stem (no path prefix, no extension),
 * so "bright/chirps.mp3" becomes soundName="chirps".
 * All filenames across categories are unique so flattening is safe.
 *
 * NOTE: addResourceFile(path) fails when `path` contains a directory separator
 * because xcode@3 's correctForPath/correctForResourcesPath returns null for
 * sub-paths. We work around this by creating a PBXGroup for AlarmSounds and
 * adding each file by name-only inside that group.
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
 * Step 2 — add each sound file to the Xcode project.
 *
 * Strategy (avoids the addResourceFile sub-path bug in xcode@3):
 *  a) Create (or reuse) a PBXGroup named "AlarmSounds" whose sourceTree is
 *     "<group>" and whose path is "AlarmSounds" — this maps to ios/AlarmSounds/.
 *  b) Add each .mp3 file to that group.  addFile() accepts a group UUID and
 *     a plain filename, so xcode never has to resolve a sub-path.
 *  c) Add each resulting PBXBuildFile to the "Copy Bundle Resources" phase of
 *     the first target, which is what makes iOS bundle the files.
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
    if (files.length === 0) return cfg;

    const targetUuid = xcodeProject.getFirstTarget().uuid;

    // ── (a) Get or create the AlarmSounds group ───────────────────────────
    let groupUuid;
    const existingGroup = xcodeProject.pbxGroupByName(ALARM_SOUNDS_DIR);
    if (existingGroup) {
      // pbxGroupByName returns the group object; we need its key (UUID).
      const section = xcodeProject.hash.project.objects["PBXGroup"] || {};
      groupUuid = Object.keys(section).find(
        (k) =>
          !k.endsWith("_comment") &&
          section[k] &&
          section[k].name === `"${ALARM_SOUNDS_DIR}"` ||
          section[k] && section[k].name === ALARM_SOUNDS_DIR
      );
    }

    if (!groupUuid) {
      const result = xcodeProject.addPbxGroup([], ALARM_SOUNDS_DIR, ALARM_SOUNDS_DIR);
      groupUuid = result.uuid;

      // Attach the new group to the project's main group so Xcode shows it.
      const mainGroupKey =
        xcodeProject.getFirstProject().firstProject.mainGroup;
      xcodeProject.addToPbxGroup(groupUuid, mainGroupKey);
    }

    // ── (b) Track already-registered filenames to avoid duplicates ────────
    const existingRefs = xcodeProject.pbxFileReferenceSection();
    const registeredNames = new Set(
      Object.values(existingRefs)
        .filter((ref) => typeof ref === "object" && ref.name)
        .map((ref) => String(ref.name).replace(/^"(.*)"$/, "$1"))
    );

    // ── (b2) Collect UUIDs already present in Copy Bundle Resources phases ──
    // Guards against duplicate build-phase entries across repeated prebuild runs.
    const resourcesPhaseSection =
      (xcodeProject.hash &&
        xcodeProject.hash.project &&
        xcodeProject.hash.project.objects &&
        xcodeProject.hash.project.objects["PBXResourcesBuildPhase"]) ||
      {};
    const existingBuildPhaseUuids = new Set();
    for (const [key, phase] of Object.entries(resourcesPhaseSection)) {
      if (key.endsWith("_comment")) continue;
      if (phase && Array.isArray(phase.files)) {
        for (const f of phase.files) {
          existingBuildPhaseUuids.add(typeof f === "object" ? f.value : f);
        }
      }
    }

    // ── (c) Add each file to the group and to Copy Bundle Resources ───────
    let added = 0;
    for (const { name } of files) {
      if (registeredNames.has(name)) continue;

      // addFile(path, groupKey, opt) — path is relative to the group's path,
      // so we only need the bare filename here.
      const fileRef = xcodeProject.addFile(name, groupUuid, {
        target: targetUuid,
        lastKnownFileType: "audio.mp3",
      });

      if (!fileRef) continue;

      // Only register in Copy Bundle Resources if not already present.
      if (!existingBuildPhaseUuids.has(fileRef.uuid)) {
        xcodeProject.addToPbxBuildFileSection(fileRef);
        xcodeProject.addToPbxResourcesBuildPhase(fileRef);
      }

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
