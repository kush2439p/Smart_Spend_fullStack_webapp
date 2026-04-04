const { getDefaultConfig } = require("expo/metro-config");

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);
  
  config.server = {
    port: 8082, // Expo metro bundler port
  };
  
  return config;
})();