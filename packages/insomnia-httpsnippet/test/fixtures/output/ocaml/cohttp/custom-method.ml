open Cohttp_lwt_unix
open Cohttp
open Lwt

let uri = Uri.of_string "http://mockbin.com/har" in

Client.call (Code.method_of_string "PROPFIND") uri
>>= fun (res, body_stream) ->
  (* Do stuff with the result *)
