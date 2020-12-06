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

const { utf8, latin1 } = basicAuthCreds;

const users = {
  [utf8.encoded.user]: utf8.encoded.pass,
  [latin1.encoded.user]: latin1.encoded.pass,
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
