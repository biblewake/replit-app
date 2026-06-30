/**
 * withExpoAlarmKit — Expo config plugin for expo-alarm-kit / AlarmKit integration.
 *
 * The pnpm patch (patches/expo-alarm-kit@0.1.11.patch) handles pod installation:
 *  - expo-module.config.json: adds podspecPath so use_expo_modules! finds the pod
 *  - ios/ExpoAlarmKit.podspec: lowers minimum 26.1→26.0, adds s.frameworks='AlarmKit'
 *  - ios/ExpoAlarmKitModule.swift: fixes AlarmPresentation.Alert stopButton compile error
 *
 * This plugin does NOT add an explicit pod line — that would duplicate the one
 * that use_expo_modules!/autolinking adds from the pnpm store path, causing:
 *   [!] There are multiple dependencies with different sources for `ExpoAlarmKit`
 *
 * What this plugin does instead:
 *  1. Sets ios.deploymentTarget = "26.0" in Podfile.properties.json
 *     (Podfile defaults to 15.1 without this, causing the pod to be skipped)
 *  2. Injects Ruby into post_install to patch the "Generate Expo Modules Provider"
 *     build phase with --packages expo-alarm-kit (safety net for ExpoModulesProvider.swift)
 *  3. Links AlarmKit.framework directly in the Xcode project
 */

const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PKG_NAME = "expo-alarm-kit";
const FRAMEWORK = "AlarmKit.framework";
const POST_MARKER = "# expo-alarm-kit: build-phase patch (withExpoAlarmKit)";

// ── Step 1+2: Podfile.properties.json + post_install patch ───────────────────
function withExpoAlarmKitPodfile(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const iosDir = cfg.modRequest.platformProjectRoot;

      // 1. Write ios.deploymentTarget = "26.0" so the Podfile platform line
      //    resolves to 26.0 instead of the default 15.1.
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

      // 2. Inject build-phase patching into the existing post_install block.
      //    Inserts AFTER the closing `)` of react_native_post_install(...).
      //    This ensures expo-alarm-kit is passed to --packages in the
      //    Generate Expo Modules Provider build phase script at Xcode build time.
      const podfilePath = path.join(iosDir, "Podfile");
      let podfile = fs.readFileSync(podfilePath, "utf8");

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

        // Match the multiline react_native_post_install(...) call, then insert
        // our snippet before the closing `end` of the post_install block.
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

        fs.writeFileSync(podfilePath, podfile, "utf8");
      }

      return cfg;
    },
  ]);
}

// ── Step 3: Link AlarmKit.framework in the Xcode project ─────────────────────
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
