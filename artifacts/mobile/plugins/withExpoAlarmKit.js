/**
 * withExpoAlarmKit — Expo config plugin for expo-alarm-kit integration.
 *
 * The pnpm patch (patches/expo-alarm-kit@0.1.11.patch) handles the hard work:
 *  - Adds podspecPath to expo-module.config.json so autolinking finds the pod
 *  - Lowers the podspec minimum from 26.1 → 26.0 so pod install works
 *  - Fixes AlarmPresentation.Alert stopButton compile error in Swift
 *  - Declares s.frameworks = 'AlarmKit' in the podspec
 *
 * This plugin is a safety net that directly links AlarmKit.framework in the
 * Xcode project, covering cases where the CocoaPods xcconfig-based linkage
 * from s.frameworks is not picked up (e.g. static framework builds where the
 * OTHER_LDFLAGS from the pod's xcconfig do not propagate to the app target).
 */

const { withXcodeProject } = require("expo/config-plugins");

const FRAMEWORK = "AlarmKit.framework";

module.exports = function withExpoAlarmKit(config) {
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
};
