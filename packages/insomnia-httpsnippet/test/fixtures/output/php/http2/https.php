<?php

$client = new http\Client;
$request = new http\Client\Request;

$request->setRequestUrl('https://mockbin.com/har');
$request->setRequestMethod('GET');
$client->enqueue($request)->send();
$response = $client->getResponse();

echo $response->getBody();
