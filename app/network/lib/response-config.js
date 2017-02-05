class NetworkResponseConfig {
  constructor () {
    this.headers = [];
    this.url = '';
    this.method = '';
    this.body = null;
    this.bodyEncoding = null;
    this.bodySize = 0;
    this.error = null;
    this.startTime = 0;
    this.endTime = 0;
    this.contentType = null;
    this.statusMessage = '';
    this.statusCode = 0;
  }

  getElapsedTime () {
    return this.endTime - this.startTime;
  }

  getHeaders (name) {
    return this.headers.filter(
      h => h.name.toLowerCase() === name.toLowerCase()
    );
  }

  setStartTime (startTime) {
    this.startTime = startTime;
    return this;
  }

  setEndTime (endTime) {
    this.endTime = endTime;
    return this;
  }

  setError (message) {
    this.error = message || 'Unknown Error';
    return this;
  }

  setContentType (contentType) {
    this.contentType = contentType || null;
    return this;
  }

  setStatusCode (code) {
    this.statusCode = code || 0;
    return this;
  }

  setStatusMessage (message) {
    this.statusMessage = message || '';
    return this;
  }

  setUrl (url) {
    this.url = url;
    return this;
  }

  setBody (body, encoding, size) {
    this.setBodyEncoding(encoding);
    this.setBodySize(size);
    this.body = body;
    return this;
  }

  setBodySize (bytes) {
    this.bodySize = bytes;
    return this;
  }

  setBodyEncoding (encoding) {
    this.bodyEncoding = encoding;
    return this;
  }

  setHeader (name, value) {
    // Responses can have multiple values for the same header, so
    // we don't have to worry if the same one was already added.
    this.headers.push({name, value});
    return this;
  }
}

export default NetworkResponseConfig;
