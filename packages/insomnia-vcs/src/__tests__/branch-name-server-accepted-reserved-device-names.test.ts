import { describe, expect, it } from 'vitest';

import { VCS } from '../vcs';

// Each name below satisfies every sync-server branch rule (non-empty, <=256 bytes, no control
// characters, no backslash, no '.'/'..' segment). On Windows, `branches/<name>.json` and its temp
// file `<name>.json.<uuid>.tmp` resolve to legacy DOS devices (NUL, CON, AUX, PRN, COMx, LPTx), so
// the branch can never be persisted there. The client validator must reject these names.
// NOTE: the device-name behaviour itself is only executable on Windows; this host is macOS.

const serverAcceptedReservedNames = ['nul', 'con', 'aux', 'prn', 'com1', 'lpt1', 'CON', 'nul.txt'];

describe('validateBranchName and Windows reserved device names', () => {
  describe.each(serverAcceptedReservedNames)('%s', name => {
    it('is rejected by the client branch-name validator', () => {
      expect(VCS.validateBranchName(name)).not.toBe('');
    });
  });
});
