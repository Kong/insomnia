<?php

$request = new HttpRequest();
$request->setUrl('http://mockbin.com/har');
$request->setMethod(HTTP_METH_POST);

$request->setHeaders(array(
  'content-type' => 'application/x-www-form-urlencoded'
));

$request->setContentType('application/x-www-form-urlencoded');
$request->setPostFields(array(
  'foo' => 'bar',
  'hello' => 'world'
));

try {
  $response = $request->send();

  echo $response->getBody();
} catch (HttpException $ex) {
  echo $ex;
}
