import express from 'express';

const db = new Map<string, any>();

export default (app: express.Application) => {
  app.get('/simple-crud/:id', (req, res) => {
    const { id } = req.params;
    const item = db.get(id);
    if (!item) {
      res.status(404).send();
      return;
    }
    res.status(200).send({ id, ...item });
  });

  app.post('/simple-crud', express.json(), (req, res) => {
    const id = crypto.randomUUID();
    db.set(id, req.body);
    res.status(201).send({ id, ...req.body });
  });
};
