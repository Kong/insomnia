/* eslint-disable no-undef */
console.log('[api-process] API worker started');
import fs from 'node:fs';

import express from 'express';

const app = express();
app.use(express.text()); // if you want raw text body
// app.use(express.json());     // use this instead if sending JSON

app.post('/upload', (req, res) => {
  const content = req.body; // the raw POST body
  process.parentPort.postMessage({ body: content });
  res.send('Received: ' + content);
});

app.listen(8080, () => console.log('Server running on http://localhost:8080'));
