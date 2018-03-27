<?php

$client = new http\Client;
$request = new http\Client\Request;

$request->setRequestUrl('http://mockbin.com/har');
$request->setRequestMethod('GET');
$request->setQuery(new http\QueryString(array(
  'foo' => array(
    'bar',
    'baz'
  ),
  'baz' => 'abc',
  'key' => 'value'
)));

$client->enqueue($request)->send();
$response = $client->getResponse();

echo $response->getBody();
