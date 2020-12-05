import { App } from '@tinyhttp/app';
import { logger } from '@tinyhttp/logger';

const app = new App();

app
  .use(logger())
  .get('/pets/:id', (req, res) => {
    setTimeout(() => {
      res.status(200).send({ id: req.params.id });
    }, 500);
  })
  .get('/csv', (_, res) => {
    res
      .status(200)
      .header('content-type', 'text/csv')
      .send(`a,b,c\n1,2,3`);
  })
  .listen(4010);
