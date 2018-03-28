CURL *hnd = curl_easy_init();

curl_easy_setopt(hnd, CURLOPT_CUSTOMREQUEST, "POST");
curl_easy_setopt(hnd, CURLOPT_URL, "http://mockbin.com/har");

struct curl_slist *headers = NULL;
headers = curl_slist_append(headers, "content-type: application/x-www-form-urlencoded");
curl_easy_setopt(hnd, CURLOPT_HTTPHEADER, headers);

curl_easy_setopt(hnd, CURLOPT_POSTFIELDS, "foo=bar&hello=world");

CURLcode ret = curl_easy_perform(hnd);
