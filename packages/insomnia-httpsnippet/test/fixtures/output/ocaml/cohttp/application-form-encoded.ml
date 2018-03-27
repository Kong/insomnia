open Cohttp_lwt_unix
open Cohttp
open Lwt

let uri = Uri.of_string "http://mockbin.com/har" in
let headers = Header.add (Header.init ()) "content-type" "application/x-www-form-urlencoded" in
let body = Cohttp_lwt_body.of_string "foo=bar&hello=world" in

Client.call ~headers ~body `POST uri
>>= fun (res, body_stream) ->
  (* Do stuff with the result *)
