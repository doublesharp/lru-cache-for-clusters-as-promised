module.exports = {
  timeout: 5000,
  args: {
    one: 'one',
    two: 'two',
    three: 'three',
    four: 'four',
    five: 'five',
  },
  server: {
    port: process.env.PORT || 4242,
    host: '127.0.0.1',
  },
};
