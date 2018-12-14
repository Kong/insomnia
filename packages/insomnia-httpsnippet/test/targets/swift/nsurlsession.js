/* global it */

'use strict';

require('should');

module.exports = function(HTTPSnippet, fixtures) {
  it('should support an indent option', function() {
    var result = new HTTPSnippet(fixtures.requests.short).convert('swift', {
      indent: '    ',
    });

    result.should.be.a.String;
    result
      .replace(/\n/g, '')
      .should.eql(
        'import Foundationlet request = NSMutableURLRequest(url: NSURL(string: "http://mockbin.com/har")! as URL,                                        cachePolicy: .useProtocolCachePolicy,                                    timeoutInterval: 10.0)request.httpMethod = "GET"let session = URLSession.sharedlet dataTask = session.dataTask(with: request as URLRequest, completionHandler: { (data, response, error) -> Void in    if (error != nil) {        print(error)    } else {        let httpResponse = response as? HTTPURLResponse        print(httpResponse)    }})dataTask.resume()',
      );
  });
  it('should support a timeout option', function() {
    var result = new HTTPSnippet(fixtures.requests.short).convert('swift', {
      timeout: 5,
    });

    result.should.be.a.String;
    result
      .replace(/\n/g, '')
      .should.eql(
        'import Foundationlet request = NSMutableURLRequest(url: NSURL(string: "http://mockbin.com/har")! as URL,                                        cachePolicy: .useProtocolCachePolicy,                                    timeoutInterval: 5.0)request.httpMethod = "GET"let session = URLSession.sharedlet dataTask = session.dataTask(with: request as URLRequest, completionHandler: { (data, response, error) -> Void in  if (error != nil) {    print(error)  } else {    let httpResponse = response as? HTTPURLResponse    print(httpResponse)  }})dataTask.resume()',
      );
  });
  it('should support pretty option', function() {
    var result = new HTTPSnippet(fixtures.requests.full).convert('swift', {
      pretty: false,
    });

    result.should.be.a.String;
    result
      .replace(/\n/g, '')
      .should.eql(
        'import Foundationlet headers = ["cookie": "foo=bar; bar=baz", "accept": "application/json", "content-type": "application/x-www-form-urlencoded"]let postData = NSMutableData(data: "foo=bar".data(using: String.Encoding.utf8)!)let request = NSMutableURLRequest(url: NSURL(string: "http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value")! as URL,                                        cachePolicy: .useProtocolCachePolicy,                                    timeoutInterval: 10.0)request.httpMethod = "POST"request.allHTTPHeaderFields = headersrequest.httpBody = postData as Datalet session = URLSession.sharedlet dataTask = session.dataTask(with: request as URLRequest, completionHandler: { (data, response, error) -> Void in  if (error != nil) {    print(error)  } else {    let httpResponse = response as? HTTPURLResponse    print(httpResponse)  }})dataTask.resume()',
      );
  });
};
