let form = new FormData();
form.append('foo', 'test/fixtures/files/hello.txt');

const fetchOptions = {
  mode: 'cors',
  method: 'POST',
  body: form,
};

fetch('http://mockbin.com/har', fetchOptions)
  .then(response => response.json())
  .then(data => console.log(data));
