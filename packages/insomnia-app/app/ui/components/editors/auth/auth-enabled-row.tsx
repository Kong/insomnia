import React, { FC, useCallback } from 'react';

import { useActiveRequest } from '../../../hooks/use-active-request';
import { Button } from '../../base/button';

export const AuthEnabledRow: FC<{enabled: boolean; patchAuth: ReturnType<typeof useActiveRequest>['patchAuth']}> = ({ enabled, patchAuth }) => {
  const toggleEnabled = useCallback(() => patchAuth({ disable: enabled }), [enabled, patchAuth]);

  return (
    <tr>
      <td className="pad-right no-wrap valign-middle">
        <label htmlFor="enabled" className="label--small no-pad">
          Enabled
        </label>
      </td>
      <td className="wide">
        <div className="form-control form-control--underlined">
          <Button
            className="btn btn--super-duper-compact"
            id="enabled"
            onClick={toggleEnabled}
            value={enabled}
            title={enabled ? 'Disable item' : 'Enable item'}
          >
            {enabled ? <i className="fa fa-check-square-o" /> : <i className="fa fa-square-o" />}
          </Button>
        </div>
      </td>
    </tr>
  );
};
