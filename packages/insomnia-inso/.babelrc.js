export default = /** @type { import('@babel/core').TransformOptions } */ ({
  presets: [
    [
      "@babel/preset-env",
      {
        "targets": {
          "node": "12"
        }
      }
    ],
    // "@babel/preset-typescript"
  ],
});
