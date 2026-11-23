import type { NextFunction, Response } from 'express';
import express from 'express';

export const mtlsRouter = express.Router();

mtlsRouter.use(clientCertificateAuth);

export async function clientCertificateAuth(req: any, res: Response, next: NextFunction) {
  if (!req.client.authorized) {
    return res.status(401).send({ error: 'Client certificate required' });
  }

  next();
}

mtlsRouter.post('/oauth/token', (_req, res) => {
  res.status(200).send({ access_token: 'mtls-access-token', token_type: 'Bearer', expires_in: 3600 });
});

mtlsRouter.get('/pets/:id', (req, res) => {
  res.status(200).send({ id: req.params.id });
});
