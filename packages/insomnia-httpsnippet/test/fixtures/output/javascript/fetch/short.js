const fetchOptions = {
  mode: 'cors',
  method: 'GET',
  headers: {},
};

fetch('http://mockbin.com/har', fetchOptions)
  .then(response => response.json())
  .then(data => console.log(data));
