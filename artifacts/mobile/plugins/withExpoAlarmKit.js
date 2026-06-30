/**
 * withExpoAlarmKit — Expo config plugin that manually registers expo-alarm-kit
 * when the package's podspec is not auto-discovered by expo-modules-autolinking.
 *
 * The autolinking scanner (listFilesInDirectories) looks for .podspec files one
 * level deep inside the package directory. On some pnpm setups the symlink/
 * realpath resolution puts the package in a store path where the scan fails.
 *
 * This plugin does three things to work around that:
 *  1. Adds `pod 'ExpoAlarmKit'` explicitly to the Podfile so the pod is always
 *     installed regardless of autolinking.
 *  2. Injects `expo-alarm-kit` into the --packages argument of the Xcode
 *     "Generate Expo Modules Provider" build phase script so that
 *     ExpoModulesProvider.swift always contains ExpoAlarmKitModule.self (the
 *     build phase regenerates the file on every Xcode build, so patching the
 *     file directly at prebuild time would be overwritten).
 *  3. Links AlarmKit.framework (the Apple system framework) with Required status
 *     so the app compiles without a manual step in Xcode.
 */

const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");
const path = require("path");
const fs = require("fs");

const PKG_NAME = "expo-alarm-kit";
const POD_NAME = "ExpoAlarmKit";
const MODULE_CLASS = "ExpoAlarmKitModule";
const FRAMEWORK = "AlarmKit.framework";

function withExpoAlarmKitPod(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile"
      );
      if (!fs.existsSync(podfilePath)) return cfg;

      let content = fs.readFileSync(podfilePath, "utf8");
      if (content.includes(POD_NAME)) {
        console.log(
          `[withExpoAlarmKit] ${POD_NAME} already present in Podfile — skipping`
        );
        return cfg;
      }

      const podLine = `  pod '${POD_NAME}', :path => '../node_modules/${PKG_NAME}/ios'\n`;

      if (content.includes("use_expo_modules!")) {
        content = content.replace(
          /([ \t]*use_expo_modules![ \t]*\n)/,
          `$1${podLine}`
        );
      } else {
        content += `\n${podLine}`;
      }

      fs.writeFileSync(podfilePath, content, "utf8");
      console.log(`[withExpoAlarmKit] Added ${POD_NAME} pod to Podfile`);
      return cfg;
    },
  ]);
}

function withExpoAlarmKitBuildPhase(config) {
  return withXcodeProject(config, (cfg) => {
    const xcodeProject = cfg.modResults;
    const phases =
      xcodeProject.hash?.project?.objects?.["PBXShellScriptBuildPhase"] ?? {};

    let patched = false;
    for (const [key, phase] of Object.entries(phases)) {
      if (key.endsWith("_comment") || !phase?.shellScript) continue;

      const raw = phase.shellScript;

      if (!raw.includes("generate-modules-provider")) continue;

      if (raw.includes(PKG_NAME)) {
        console.log(
          `[withExpoAlarmKit] ${PKG_NAME} already in build phase — skipping`
        );
        patched = true;
        break;
      }

      phase.shellScript = raw.replace(
        "--packages ",
        `--packages ${PKG_NAME} `
      );

      console.log(
        `[withExpoAlarmKit] Injected ${PKG_NAME} into Generate Expo Modules Provider build phase`
      );
      patched = true;
      break;
    }

    if (!patched) {
      console.warn(
        "[withExpoAlarmKit] Could not find Generate Expo Modules Provider build phase — ExpoModulesProvider.swift may not include ExpoAlarmKitModule"
      );
    }

    return cfg;
  });
}

function withAlarmKitFramework(config) {
  return withXcodeProject(config, (cfg) => {
    const xcodeProject = cfg.modResults;

    const fileRefs =
      xcodeProject.hash?.project?.objects?.["PBXFileReference"] ?? {};
    const alreadyLinked = Object.values(fileRefs).some(
      (r) =>
        r &&
        typeof r === "object" &&
        (r.name === FRAMEWORK ||
          r.name === `"${FRAMEWORK}"` ||
          r.path === FRAMEWORK ||
          r.path === `"${FRAMEWORK}"`)
    );

    if (alreadyLinked) {
      console.log(
        `[withExpoAlarmKit] ${FRAMEWORK} already linked — skipping`
      );
      return cfg;
    }

    xcodeProject.addFramework(FRAMEWORK, {
      target: xcodeProject.getFirstTarget().uuid,
      weak: false,
    });

    console.log(`[withExpoAlarmKit] Linked ${FRAMEWORK}`);
    return cfg;
  });
}

module.exports = function withExpoAlarmKit(config) {
  config = withExpoAlarmKitPod(config);
  config = withExpoAlarmKitBuildPhase(config);
  config = withAlarmKitFramework(config);
  return config;
};
