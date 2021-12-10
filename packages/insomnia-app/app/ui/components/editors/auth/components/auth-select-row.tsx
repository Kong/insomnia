import classnames from 'classnames';
import React, { ChangeEvent, FC, useCallback, useMemo } from 'react';

import { useActiveRequest } from '../../../../hooks/use-active-request';
import { HelpTooltip } from '../../../help-tooltip';

interface Props {
  label: string;
  property: string;
  options: {
    name: string;
    value: string;
  }[];
  help?: string;
}

export const AuthSelectRow: FC<Props> = ({ label, property, help, options }) => {
  const { activeRequest: { authentication }, patchAuth } = useActiveRequest();

  const selectedValue = authentication.hasOwnProperty(property) ? authentication[property] : options[0];

  const onChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => patchAuth({ [property]: event.currentTarget.value }), [patchAuth, property]);

  const id = useMemo(() => label.replace(/ /g, '-'), [label]);

  return (
    <tr key={id}>
      <td className="pad-right no-wrap valign-middle">
        <label htmlFor={id} className="label--small no-pad">
          {label}
          {help ? <HelpTooltip>{help}</HelpTooltip> : null}
        </label>
      </td>
      <td className="wide">
        <div
          className={classnames('form-control form-control--underlined no-margin', {
            'form-control--inactive': authentication.disabled,
          })}
        >
          <select id={id} onChange={onChange} value={selectedValue}>
            {options.map(({ name, value }) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </td>
    </tr>
  );
};
