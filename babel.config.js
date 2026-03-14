module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@contexts': './src/contexts',
            '@screens': './src/screens',
            '@services': './src/services',
            '@repositories': './src/repositories',
            '@navigation': './src/navigation',
            '@types': './src/types',
            '@utils': './src/utils',
            '@config': './src/config',
            '@assets': './assets',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};