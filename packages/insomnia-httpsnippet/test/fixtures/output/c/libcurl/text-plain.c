CURL *hnd = curl_easy_init();

curl_easy_setopt(hnd, CURLOPT_CUSTOMREQUEST, "POST");
curl_easy_setopt(hnd, CURLOPT_URL, "http://mockbin.com/har");

struct curl_slist *headers = NULL;
headers = curl_slist_append(headers, "content-type: text/plain");
curl_easy_setopt(hnd, CURLOPT_HTTPHEADER, headers);

curl_easy_setopt(hnd, CURLOPT_POSTFIELDS, "Hello World");

CURLcode ret = curl_easy_perform(hnd);
