/**
 * withExpoAlarmKit — Expo config plugin for expo-alarm-kit / AlarmKit integration.
 *
 * Does four things during `expo prebuild`:
 *
 * 1. Sets ios.deploymentTarget = "26.0" in Podfile.properties.json so the Podfile
 *    picks up the right platform (the Podfile default is 15.1 without this).
 *
 * 2. Adds an explicit `pod 'ExpoAlarmKit', :path => '...'` line inside the
 *    target block so CocoaPods always installs the pod — independent of whether
 *    expo-modules-autolinking finds the package via the pnpm patch.
 *
 * 3. Injects Ruby into the existing `post_install` block so that — at
 *    `pod install` time — the "Generate Expo Modules Provider" build-phase
 *    command gets `--packages expo-alarm-kit` prepended.  This makes Expo's
 *    autolinking code-generator include ExpoAlarmKitModule.self in the
 *    generated ExpoModulesProvider.swift at Xcode build time.
 *
 * 4. Links AlarmKit.framework directly in the Xcode project via withXcodeProject
 *    so the Swift import compiles even when CocoaPods xcconfig linkage is not
 *    propagated to the app target.
 *
 * Run order during prebuild:
 *   withExpoAlarmKitPodfile  (withDangerousMod — runs after all other mods)
 *   withAlarmKitFramework    (withXcodeProject — runs before dangerous mods)
 */

const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const POD_NAME = "ExpoAlarmKit";
const PKG_NAME = "expo-alarm-kit";
const FRAMEWORK = "AlarmKit.framework";

const POD_MARKER = "# expo-alarm-kit: explicit pod (withExpoAlarmKit)";
const POST_MARKER = "# expo-alarm-kit: build-phase patch (withExpoAlarmKit)";

// ── Step 1-3: Podfile + Podfile.properties.json ──────────────────────────────
function withExpoAlarmKitPodfile(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const iosDir = cfg.modRequest.platformProjectRoot;

      // ── 1. Set deployment target ─────────────────────────────────────────
      const propsPath = path.join(iosDir, "Podfile.properties.json");
      let props = {};
      try {
        props = JSON.parse(fs.readFileSync(propsPath, "utf8"));
      } catch (_) {}
      if (props["ios.deploymentTarget"] !== "26.0") {
        props["ios.deploymentTarget"] = "26.0";
        fs.writeFileSync(
          propsPath,
          JSON.stringify(props, null, 2) + "\n",
          "utf8"
        );
        console.log(
          "[withExpoAlarmKit] Set ios.deploymentTarget = 26.0 in Podfile.properties.json"
        );
      }

      // ── 2 + 3. Modify Podfile ────────────────────────────────────────────
      const podfilePath = path.join(iosDir, "Podfile");
      let podfile = fs.readFileSync(podfilePath, "utf8");

      // 2. Add explicit pod line before the `post_install` block.
      //    Skip if autolinking already added an ExpoAlarmKit entry (e.g. when
      //    the pnpm patch still contains podspecPath in expo-module.config.json).
      //    Adding a second entry with a different :path causes a CocoaPods error.
      const podAlreadyPresent = podfile.includes(`pod '${POD_NAME}'`);
      if (!podfile.includes(POD_MARKER) && !podAlreadyPresent) {
        const podLine =
          `\n  ${POD_MARKER}\n` +
          `  pod '${POD_NAME}', :path => '../node_modules/${PKG_NAME}/ios'\n`;

        // Insert right before `  post_install do` (which is inside the target block)
        const postInstallIdx = podfile.indexOf("\n  post_install do");
        if (postInstallIdx !== -1) {
          podfile =
            podfile.slice(0, postInstallIdx) +
            "\n" +
            podLine +
            podfile.slice(postInstallIdx);
        } else {
          // Fallback: append before the last bare `end` in the file
          podfile = podfile.replace(/(\nend\s*)$/, `\n${podLine}\nend\n`);
        }
        console.log(`[withExpoAlarmKit] Added ${POD_NAME} pod to Podfile`);
      } else if (podAlreadyPresent && !podfile.includes(POD_MARKER)) {
        console.log(
          `[withExpoAlarmKit] ${POD_NAME} already in Podfile via autolinking — skipping explicit pod line`
        );
      }

      // 3. Inject build-phase patching into the existing post_install block.
      //    We insert AFTER the closing `)` of react_native_post_install(...).
      if (!podfile.includes(POST_MARKER)) {
        const rubySnippet = [
          "",
          `  ${POST_MARKER}`,
          "  begin",
          "    user_projects = installer.aggregate_targets.map(&:user_project).uniq",
          "    user_projects.each do |project|",
          "      project.targets.each do |target|",
          "        target.build_phases.each do |phase|",
          '          next unless phase.respond_to?(:shell_script)',
          '          next unless phase.shell_script.to_s.include?("generate-modules-provider")',
          `          next if phase.shell_script.to_s.include?("${PKG_NAME}")`,
          `          phase.shell_script = phase.shell_script.gsub("--packages ", "--packages ${PKG_NAME} ")`,
          '          puts "[withExpoAlarmKit] Patched Generate Expo Modules Provider"',
          "        end",
          "      end",
          "      project.save",
          "    end",
          "  rescue => e",
          '    puts "[withExpoAlarmKit] Warning: #{e.message}"',
          "  end",
          "",
        ].join("\n");

        // Match the multiline react_native_post_install(...) call followed by `  end`
        // Pattern: 4-space-indented call, any content, then `    )` on its own line, then `  end`
        const rnPostRegex =
          /([ \t]+react_native_post_install\([\s\S]*?\n[ \t]+\)[ \t]*\n)([ \t]*end\b)/;

        if (rnPostRegex.test(podfile)) {
          podfile = podfile.replace(rnPostRegex, `$1${rubySnippet}$2`);
        } else {
          // Fallback: inject right after `post_install do |installer|`
          podfile = podfile.replace(
            /^(\s*post_install\s+do\s+\|installer\|\s*)$/m,
            `$1${rubySnippet}`
          );
        }
        console.log(
          `[withExpoAlarmKit] Injected ${PKG_NAME} build-phase patch into post_install`
        );
      }

      fs.writeFileSync(podfilePath, podfile, "utf8");
      return cfg;
    },
  ]);
}

// ── Step 4: Link AlarmKit.framework directly in Xcode project ────────────────
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

// ── Main export ───────────────────────────────────────────────────────────────
module.exports = function withExpoAlarmKit(config) {
  config = withExpoAlarmKitPodfile(config);
  config = withAlarmKitFramework(config);
  return config;
};
