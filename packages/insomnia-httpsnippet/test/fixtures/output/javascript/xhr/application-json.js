var data = JSON.stringify({
  number: 1,
  string: 'f"oo',
  arr: [1, 2, 3],
  nested: {
    a: 'b',
  },
  arr_mix: [
    1,
    'a',
    {
      arr_mix_nested: {},
    },
  ],
  boolean: false,
});

var xhr = new XMLHttpRequest();
xhr.withCredentials = true;

xhr.addEventListener('readystatechange', function() {
  if (this.readyState === this.DONE) {
    console.log(this.responseText);
  }
});

xhr.open('POST', 'http://mockbin.com/har');
xhr.setRequestHeader('content-type', 'application/json');

xhr.send(data);
