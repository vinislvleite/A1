const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
};

const originalRewriteRequestUrl = config.server?.rewriteRequestUrl;

config.server = {
  ...config.server,
  rewriteRequestUrl: (url) => {
    const rewritten = originalRewriteRequestUrl ? originalRewriteRequestUrl(url) : url;
    try {
      const parsed = new URL(rewritten, 'http://localhost:8081');
      if ((parsed.pathname === '/' || parsed.pathname === '') && parsed.searchParams.has('platform')) {
        parsed.pathname = '/node_modules/expo-router/entry.bundle';
        return rewritten.startsWith('/') ? parsed.pathname + parsed.search : parsed.toString();
      }
    } catch {
      return rewritten;
    }
    return rewritten;
  },
};

module.exports = config;