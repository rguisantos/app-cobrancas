const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Resolver para usar mock do expo-sqlite na web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Use mock for expo-sqlite on web platform
  if (platform === 'web' && moduleName === 'expo-sqlite') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src/__mocks__/expo-sqlite.ts'),
    };
  }
  
  // Use default resolver for other cases
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
