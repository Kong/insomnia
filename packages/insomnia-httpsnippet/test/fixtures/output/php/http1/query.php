<?php

$request = new HttpRequest();
$request->setUrl('http://mockbin.com/har');
$request->setMethod(HTTP_METH_GET);

$request->setQueryData(array(
  'foo' => array(
    'bar',
    'baz'
  ),
  'baz' => 'abc',
  'key' => 'value'
));

try {
  $response = $request->send();

  echo $response->getBody();
} catch (HttpException $ex) {
  echo $ex;
}
