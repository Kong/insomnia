/* global it */

'use strict';

require('should');

module.exports = function(HTTPSnippet, fixtures) {
  it('should support an indent option', function() {
    var result = new HTTPSnippet(fixtures.requests.short).convert('objc', {
      indent: '  '
    });

    result.should.be.a.String;
    result
      .replace(/\n/g, '')
      .should.eql(
        '#import <Foundation/Foundation.h>NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:@"http://mockbin.com/har"]                                                       cachePolicy:NSURLRequestUseProtocolCachePolicy                                                   timeoutInterval:10.0];[request setHTTPMethod:@"GET"];NSURLSession *session = [NSURLSession sharedSession];NSURLSessionDataTask *dataTask = [session dataTaskWithRequest:request                                            completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {                                              if (error) {                                                NSLog(@"%@", error);                                              } else {                                                NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *) response;                                                NSLog(@"%@", httpResponse);                                              }                                            }];[dataTask resume];'
      );
  });
  it('should support a timeout option', function() {
    var result = new HTTPSnippet(fixtures.requests.short).convert('objc', {
      timeout: 5
    });

    result.should.be.a.String;
    result
      .replace(/\n/g, '')
      .should.eql(
        '#import <Foundation/Foundation.h>NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:@"http://mockbin.com/har"]                                                       cachePolicy:NSURLRequestUseProtocolCachePolicy                                                   timeoutInterval:5.0];[request setHTTPMethod:@"GET"];NSURLSession *session = [NSURLSession sharedSession];NSURLSessionDataTask *dataTask = [session dataTaskWithRequest:request                                            completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {                                                if (error) {                                                    NSLog(@"%@", error);                                                } else {                                                    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *) response;                                                    NSLog(@"%@", httpResponse);                                                }                                            }];[dataTask resume];'
      );
  });
  it('should support pretty option', function() {
    var result = new HTTPSnippet(fixtures.requests.full).convert('objc', {
      pretty: false
    });

    result.should.be.a.String;
    result
      .replace(/\n/g, '')
      .should.eql(
        '#import <Foundation/Foundation.h>NSDictionary *headers = @{ @"cookie": @"foo=bar; bar=baz", @"accept": @"application/json", @"content-type": @"application/x-www-form-urlencoded" };NSMutableData *postData = [[NSMutableData alloc] initWithData:[@"foo=bar" dataUsingEncoding:NSUTF8StringEncoding]];NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:@"http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value"]                                                       cachePolicy:NSURLRequestUseProtocolCachePolicy                                                   timeoutInterval:10.0];[request setHTTPMethod:@"POST"];[request setAllHTTPHeaderFields:headers];[request setHTTPBody:postData];NSURLSession *session = [NSURLSession sharedSession];NSURLSessionDataTask *dataTask = [session dataTaskWithRequest:request                                            completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {                                                if (error) {                                                    NSLog(@"%@", error);                                                } else {                                                    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *) response;                                                    NSLog(@"%@", httpResponse);                                                }                                            }];[dataTask resume];'
      );
  });
};
