const CONTENT_TYPES = {
  json: 'application/json',
  text: 'text/plain',
  html: 'text/html',
};

export function chaiHttp(chai) {
  const Assertion = chai.Assertion;

  Assertion.addMethod('status', function(code) {
    this.assert(
      this._obj.status === code,
      'expected response to have status code #{exp} but got #{act}',
      'expected response to not have status code #{act}',
      code,
      this._obj.status,
    );
  });

  function getHeader(res, name) {
    return res.headers.find(h => `${h.name}`.toLowerCase() === `${name}`.toLowerCase());
  }

  function addContentTypeAssertion(name) {
    const val = CONTENT_TYPES[name] || name;
    Assertion.addProperty(name, function() {
      const h = getHeader(this._obj, 'content-type');
      this.assert(
        h && h.value === val,
        'expected response to have Content-Type #{exp} but got #{act}',
        'expected response to not have Content-Type #{act}',
        val,
        h.value,
      );
    });
  }

  for (const name of Object.keys(CONTENT_TYPES)) {
    addContentTypeAssertion(name);
  }
}
