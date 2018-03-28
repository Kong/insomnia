open Cohttp_lwt_unix
open Cohttp
open Lwt

let uri = Uri.of_string "http://mockbin.com/har" in
let headers = Header.add (Header.init ()) "content-type" "multipart/form-data; boundary=---011000010111000001101001" in
let body = Cohttp_lwt_body.of_string "-----011000010111000001101001\r\nContent-Disposition: form-data; name=\"foo\"; filename=\"hello.txt\"\r\nContent-Type: text/plain\r\n\r\n\r\n-----011000010111000001101001--\r\n" in

Client.call ~headers ~body `POST uri
>>= fun (res, body_stream) ->
  (* Do stuff with the result *)
