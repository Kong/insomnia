var data = "Hello World";

var xhr = new XMLHttpRequest();
xhr.withCredentials = true;

xhr.addEventListener("readystatechange", function () {
  if (this.readyState === this.DONE) {
    console.log(this.responseText);
  }
});

xhr.open("POST", "http://mockbin.com/har");
xhr.setRequestHeader("content-type", "text/plain");

xhr.send(data);
