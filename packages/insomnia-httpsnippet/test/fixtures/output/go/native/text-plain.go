package main

import (
	"fmt"
	"strings"
	"net/http"
	"io/ioutil"
)

func main() {

	url := "http://mockbin.com/har"

	payload := strings.NewReader("Hello World")

	req, _ := http.NewRequest("POST", url, payload)

	req.Header.Add("content-type", "text/plain")

	res, _ := http.DefaultClient.Do(req)

	defer res.Body.Close()
	body, _ := ioutil.ReadAll(res.Body)

	fmt.Println(res)
	fmt.Println(string(body))

}
