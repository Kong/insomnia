var data = new FormData();
data.append('foo', 'test/fixtures/files/hello.txt');

var xhr = new XMLHttpRequest();
xhr.withCredentials = true;

xhr.addEventListener('readystatechange', function() {
  if (this.readyState === this.DONE) {
    console.log(this.responseText);
  }
});

xhr.open('POST', 'http://mockbin.com/har');

xhr.send(data);
