// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import {
  buildQueryStringFromParams,
  joinUrlAndQueryString
} from 'insomnia-url';
import Link from './link';

type Props = {|
  email: string,
  children?: React.Node,
  subject?: string,
  body?: string
|};

@autobind
class Mailto extends React.PureComponent<Props> {
  render() {
    const { email, body, subject, children } = this.props;

    const params = [];
    if (subject) {
      params.push({ name: 'subject', value: subject });
    }
    if (body) {
      params.push({ name: 'body', value: body });
    }

    const qs = buildQueryStringFromParams(params);
    const href = joinUrlAndQueryString(`mailto:${email}`, qs);

    return <Link href={href}>{children || email}</Link>;
  }
}

export default Mailto;
