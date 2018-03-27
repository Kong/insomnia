<?php

$request = new HttpRequest();
$request->setUrl('http://mockbin.com/har');
$request->setMethod(HTTP_METH_POST);

$request->setHeaders(array(
  'content-type' => 'multipart/form-data; boundary=---011000010111000001101001'
));

$request->setBody('-----011000010111000001101001
Content-Disposition: form-data; name="foo"; filename="hello.txt"
Content-Type: text/plain


-----011000010111000001101001--
');

try {
  $response = $request->send();

  echo $response->getBody();
} catch (HttpException $ex) {
  echo $ex;
}
