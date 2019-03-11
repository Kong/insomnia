let form = new FormData();
form.append('foo', 'Hello World');

const fetchOptions = {
  mode: 'cors',
  method: 'POST',
  body: form,
};

fetch('http://mockbin.com/har', fetchOptions)
  .then(response => response.json())
  .then(data => console.log(data));
