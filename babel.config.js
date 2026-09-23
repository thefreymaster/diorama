// babel-preset-expo already wires up expo-router, Reanimated/worklets and the
// React Compiler (app.json `experiments.reactCompiler`). Path aliases (`@/`)
// come from tsconfig.json `paths`, which Metro reads natively.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
