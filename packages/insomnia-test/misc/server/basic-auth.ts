import express from 'express';
import basicAuth from 'express-basic-auth';


const getCreds = (user: string, pass: string, encoding: BufferEncoding) => ({
  raw: { user, pass },
  encoded: {
    user: Buffer.from(user, encoding).toString(),
    pass: Buffer.from(pass, encoding).toString(),
  },
  combined: Buffer.from(`${user}:${pass}`, encoding).toString('base64'),
});

export const basicAuthCreds = {
  utf8: getCreds('user', 'pass', 'utf8'),
  latin1: getCreds('user-é', 'pass-é', 'latin1'),
};

const { utf8, latin1 } = basicAuthCreds;

const users = {
  [utf8.encoded.user]: utf8.encoded.pass,
  [latin1.encoded.user]: latin1.encoded.pass,
};

export const basicAuthRouter = express.Router();

basicAuthRouter.use(basicAuth({ users }) as any);

basicAuthRouter.get('/', (_, res) => {
  res.status(200).header('content-type', 'text/plain').send('basic auth received');
});
