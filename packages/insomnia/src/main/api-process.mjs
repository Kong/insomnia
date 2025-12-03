/* eslint-disable no-undef */
console.log('[api-process] API worker started');
import fs from 'node:fs';

import express from 'express';

const app = express();
app.use(express.json()); // use this instead if sending JSON
app.use(express.text({ type: 'text/plain' }));

app.post('/upload', (req, res) => {
  const content = req.body;
  if (!content) {
    res.status(400).send('No content received');
    return;
  }
  process.parentPort.postMessage({ curlRequests: [content] });
  res.send('Received: ' + content);
});

app.post('/upload-array', (req, res) => {
  const content = req.body;
  res.send('Received: ' + JSON.stringify(content));
  process.parentPort.postMessage({ curlRequests: content.list });
});
app.listen(8080, () => console.log('Server running on http://localhost:8080'));
