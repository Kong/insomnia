/**
 * @description
 * HTTP code snippet generator for Objective-C using NSURLSession.
 *
 * @author
 * @thibaultCha
 *
 * for any questions or issues regarding the generated code snippet, please open an issue mentioning the author.
 */

'use strict'

var util = require('util')
var helpers = require('./helpers')
var CodeBuilder = require('../../helpers/code-builder')

module.exports = function (source, options) {
  var opts = util._extend({
    indent: '    ',
    pretty: true,
    timeout: '10'
  }, options)

  var code = new CodeBuilder(opts.indent)
  // Markers for headers to be created as litteral objects and later be set on the NSURLRequest if exist
  var req = {
    hasHeaders: false,
    hasBody: false
  }

  // We just want to make sure people understand that is the only dependency
  code.push('#import <Foundation/Foundation.h>')

  if (Object.keys(source.allHeaders).length) {
    req.hasHeaders = true
    code.blank()
        .push(helpers.nsDeclaration('NSDictionary', 'headers', source.allHeaders, opts.pretty))
  }

  if (source.postData.text || source.postData.jsonObj || source.postData.params) {
    req.hasBody = true

    switch (source.postData.mimeType) {
      case 'application/x-www-form-urlencoded':
        // By appending parameters one by one in the resulting snippet,
        // we make it easier for the user to edit it according to his or her needs after pasting.
        // The user can just add/remove lines adding/removing body parameters.
        code.blank()
            .push('NSMutableData *postData = [[NSMutableData alloc] initWithData:[@"%s=%s" dataUsingEncoding:NSUTF8StringEncoding]];',
          source.postData.params[0].name, source.postData.params[0].value)
        for (var i = 1, len = source.postData.params.length; i < len; i++) {
          code.push('[postData appendData:[@"&%s=%s" dataUsingEncoding:NSUTF8StringEncoding]];',
            source.postData.params[i].name, source.postData.params[i].value)
        }
        break

      case 'application/json':
        if (source.postData.jsonObj) {
          code.push(helpers.nsDeclaration('NSDictionary', 'parameters', source.postData.jsonObj, opts.pretty))
              .blank()
              .push('NSData *postData = [NSJSONSerialization dataWithJSONObject:parameters options:0 error:nil];')
        }
        break

      case 'multipart/form-data':
        // By appending multipart parameters one by one in the resulting snippet,
        // we make it easier for the user to edit it according to his or her needs after pasting.
        // The user can just edit the parameters NSDictionary or put this part of a snippet in a multipart builder method.
        code.push(helpers.nsDeclaration('NSArray', 'parameters', source.postData.params, opts.pretty))
            .push('NSString *boundary = @"%s";', source.postData.boundary)
            .blank()
            .push('NSError *error;')
            .push('NSMutableString *body = [NSMutableString string];')
            .push('for (NSDictionary *param in parameters) {')
            .push(1, '[body appendFormat:@"--%@\\r\\n", boundary];')
            .push(1, 'if (param[@"fileName"]) {')
            .push(2, '[body appendFormat:@"Content-Disposition:form-data; name=\\"%@\\"; filename=\\"%@\\"\\r\\n", param[@"name"], param[@"fileName"]];')
            .push(2, '[body appendFormat:@"Content-Type: %@\\r\\n\\r\\n", param[@"contentType"]];')
            .push(2, '[body appendFormat:@"%@", [NSString stringWithContentsOfFile:param[@"fileName"] encoding:NSUTF8StringEncoding error:&error]];')
            .push(2, 'if (error) {')
            .push(3, 'NSLog(@"%@", error);')
            .push(2, '}')
            .push(1, '} else {')
            .push(2, '[body appendFormat:@"Content-Disposition:form-data; name=\\"%@\\"\\r\\n\\r\\n", param[@"name"]];')
            .push(2, '[body appendFormat:@"%@", param[@"value"]];')
            .push(1, '}')
            .push('}')
            .push('[body appendFormat:@"\\r\\n--%@--\\r\\n", boundary];')
            .push('NSData *postData = [body dataUsingEncoding:NSUTF8StringEncoding];')
        break

      default:
        code.blank()
            .push('NSData *postData = [[NSData alloc] initWithData:[@"' + source.postData.text + '" dataUsingEncoding:NSUTF8StringEncoding]];')
    }
  }

  code.blank()
      .push('NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:@"' + source.fullUrl + '"]')
      // NSURLRequestUseProtocolCachePolicy is the default policy, let's just always set it to avoid confusion.
      .push('                                                       cachePolicy:NSURLRequestUseProtocolCachePolicy')
      .push('                                                   timeoutInterval:' + parseInt(opts.timeout, 10).toFixed(1) + '];')
      .push('[request setHTTPMethod:@"' + source.method + '"];')

  if (req.hasHeaders) {
    code.push('[request setAllHTTPHeaderFields:headers];')
  }

  if (req.hasBody) {
    code.push('[request setHTTPBody:postData];')
  }

  code.blank()
      // Retrieving the shared session will be less verbose than creating a new one.
      .push('NSURLSession *session = [NSURLSession sharedSession];')
      .push('NSURLSessionDataTask *dataTask = [session dataTaskWithRequest:request')
      .push('                                            completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {')
      .push(1, '                                            if (error) {')
      .push(2, '                                            NSLog(@"%@", error);')
      .push(1, '                                            } else {')
      // Casting the NSURLResponse to NSHTTPURLResponse so the user can see the status     .
      .push(2, '                                            NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *) response;')
      .push(2, '                                            NSLog(@"%@", httpResponse);')
      .push(1, '                                            }')
      .push('                                            }];')
      .push('[dataTask resume];')

  return code.join()
}

module.exports.info = {
  key: 'nsurlsession',
  title: 'NSURLSession',
  link: 'https://developer.apple.com/library/mac/documentation/Foundation/Reference/NSURLSession_class/index.html',
  description: 'Foundation\'s NSURLSession request'
}
