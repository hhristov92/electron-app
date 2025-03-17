module.exports = {
  target: "electron-preload",
  resolve: {
    fallback: {
      path: require.resolve("path-browserify"), // Use a fallback for `path`
    },
  },
};
