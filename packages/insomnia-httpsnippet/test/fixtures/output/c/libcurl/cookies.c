CURL *hnd = curl_easy_init();

curl_easy_setopt(hnd, CURLOPT_CUSTOMREQUEST, "POST");
curl_easy_setopt(hnd, CURLOPT_URL, "http://mockbin.com/har");

curl_easy_setopt(hnd, CURLOPT_COOKIE, "foo=bar; bar=baz");

CURLcode ret = curl_easy_perform(hnd);
