import workerpool from 'workerpool';

import { spectralRun } from './spectral';

// create a worker and register public functions
workerpool.worker({
  spectralRun: spectralRun,
});
