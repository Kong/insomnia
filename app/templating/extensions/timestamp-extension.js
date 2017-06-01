export default {
  deprecated: true,
  name: 'timestamp',
  displayName: 'Timestamp',
  description: 'generate timestamp in milliseconds',
  defaultFill: 'timestamp',
  run (context) {
    return Date.now();
  }
};
