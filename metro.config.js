const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql'); // Add sql extension support if needed
config.resolver.assetExts.push('wasm'); // Add wasm extension support for sqlite-wasm

module.exports = withNativeWind(config, { input: "./global.css" });
