import React, { FC, memo } from 'react';

import { METHOD_DELETE, METHOD_OPTIONS } from '../../../common/constants';

interface Props {
  method: string;
  override?: string | null;
  fullNames?: boolean;
}
function removeVowels(str: string) {
  return str.replace(/[aeiouyAEIOUY]/g, '');
}
function formatMethodName(method: string) {
  let methodName = method || '';

  if (method === METHOD_DELETE || method === METHOD_OPTIONS) {
    methodName = method.slice(0, 3);
  } else if (method.length > 4) {
    methodName = removeVowels(method).slice(0, 4);
  }

  return methodName;
}

export const MethodTag: FC<Props> = memo(({ method, override, fullNames }) => {
  let methodName = method;
  let overrideName = override;

  if (!fullNames) {
    methodName = formatMethodName(method);
    overrideName = override ? formatMethodName(override) : override;
  }

  return (
    <div
      style={{
        position: 'relative',
      }}
    >
      {overrideName && (
        <div className={'tag tag--no-bg tag--superscript http-method-' + method}>
          <span>{methodName}</span>
        </div>
      )}
      <div
        className={'tag tag--no-bg tag--small http-method-' + (overrideName ? override : method)}
      >
        <span className="tag__inner">{overrideName || methodName}</span>
      </div>
    </div>
  );
});

MethodTag.displayName = 'MethodTag';
