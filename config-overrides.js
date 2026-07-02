module.exports = function override(config, env) {
  // Tell Webpack to explicitly ignore the 'fs' module
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
  };
  return config;
};
