CURL *hnd = curl_easy_init();

curl_easy_setopt(hnd, CURLOPT_CUSTOMREQUEST, "GET");
curl_easy_setopt(hnd, CURLOPT_URL, "http://mockbin.com/har");

struct curl_slist *headers = NULL;
headers = curl_slist_append(headers, "x-foo: Bar");
headers = curl_slist_append(headers, "accept: application/json");
curl_easy_setopt(hnd, CURLOPT_HTTPHEADER, headers);

CURLcode ret = curl_easy_perform(hnd);
