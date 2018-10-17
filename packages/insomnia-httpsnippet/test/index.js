/* global describe, it */

'use strict';

var fixtures = require('./fixtures');
var HTTPSnippet = require('../src');

var should = require('should');

describe('HTTPSnippet', function() {
  it('should return false if no matching target', function(done) {
    var snippet = new HTTPSnippet(fixtures.requests.short);

    snippet.convert(null).should.eql(false);

    done();
  });

  it('should fail validation', function(done) {
    var snippet;

    /* eslint-disable no-extra-parens */
    (function() {
      snippet = new HTTPSnippet({ yolo: 'foo' });
    }.should.throw(Error));

    should.not.exist(snippet);

    done();
  });

  it('should parse HAR file with multiple entries', function(done) {
    var snippet = new HTTPSnippet(fixtures.har);

    snippet.should.have.property('requests').and.be.an.Array;
    snippet.requests.length.should.equal(2);

    var results = snippet.convert('shell');

    results.should.be.an.Array;
    results.length.should.equal(2);

    done();
  });

  it('should convert multipart/mixed to multipart/form-data', function(done) {
    var req = new HTTPSnippet(fixtures.mimetypes['multipart/mixed']).requests[0];

    req.postData.mimeType.should.eql('multipart/form-data');

    done();
  });

  it('should convert multipart/related to multipart/form-data', function(done) {
    var req = new HTTPSnippet(fixtures.mimetypes['multipart/related']).requests[0];

    req.postData.mimeType.should.eql('multipart/form-data');

    done();
  });

  it('should convert multipart/alternative to multipart/form-data', function(done) {
    var req = new HTTPSnippet(fixtures.mimetypes['multipart/alternative']).requests[0];

    req.postData.mimeType.should.eql('multipart/form-data');

    done();
  });

  it('should convert text/json to application/json', function(done) {
    var req = new HTTPSnippet(fixtures.mimetypes['text/json']).requests[0];

    req.postData.mimeType.should.eql('application/json');

    done();
  });

  it('should convert text/x-json to application/json', function(done) {
    var req = new HTTPSnippet(fixtures.mimetypes['text/x-json']).requests[0];

    req.postData.mimeType.should.eql('application/json');

    done();
  });

  it('should convert application/x-json to application/json', function(done) {
    var req = new HTTPSnippet(fixtures.mimetypes['application/x-json']).requests[0];

    req.postData.mimeType.should.eql('application/json');

    done();
  });

  it('should gracefully fallback if not able to parse JSON', function(done) {
    var req = new HTTPSnippet(fixtures.mimetypes['invalid-json']).requests[0];

    req.postData.mimeType.should.eql('text/plain');

    done();
  });

  it('should set postData.text = empty string when postData.params === undefined in application/x-www-form-urlencoded', function(done) {
    var req = new HTTPSnippet(fixtures.mimetypes['application/x-www-form-urlencoded']).requests[0];

    req.postData.text.should.eql('');

    done();
  });

  it('should add "uriObj" to source object', function(done) {
    var req = new HTTPSnippet(fixtures.requests.query).requests[0];

    req.uriObj.should.be.an.Object;
    req.uriObj.should.eql({
      auth: null,
      hash: null,
      host: 'mockbin.com',
      hostname: 'mockbin.com',
      href: 'http://mockbin.com/har?key=value',
      path: '/har?foo=bar&foo=baz&baz=abc&key=value',
      pathname: '/har',
      port: null,
      protocol: 'http:',
      query: {
        baz: 'abc',
        key: 'value',
        foo: ['bar', 'baz']
      },
      search: 'foo=bar&foo=baz&baz=abc&key=value',
      slashes: true
    });

    done();
  });

  it('should add "queryObj" to source object', function(done) {
    var req = new HTTPSnippet(fixtures.requests.query).requests[0];

    req.queryObj.should.be.an.Object;
    req.queryObj.should.eql({
      baz: 'abc',
      key: 'value',
      foo: ['bar', 'baz']
    });

    done();
  });

  it('should add "headersObj" to source object', function(done) {
    var req = new HTTPSnippet(fixtures.requests.headers).requests[0];

    req.headersObj.should.be.an.Object;
    req.headersObj.should.eql({
      accept: 'application/json',
      'x-foo': 'Bar'
    });

    done();
  });

  it('should modify orignal url to strip query string', function(done) {
    var req = new HTTPSnippet(fixtures.requests.query).requests[0];

    req.url.should.be.a.String;
    req.url.should.eql('http://mockbin.com/har');

    done();
  });

  it('should add "fullUrl" to source object', function(done) {
    var req = new HTTPSnippet(fixtures.requests.query).requests[0];

    req.fullUrl.should.be.a.String;
    req.fullUrl.should.eql('http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value');

    done();
  });

  it('should fix "path" property of "uriObj" to match queryString', function(done) {
    var req = new HTTPSnippet(fixtures.requests.query).requests[0];

    req.uriObj.path.should.be.a.String;
    req.uriObj.path.should.eql('/har?foo=bar&foo=baz&baz=abc&key=value');

    done();
  });
});
