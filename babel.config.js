module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // IMPORTANTE: O plugin do Reanimated deve ser o último da lista.
      'react-native-reanimated/plugin',
    ],
  };
};
