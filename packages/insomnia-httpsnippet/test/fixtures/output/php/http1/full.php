<?php

$request = new HttpRequest();
$request->setUrl('http://mockbin.com/har');
$request->setMethod(HTTP_METH_POST);

$request->setQueryData(array(
  'foo' => array(
    'bar',
    'baz'
  ),
  'baz' => 'abc',
  'key' => 'value'
));

$request->setHeaders(array(
  'content-type' => 'application/x-www-form-urlencoded',
  'accept' => 'application/json'
));

$request->setCookies(array(
  'bar' => 'baz',
  'foo' => 'bar'
));

$request->setContentType('application/x-www-form-urlencoded');
$request->setPostFields(array(
  'foo' => 'bar'
));

try {
  $response = $request->send();

  echo $response->getBody();
} catch (HttpException $ex) {
  echo $ex;
}
