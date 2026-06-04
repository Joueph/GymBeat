// plugins/with-rnfb-nonmodular-fix.js
const {withDangerousMod, createRunOncePlugin} = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

/**
 * Ensures the Podfile has a post_install hook that later patching can target.
 * @param {string} podfile - Raw Podfile contents.
 * @returns {string} The original Podfile when a hook exists, otherwise the Podfile with an empty hook appended.
 */
function ensurePostInstall(podfile) {
  if(podfile.includes('post_install do |installer|')) {
    return podfile
  }
  return `${podfile}

post_install do |installer|
end
`
}

/**
 * Injects the React Native Firebase non-modular include workaround into the Podfile once.
 * @param {string} podfile - Raw Podfile contents before the Expo dangerous mod writes it.
 * @returns {string} Podfile contents with the RNFB build-setting snippet inserted inside post_install.
 */
function injectSnippet(podfile) {
  const SNIPPET = `
  installer.pods_project.targets.each do |t|
    if ['RNFBApp','RNFBAuth'].include?(t.name)
      t.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        other = config.build_settings['OTHER_CFLAGS'] ||= ['$(inherited)']
        config.build_settings['OTHER_CFLAGS'] = (other + ['-Wno-non-modular-include-in-framework-module']).uniq
      end
    end
  end
`

  // make sure there's a post_install, then append our snippet inside it (once)
  podfile = ensurePostInstall(podfile)
  return podfile.replace(
    /post_install do \|installer\|([\s\S]*?)end/m,
    (match, body) => {
      if(body.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        return match // already patched
      }
      return `post_install do |installer|${body}\n${SNIPPET}end`
    },
  )
}

/**
 * Expo config plugin that patches the generated iOS Podfile during prebuild.
 * @param {import('@expo/config-plugins').ExpoConfig} config - Expo config object being processed.
 * @returns {import('@expo/config-plugins').ExpoConfig} The config with an iOS dangerous mod registered.
 */
const withRNFBNonModularFix = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile')
      const original = fs.readFileSync(podfilePath, 'utf8')
      const updated = injectSnippet(original)
      if(updated !== original) {
        fs.writeFileSync(podfilePath, updated)
      }
      return cfg
    },
  ])

module.exports = createRunOncePlugin(
  withRNFBNonModularFix,
  'with-rnfb-nonmodular-fix',
  "1.0.0"
);
