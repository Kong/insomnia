import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { buildQueryStringFromParams, joinUrlAndQueryString } from 'insomnia-url';
import React, { PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { Link } from './link';

interface Props {
  email: string;
  children?: ReactNode;
  subject?: string;
  body?: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class Mailto extends PureComponent<Props> {
  render() {
    const { email, body, subject, children } = this.props;
    const params: {name: string; value: string}[] = [];

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
  }
}
