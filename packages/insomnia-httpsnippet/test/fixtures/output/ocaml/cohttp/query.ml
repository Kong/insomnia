open Cohttp_lwt_unix
open Cohttp
open Lwt

let uri = Uri.of_string "http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value" in

Client.call `GET uri
>>= fun (res, body_stream) ->
  (* Do stuff with the result *)
