curl 'https://test.dk' \
    -H 'Origin: https://test.dk' \
    -H 'Accept-Encoding: gzip, deflate, br' \
    -H 'Accept-Language: en-US,en;q=0.9,da-DK;q=0.8,da;q=0.7,mt;q=0.6' \
    -H $'Cookie: CookieTestConsent={stamp:\'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx==\'%2Cnecessary...' \
    -H 'Connection: keep-alive' \
    -H 'Pragma: no-cache' \
    --data-binary '{"key":"TEST","websiteId":2,"storeId":4,"remove":true,"coupon":{"code":"erwrwer"}}' \
    --compressed
