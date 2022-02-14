import { start as build } from './build';
import { start as packageApp } from './package';

// Start package if run from CLI
if (require.main === module) {
  process.nextTick(async () => {
    try {
      await build({ releaseBuild: true });
      await packageApp();
    } catch (err) {
      console.log('[release] ERROR:', err);
      process.exit(1);
    }
  });
}
