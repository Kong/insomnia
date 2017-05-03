import Raven from 'raven';
import {getAppVersion, isDevelopment} from '../common/constants';

export function init () {
  _initSentry();
}

function _initSentry () {
  let ravenClient = null;

  if (!isDevelopment()) {
    ravenClient = Raven.config('https://786e43ae199c4757a9ea4a48a9abd17d@sentry.io/109702', {
      environment: isDevelopment() ? 'development' : 'production',
      release: getAppVersion(),
      logger: 'electron.main'
    });

    ravenClient.install();
  }

  process.on('uncaughtException', e => {
    if (ravenClient) {
      ravenClient.captureException(e, {});
    } else {
      console.error(e);
    }
  });
}
