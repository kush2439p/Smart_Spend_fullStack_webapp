const { getDefaultConfig } = require("expo/metro-config");

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);
  
  config.server = {
    port: parseInt(process.env.PORT || "5000", 10),
  };
  
  return config;
})();
