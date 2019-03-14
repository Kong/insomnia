const fetchOptions = {
  mode: 'cors',
  method: 'GET',
  headers: {},
};

fetch('https://mockbin.com/har', fetchOptions)
  .then(response => response.json())
  .then(data => console.log(data));
