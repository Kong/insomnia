import Foundation

let headers = ["content-type": "application/json"]
let parameters = [
  "number": 1,
  "string": "f\"oo",
  "arr": [1, 2, 3],
  "nested": ["a": "b"],
  "arr_mix": [1, "a", ["arr_mix_nested": []]],
  "boolean": false
] as [String : Any]

let postData = JSONSerialization.data(withJSONObject: parameters, options: [])

let request = NSMutableURLRequest(url: NSURL(string: "http://mockbin.com/har")! as URL,
                                        cachePolicy: .useProtocolCachePolicy,
                                    timeoutInterval: 10.0)
request.httpMethod = "POST"
request.allHTTPHeaderFields = headers
request.httpBody = postData as Data

let session = URLSession.shared
let dataTask = session.dataTask(with: request as URLRequest, completionHandler: { (data, response, error) -> Void in
  if (error != nil) {
    print(error)
  } else {
    let httpResponse = response as? HTTPURLResponse
    print(httpResponse)
  }
})

dataTask.resume()
