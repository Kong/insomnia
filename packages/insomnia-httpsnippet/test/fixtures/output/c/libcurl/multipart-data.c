CURL *hnd = curl_easy_init();

curl_easy_setopt(hnd, CURLOPT_CUSTOMREQUEST, "POST");
curl_easy_setopt(hnd, CURLOPT_URL, "http://mockbin.com/har");

struct curl_slist *headers = NULL;
headers = curl_slist_append(headers, "content-type: multipart/form-data; boundary=---011000010111000001101001");
curl_easy_setopt(hnd, CURLOPT_HTTPHEADER, headers);

curl_easy_setopt(hnd, CURLOPT_POSTFIELDS, "-----011000010111000001101001\r\nContent-Disposition: form-data; name=\"foo\"; filename=\"hello.txt\"\r\nContent-Type: text/plain\r\n\r\nHello World\r\n-----011000010111000001101001--\r\n");

CURLcode ret = curl_easy_perform(hnd);
