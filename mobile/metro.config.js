const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// shared/types.ts and server/src/mobileDispatch.ts (the JS dispatch bridge
// - see src/bridge/) both live outside this project root - Metro refuses
// to resolve imports outside its project root by default, unlike Vite (see
// web/vite.config.ts's alias) or plain tsc. Watching the repo root and
// letting node_modules resolution walk up from both locations is Expo's
// documented pattern for this - without it, imports resolve fine in tsc
// but silently fail to bundle.
config.watchFolders = [monorepoRoot]
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules'), path.resolve(monorepoRoot, 'node_modules')]

module.exports = config
