export default {
  deprecated: true,
  name: 'timestamp',
  displayName: 'Timestamp',
  description: 'generate timestamp in milliseconds',
  run (context) {
    return Date.now();
  }
};
