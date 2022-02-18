import express from 'express';
import basicAuth from 'express-basic-auth';

import { basicAuthCreds } from '../fixtures/constants';

const { utf8, latin1 } = basicAuthCreds;

const users = {
  [utf8.encoded.user]: utf8.encoded.pass,
  [latin1.encoded.user]: latin1.encoded.pass,
};

export const basicAuthRouter = express.Router();

basicAuthRouter.use(basicAuth({ users }));

basicAuthRouter.get('/', (_, res) => {
  res
    .status(200)
    .header('content-type', 'text/plain')
    .send('basic auth received');
});
