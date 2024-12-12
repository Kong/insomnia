import express, { NextFunction, Response } from 'express';

export const mtlsRouter = express.Router();

mtlsRouter.use(clientCertificateAuth);

async function clientCertificateAuth(req: any, res: Response, next: NextFunction) {
  if (!req.client.authorized) {
    return res.status(401).send({ error: 'Client certificate required' });
  }

  next();
}

mtlsRouter.get('/pets/:id', (req, res) => {
  res.status(200).send({ id: req.params.id });
});
