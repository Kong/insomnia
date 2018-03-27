#import <Foundation/Foundation.h>

NSDictionary *headers = @{ @"content-type": @"multipart/form-data; boundary=---011000010111000001101001" };
NSArray *parameters = @[ @{ @"name": @"foo", @"value": @"Hello World", @"fileName": @"hello.txt", @"contentType": @"text/plain" } ];
NSString *boundary = @"---011000010111000001101001";

NSError *error;
NSMutableString *body = [NSMutableString string];
for (NSDictionary *param in parameters) {
    [body appendFormat:@"--%@\r\n", boundary];
    if (param[@"fileName"]) {
        [body appendFormat:@"Content-Disposition:form-data; name=\"%@\"; filename=\"%@\"\r\n", param[@"name"], param[@"fileName"]];
        [body appendFormat:@"Content-Type: %@\r\n\r\n", param[@"contentType"]];
        [body appendFormat:@"%@", [NSString stringWithContentsOfFile:param[@"fileName"] encoding:NSUTF8StringEncoding error:&error]];
        if (error) {
            NSLog(@"%@", error);
        }
    } else {
        [body appendFormat:@"Content-Disposition:form-data; name=\"%@\"\r\n\r\n", param[@"name"]];
        [body appendFormat:@"%@", param[@"value"]];
    }
}
[body appendFormat:@"\r\n--%@--\r\n", boundary];
NSData *postData = [body dataUsingEncoding:NSUTF8StringEncoding];

NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:@"http://mockbin.com/har"]
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
