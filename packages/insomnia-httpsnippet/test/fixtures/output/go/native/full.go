package main

import (
	"fmt"
	"strings"
	"net/http"
	"io/ioutil"
)

func main() {

	url := "http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value"

	payload := strings.NewReader("foo=bar")

	req, _ := http.NewRequest("POST", url, payload)

	req.Header.Add("cookie", "foo=bar; bar=baz")
	req.Header.Add("accept", "application/json")
	req.Header.Add("content-type", "application/x-www-form-urlencoded")

	res, _ := http.DefaultClient.Do(req)

	defer res.Body.Close()
	body, _ := ioutil.ReadAll(res.Body)

	fmt.Println(res)
	fmt.Println(string(body))

}
