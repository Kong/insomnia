import express from 'express';
import basicAuth from 'express-basic-auth';
import { basicAuthCreds } from '../fixtures/constants.js';

const app = express();
const basicAuthRouter = express.Router();
const port = 4010;

const delay = (cb, timeout = 500) => setTimeout(cb, timeout);

app.get('/pets/:id', (req, res) => {
  delay(() => res.status(200).send({ id: req.params.id }));
});

app.get('/csv', (_, res) => {
  delay(() =>
    res
      .status(200)
      .header('content-type', 'text/csv')
      .send(`a,b,c\n1,2,3`),
  );
});

const { utf8, iso88591 } = basicAuthCreds;

const users = {
  [utf8.user]: utf8.pass,
  [iso88591.user]: iso88591.pass,
};

basicAuthRouter.use(
  basicAuth({
    users,
  }),
);

basicAuthRouter.get('/', (_, res) => {
  delay(() => {
    res
      .status(200)
      .header('content-type', 'text/plain')
      .send('basic auth received');
  });
});

app.use('/auth/basic', basicAuthRouter);

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
