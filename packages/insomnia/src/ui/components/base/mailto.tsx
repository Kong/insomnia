import React, { FC, ReactNode } from 'react';

import { buildQueryStringFromParams, joinUrlAndQueryString } from '../../../utils/url/querystring';
import { Link } from './link';

interface Props {
  email: string;
  children?: ReactNode;
  subject?: string;
  body?: string;
}

export const Mailto: FC<Props> = ({
  email,
  body,
  subject,
  children,
}) => {
  const params: {
    name: string;
    value: string;
  }[] = [
    ...(subject ? [{
      name: 'subject',
      value: subject,
    }] : []),
    ...(body ? [{
      name: 'body',
      value: body,
    }] : []),
  ];

  const qs = buildQueryStringFromParams(params);
  const href = joinUrlAndQueryString(`mailto:${email}`, qs);
  return <Link href={href}>{children || email}</Link>;
};
