var data = 'foo=bar';

var xhr = new XMLHttpRequest();
xhr.withCredentials = true;

xhr.addEventListener('readystatechange', function() {
  if (this.readyState === this.DONE) {
    console.log(this.responseText);
  }
});

xhr.open('POST', 'http://mockbin.com/har?foo=bar&foo=baz&baz=abc&key=value');
xhr.setRequestHeader('cookie', 'foo=bar; bar=baz');
xhr.setRequestHeader('accept', 'application/json');
xhr.setRequestHeader('content-type', 'application/x-www-form-urlencoded');

xhr.send(data);
