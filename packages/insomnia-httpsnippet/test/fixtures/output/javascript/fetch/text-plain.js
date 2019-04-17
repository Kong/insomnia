const fetchOptions = {
  mode: 'cors',
  method: 'POST',
  headers: {
    'content-type': 'text/plain',
  },
  data: 'Hello World',
};

fetch('http://mockbin.com/har', fetchOptions)
  .then(response => response.json())
  .then(data => console.log(data));
