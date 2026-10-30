const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), repoRoot]));

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    (moduleName.startsWith("./") || moduleName.startsWith("../")) &&
    moduleName.endsWith(".ts")
  ) {
    const filePath = path.resolve(path.dirname(context.originModulePath), moduleName);
    const insideRepo = filePath === repoRoot || filePath.startsWith(`${repoRoot}${path.sep}`);
    if (insideRepo && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return { type: "sourceFile", filePath };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
