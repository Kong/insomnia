<?php

$curl = curl_init();

curl_setopt_array($curl, array(
  CURLOPT_URL => "http://mockbin.com/har",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => "",
  CURLOPT_MAXREDIRS => 10,
  CURLOPT_TIMEOUT => 30,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => "POST",
  CURLOPT_POSTFIELDS => "{\"number\":1,\"string\":\"f\\\"oo\",\"arr\":[1,2,3],\"nested\":{\"a\":\"b\"},\"arr_mix\":[1,\"a\",{\"arr_mix_nested\":{}}],\"boolean\":false}",
  CURLOPT_HTTPHEADER => array(
    "content-type: application/json"
  ),
));

$response = curl_exec($curl);
$err = curl_error($curl);

curl_close($curl);

if ($err) {
  echo "cURL Error #:" . $err;
} else {
  echo $response;
}
