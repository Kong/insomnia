CURL *hnd = curl_easy_init();

curl_easy_setopt(hnd, CURLOPT_CUSTOMREQUEST, "POST");
curl_easy_setopt(hnd, CURLOPT_URL, "http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value");

struct curl_slist *headers = NULL;
headers = curl_slist_append(headers, "content-type: application/x-www-form-urlencoded");
headers = curl_slist_append(headers, "accept: application/json");
curl_easy_setopt(hnd, CURLOPT_HTTPHEADER, headers);

curl_easy_setopt(hnd, CURLOPT_COOKIE, "foo=bar; bar=baz");

curl_easy_setopt(hnd, CURLOPT_POSTFIELDS, "foo=bar");

CURLcode ret = curl_easy_perform(hnd);
