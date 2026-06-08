const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [
  ...config.resolver.assetExts.filter((ext) => ext !== "mp3"),
  "mp3",
  "wav",
  "aac",
  "m4a",
  "ogg",
];

module.exports = config;
