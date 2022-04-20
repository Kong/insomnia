module.exports = {
  localStorage: {
    getItem: () => undefined,
    setItem: () => {},
  },
  performance:{ now:() => 0 },
  requestAnimationFrame: () => {},
  cancelAnimationFrame: () => {},
};
