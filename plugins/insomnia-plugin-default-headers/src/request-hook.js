module.exports = function (context) {
  const headers = context.request.getEnvironmentVariable('DEFAULT_HEADERS');

  if (!headers) {
    return;
  }

  for (const name of Object.keys(headers)) {
    const value = headers[name];
    context.request.setHeader(name, value);
    console.log(`[header] Set default header ${name}: ${value}`);
  }
};
