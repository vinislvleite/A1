const path = require('path');
const os = require('os');
const fs = require('fs');
const v8 = require('v8');
const { getDefaultConfig } = require('expo/metro-config');

try {
  const tmp = os.tmpdir();
  const entries = fs.readdirSync(tmp);
  for (const entry of entries) {
    if (entry.startsWith('metro-file-map')) {
      const fullPath = path.join(tmp, entry);
      try {
        const buffer = fs.readFileSync(fullPath);
        v8.deserialize(buffer);
      } catch {
        fs.unlinkSync(fullPath);
      }
    }
  }
} catch {}

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const escapedRoot = projectRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rootExcludeRegex = new RegExp(`^(?:${escapedRoot}[\\\\/])?(?:android|ios|docs|dist|\\.git)(?:[\\\\/]|$)`);

const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList].filter(Boolean);

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
  blockList: [...existingBlockList, rootExcludeRegex],
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
