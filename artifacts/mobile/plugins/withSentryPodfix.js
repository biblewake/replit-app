/**
 * withSentryPodfix — Expo config plugin that patches the iOS Podfile to work
 * around the `Module '_SentryPrivate' not found` compile error that occurs when
 * building @sentry/react-native <8.38 against Xcode 26's strict module scanner.
 *
 * Root cause: Xcode 26 introduced a new `ScanDependencies` pass that runs
 * before any pod is compiled. The scanner chokes on `SentryViewHierarchyProviderHelper.m`
 * because the `_SentryPrivate` module map hasn't been generated yet at that
 * point in the build graph.
 *
 * Fix: set `DEFINES_MODULE = NO` for the Sentry pod so Xcode skips module-map
 * generation / scanning for that target, which makes the ScanDependencies pass
 * succeed. The pod still compiles normally.
 *
 * Remove this plugin once @sentry/react-native >=8.38 is available and the
 * lockfile is updated — that release includes a corrected module map upstream.
 */

const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SENTRY_FIX_MARKER = "# sentry-podfix: _SentryPrivate workaround";

const SENTRY_FIX_SNIPPET = `
  ${SENTRY_FIX_MARKER}
  # Remove once @sentry/react-native >=8.38 is in the lockfile.
  installer.pods_project.targets.each do |target|
    next unless target.name == 'Sentry'
    target.build_configurations.each do |config|
      config.build_settings['DEFINES_MODULE'] = 'NO'
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end
`;

module.exports = function withSentryPodfix(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile"
      );

      let contents = fs.readFileSync(podfilePath, "utf8");

      if (contents.includes(SENTRY_FIX_MARKER)) {
        return cfg;
      }

      const postInstallRegex = /^(\s*post_install\s+do\s+\|installer\|\s*)$/m;
      if (postInstallRegex.test(contents)) {
        contents = contents.replace(
          postInstallRegex,
          `$1${SENTRY_FIX_SNIPPET}`
        );
      } else {
        contents += `\npost_install do |installer|\n${SENTRY_FIX_SNIPPET}\nend\n`;
      }

      fs.writeFileSync(podfilePath, contents, "utf8");
      return cfg;
    },
  ]);
};
