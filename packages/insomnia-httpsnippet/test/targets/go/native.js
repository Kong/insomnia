/* global it */

'use strict';

require('should');

module.exports = function(HTTPSnippet, fixtures) {
  it('should support false boilerplate option', function() {
    var result = new HTTPSnippet(fixtures.requests.full).convert('go', 'native', {
      showBoilerplate: false,
    });

    result.should.be.a.String;
    result.should.eql(
      'url := "http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value"\n\npayload := strings.NewReader("foo=bar")\n\nreq, _ := http.NewRequest("POST", url, payload)\n\nreq.Header.Add("cookie", "foo=bar; bar=baz")\nreq.Header.Add("accept", "application/json")\nreq.Header.Add("content-type", "application/x-www-form-urlencoded")\n\nres, _ := http.DefaultClient.Do(req)\n\ndefer res.Body.Close()\nbody, _ := ioutil.ReadAll(res.Body)\n\nfmt.Println(res)\nfmt.Println(string(body))',
    );
  });
  it('should support checkErrors option', function() {
    var result = new HTTPSnippet(fixtures.requests.full).convert('go', 'native', {
      checkErrors: true,
    });

    result.should.be.a.String;
    result.should.eql(
      'package main\n\nimport (\n\t"fmt"\n\t"strings"\n\t"net/http"\n\t"io/ioutil"\n)\n\nfunc main() {\n\n\turl := "http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value"\n\n\tpayload := strings.NewReader("foo=bar")\n\n\treq, err := http.NewRequest("POST", url, payload)\n\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\treq.Header.Add("cookie", "foo=bar; bar=baz")\n\treq.Header.Add("accept", "application/json")\n\treq.Header.Add("content-type", "application/x-www-form-urlencoded")\n\n\tres, err := http.DefaultClient.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\n\tdefer res.Body.Close()\n\tbody, err := ioutil.ReadAll(res.Body)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\n\tfmt.Println(res)\n\tfmt.Println(string(body))\n\n}',
    );
  });
  it('should support printBody option', function() {
    var result = new HTTPSnippet(fixtures.requests.full).convert('go', 'native', {
      printBody: false,
    });

    result.should.be.a.String;
    result.should.eql(
      'package main\n\nimport (\n\t"fmt"\n\t"strings"\n\t"net/http"\n)\n\nfunc main() {\n\n\turl := "http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value"\n\n\tpayload := strings.NewReader("foo=bar")\n\n\treq, _ := http.NewRequest("POST", url, payload)\n\n\treq.Header.Add("cookie", "foo=bar; bar=baz")\n\treq.Header.Add("accept", "application/json")\n\treq.Header.Add("content-type", "application/x-www-form-urlencoded")\n\n\tres, _ := http.DefaultClient.Do(req)\n\n\tfmt.Println(res)\n\n}',
    );
  });
  it('should support timeout option', function() {
    var result = new HTTPSnippet(fixtures.requests.full).convert('go', 'native', {
      timeout: 30,
    });

    result.should.be.a.String;
    result.should.eql(
      'package main\n\nimport (\n\t"fmt"\n\t"time"\n\t"strings"\n\t"net/http"\n\t"io/ioutil"\n)\n\nfunc main() {\n\n\tclient := http.Client{\n\t\tTimeout: time.Duration(30 * time.Second),\n\t}\n\n\turl := "http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value"\n\n\tpayload := strings.NewReader("foo=bar")\n\n\treq, _ := http.NewRequest("POST", url, payload)\n\n\treq.Header.Add("cookie", "foo=bar; bar=baz")\n\treq.Header.Add("accept", "application/json")\n\treq.Header.Add("content-type", "application/x-www-form-urlencoded")\n\n\tres, _ := client.Do(req)\n\n\tdefer res.Body.Close()\n\tbody, _ := ioutil.ReadAll(res.Body)\n\n\tfmt.Println(res)\n\tfmt.Println(string(body))\n\n}',
    );
  });
};
