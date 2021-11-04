module.exports = function(context) {
  const headers = context.request.getEnvironmentVariable('DEFAULT_HEADERS');

  if (!headers) {
    return;
  }

  for (const name of Object.keys(headers)) {
    const value = headers[name];
    if (context.request.hasHeader(name)) {
      console.log(`[header] Skip setting default header ${name}. Already set to ${value}`);
      continue;
    }
    else if (context.request.hasHeader("DEFAULT-HEADER-IGNORE")) {
      console.log(`[header] Skip setting default header ${name}. DEFAULT-HEADER-IGNORE found`);
      continue;
    }

    if (value==="null") {
      context.request.removeHeader(name);
      console.log(`[header] Remove default header ${name}`)
    } else {
      context.request.setHeader(name, value);
      console.log(`[header] Set default header ${name}: ${value}`);
    }
  }
};
