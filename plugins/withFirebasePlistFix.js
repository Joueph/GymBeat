const { withPodfile } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const PODFILE_SNIPPET = `
post_install do |installer|
  installer.pods_project.targets.each do |target|
    if target.name.include? 'react-native-firebase'
      target.build_configurations.each do |config|
        config.build_settings.delete 'INFOPLIST_FILE'
      end
    end
  end
end
`;

const withFirebasePlistFix = (config) => {
  return withPodfile(config, (podfileConfig) => {
    podfileConfig.modResults.contents = mergeContents({
      tag: 'react-native-firebase-plist-fix',
      src: podfileConfig.modResults.contents,
      newSrc: PODFILE_SNIPPET,
      anchor: /post_install/,
      offset: 0,
      comment: '#',
    }).contents;
    return podfileConfig;
  });
};

module.exports = withFirebasePlistFix;