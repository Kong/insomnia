import express from 'express';
import basicAuth from 'express-basic-auth';
import { basicAuthCreds } from '../fixtures/constants.js';

const app = express();
const basicAuthRouter = express.Router();
const port = 4010;

// Artificially slow each request down
app.use((req, res, next) => {
  setTimeout(next, 500);
});

app.get('/pets/:id', (req, res) => {
  res.status(200).send({ id: req.params.id });
});

app.use('/file', express.static('fixtures'));

const { utf8, latin1 } = basicAuthCreds;

const users = {
  [utf8.encoded.user]: utf8.encoded.pass,
  [latin1.encoded.user]: latin1.encoded.pass,
};

basicAuthRouter.use(basicAuth({ users }));

basicAuthRouter.get('/', (_, res) => {
  res
    .status(200)
    .header('content-type', 'text/plain')
    .send('basic auth received');
});

app.use('/auth/basic', basicAuthRouter);

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
