
class NetworkRequestConfig {
  constructor () {
    this.headers = [];
    this.url = '';
    this.method = 'GET';
    this.body = null;
  }

  setBody (blob) {
    this.body = blob;
    return this;
  }

  setUrl (url) {
    // Default the proto if it doesn't exist
    if (url.indexOf('://') === -1) {
      this.url = `http://${url}`;
    } else {
      this.url = url;
    }

    return this;
  }

  setMethod (method) {
    this.method = method.toUpperCase().trim();
    return this;
  }

  setHeader (name, value, overwrite = false) {
    const existingHeaderIndex = this.headers.findIndex(
      h => h.name.toLowerCase() === name.toLowerCase()
    );

    const hasHeaderAlready = existingHeaderIndex >= 0;

    // No-op if header exists and we're not overwriting it
    if (hasHeaderAlready && !overwrite) {
      return this;
    }

    if (hasHeaderAlready) {
      this.headers[existingHeaderIndex].name = name;
      this.headers[existingHeaderIndex].value = value;
    } else {
      this.headers.push({name, value});
    }

    return this;
  }
}

export default NetworkRequestConfig;
