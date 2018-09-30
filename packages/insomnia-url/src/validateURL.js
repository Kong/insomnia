const { URL } = require('url');

function validateURL(urlString) {
  try {
    let parsedUrl = new URL(urlString);
    if (!parsedUrl.hostname) return false;
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = { validateURL };
