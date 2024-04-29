import path from 'path';
import workerpool from 'workerpool';

// create a worker pool using an external worker script
export const workerThreadPool = workerpool.pool(path.join(__dirname, 'main.worker.js'));
