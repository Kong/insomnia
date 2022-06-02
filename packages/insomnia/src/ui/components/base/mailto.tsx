import { buildQueryStringFromParams, joinUrlAndQueryString } from 'insomnia-url';
import React, { FC, ReactNode } from 'react';

import { Link } from './link';

interface Props {
  email: string;
  children?: ReactNode;
  subject?: string;
  body?: string;
}

export const Mailto: FC<Props> = props => {
  const {
    email,
    body,
    subject,
    children,
  } = props;
  const params: {
    name: string;
    value: string;
  }[] = [];

  if (subject) {
    params.push({
      name: 'subject',
      value: subject,
    });
  }

  if (body) {
    params.push({
      name: 'body',
      value: body,
    });
  }

  const qs = buildQueryStringFromParams(params);
  const href = joinUrlAndQueryString(`mailto:${email}`, qs);
  return <Link href={href}>{children || email}</Link>;
};
