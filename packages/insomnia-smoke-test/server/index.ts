import express from 'express';
import fs from 'fs';
import multer from 'multer';

import { basicAuthRouter } from './basic-auth';
import { oauthRoutes } from './oauth';

const app = express();
const port = 4010;

app.get('/pets/:id', (req, res) => {
  res.status(200).send({ id: req.params.id });
});

app.get('/sleep', (_req, res) => {
  res.status(200).send({ sleep: true });
});

app.get('/cookies', (_req, res) => {
  res
    .status(200)
    .header('content-type', 'text/plain')
    .cookie('insomnia-test-cookie', 'value123')
    .send(`${_req.headers['cookie']}`);
});

app.use('/file', express.static('fixtures/files'));

app.use('/auth/basic', basicAuthRouter);

app.get('/delay/seconds/:duration', (req, res) => {
  const delaySec = Number.parseInt(req.params.duration || '2');
  setTimeout(function() {
    res.send(`Delayed by ${delaySec} seconds`);
  }, delaySec * 1000);
});

app.use('/oidc', oauthRoutes(port));

app.get('/multipart-form', (_, res) => {
  res.send(`<form action="http://localhost:4010/upload-multipart" method="post" enctype="multipart/form-data">
<p><input type="text" name="text" value="some text">
<p><input type="file" name="fileToUpload">
<p><button type="submit">Submit</button>
</form>`);
});

const upload = multer({ dest: './public/data/uploads/' });
app.post('/upload-multipart', upload.single('fileToUpload'), (req, res) => {
  // req.file is the name of your file in the form above, here 'uploaded_file'
  // req.body will hold the text fields, if there were any
  console.log(req.file, req.body);

  if (req.file?.fieldname !== 'fileToUpload') return res.status(500).send('must include file');
  const isMimetypeReadable = !!['yaml', 'json', 'xml'].filter(x => req.file?.mimetype.includes(x)).length;
  const fileContents = !isMimetypeReadable ? '' : fs.readFileSync(req.file?.path).toString();
  return res.status(200).send(JSON.stringify(req.file, null, '\t') + `
  ${fileContents}`);
});

app.listen(port, () => console.log(`Listening at http://localhost:${port}`));
