<?php

$client = new http\Client;
$request = new http\Client\Request;

$body = new http\Message\Body;
$body->addForm(NULL, array(
  array(
    'name' => 'foo',
    'type' => 'text/plain',
    'file' => 'hello.txt',
    'data' => 'Hello World'
  )
));

$request->setRequestUrl('http://mockbin.com/har');
$request->setRequestMethod('POST');
$request->setBody($body);

$client->enqueue($request)->send();
$response = $client->getResponse();

echo $response->getBody();
