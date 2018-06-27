/* global it */

'use strict';

require('should');

module.exports = function(HTTPSnippet, fixtures) {
  it('should use short options', function() {
    var result = new HTTPSnippet(fixtures.requests.full).convert(
      'shell',
      'wget',
      {
        short: true,
        indent: false
      }
    );

    result.should.be.a.String;
    result.should.eql(
      "wget -q --method POST --header 'cookie: foo=bar; bar=baz' --header 'accept: application/json' --header 'content-type: application/x-www-form-urlencoded' --body-data foo=bar -O - 'http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value'"
    );
  });

  it('should ask for -v output', function() {
    var result = new HTTPSnippet(fixtures.requests.short).convert(
      'shell',
      'wget',
      {
        short: true,
        indent: false,
        verbose: true
      }
    );

    result.should.be.a.String;
    result.should.eql('wget -v --method GET -O - http://mockbin.com/har');
  });

  it('should ask for --verbose output', function() {
    var result = new HTTPSnippet(fixtures.requests.short).convert(
      'shell',
      'wget',
      {
        short: false,
        indent: false,
        verbose: true
      }
    );

    result.should.be.a.String;
    result.should.eql(
      'wget --verbose --method GET --output-document - http://mockbin.com/har'
    );
  });

  it('should use custom indentation', function() {
    var result = new HTTPSnippet(fixtures.requests.full).convert(
      'shell',
      'wget',
      {
        indent: '@'
      }
    );

    result.should.be.a.String;
    result
      .replace(/\\\n/g, '')
      .should.eql(
        "wget --quiet @--method POST @--header 'cookie: foo=bar; bar=baz' @--header 'accept: application/json' @--header 'content-type: application/x-www-form-urlencoded' @--body-data foo=bar @--output-document @- 'http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value'"
      );
  });
};
