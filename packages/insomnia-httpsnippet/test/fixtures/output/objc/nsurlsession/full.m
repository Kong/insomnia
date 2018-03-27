#import <Foundation/Foundation.h>

NSDictionary *headers = @{ @"cookie": @"foo=bar; bar=baz",
                           @"accept": @"application/json",
                           @"content-type": @"application/x-www-form-urlencoded" };

NSMutableData *postData = [[NSMutableData alloc] initWithData:[@"foo=bar" dataUsingEncoding:NSUTF8StringEncoding]];

NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:@"http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value"]
                                                       cachePolicy:NSURLRequestUseProtocolCachePolicy
                                                   timeoutInterval:10.0];
[request setHTTPMethod:@"POST"];
[request setAllHTTPHeaderFields:headers];
[request setHTTPBody:postData];

NSURLSession *session = [NSURLSession sharedSession];
NSURLSessionDataTask *dataTask = [session dataTaskWithRequest:request
                                            completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
                                                if (error) {
                                                    NSLog(@"%@", error);
                                                } else {
                                                    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *) response;
                                                    NSLog(@"%@", httpResponse);
                                                }
                                            }];
[dataTask resume];
