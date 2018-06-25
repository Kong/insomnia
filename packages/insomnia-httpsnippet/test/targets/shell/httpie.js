/* global it */

'use strict';

require('should');

module.exports = function(HTTPSnippet, fixtures) {
  it('should ask for verbose output', function() {
    var result = new HTTPSnippet(fixtures.requests.short).convert(
      'shell',
      'httpie',
      {
        indent: false,
        verbose: true
      }
    );

    result.should.be.a.String;
    result.should.eql('http --verbose GET http://mockbin.com/har');
  });

  it('should use short flags', function() {
    var result = new HTTPSnippet(fixtures.requests.short).convert(
      'shell',
      'httpie',
      {
        body: true,
        cert: 'foo',
        headers: true,
        indent: false,
        pretty: 'x',
        print: 'x',
        short: true,
        style: 'x',
        timeout: 1,
        verbose: true,
        verify: 'x'
      }
    );

    result.should.be.a.String;
    result.should.eql(
      'http -h -b -v -p=x --verify=x --cert=foo --pretty=x --style=x --timeout=1 GET http://mockbin.com/har'
    );
  });

  it('should use long flags', function() {
    var result = new HTTPSnippet(fixtures.requests.short).convert(
      'shell',
      'httpie',
      {
        body: true,
        cert: 'foo',
        headers: true,
        indent: false,
        pretty: 'x',
        print: 'x',
        style: 'x',
        timeout: 1,
        verbose: true,
        verify: 'x'
      }
    );

    result.should.be.a.String;
    result.should.eql(
      'http --headers --body --verbose --print=x --verify=x --cert=foo --pretty=x --style=x --timeout=1 GET http://mockbin.com/har'
    );
  });

  it('should use custom indentation', function() {
    var result = new HTTPSnippet(fixtures.requests.full).convert(
      'shell',
      'httpie',
      {
        indent: '@'
      }
    );

    result.should.be.a.String;
    result
      .replace(/\\\n/g, '')
      .should.eql(
        "http --form POST 'http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value' @accept:application/json @content-type:application/x-www-form-urlencoded @cookie:'foo=bar; bar=baz' @foo=bar"
      );
  });

  it('should use queryString parameters', function() {
    var result = new HTTPSnippet(fixtures.requests.query).convert(
      'shell',
      'httpie',
      {
        indent: false,
        queryParams: true
      }
    );

    result.should.be.a.String;
    result
      .replace(/\\\n/g, '')
      .should.eql(
        'http GET http://mockbin.com/har foo==bar foo==baz baz==abc key==value'
      );
  });

  it('should build parameterized output of query string', function() {
    var result = new HTTPSnippet(fixtures.requests.query).convert(
      'shell',
      'httpie',
      {
        indent: false,
        queryParams: true
      }
    );

    result.should.be.a.String;
    result
      .replace(/\\\n/g, '')
      .should.eql(
        'http GET http://mockbin.com/har foo==bar foo==baz baz==abc key==value'
      );
  });

  it('should build parameterized output of post data', function() {
    var result = new HTTPSnippet(
      fixtures.requests['application-form-encoded']
    ).convert('shell', 'httpie', {
      short: true,
      indent: false,
      queryParams: true
    });

    result.should.be.a.String;
    result
      .replace(/\\\n/g, '')
      .should.eql(
        'http -f POST http://mockbin.com/har content-type:application/x-www-form-urlencoded foo=bar hello=world'
      );
  });
};
