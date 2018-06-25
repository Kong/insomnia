// @flow
import * as React from 'react';
import { showError } from './modals/index';
import Mailto from './base/mailto';

type Props = {
  children: React.Node,
  errorClassName?: string,
  showAlert?: boolean,
  replaceWith?: React.Node
};

type State = {
  error: Error | null,
  info: { componentStack: string } | null
};

class SingleErrorBoundary extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      error: null,
      info: null
    };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    const { children } = this.props;
    const firstChild =
      Array.isArray(children) && children.length === 1 ? children[0] : children;

    this.setState({ error, info });

    let componentName = 'component';
    try {
      componentName = (firstChild: any).type.name;
    } catch (err) {
      // It's okay
    }

    if (this.props.showAlert) {
      try {
        showError({
          error,
          title: 'Application Error',
          message: (
            <p>
              Failed to render {componentName}. Please send the following error
              to{' '}
              <Mailto
                email="support@insomnia.rest"
                subject="Error Report"
                body={error.stack}
              />.
            </p>
          )
        });
      } catch (err) {
        // UI is so broken that we can't even show an alert
      }
    }
  }

  render() {
    const { error, info } = this.state;
    const { errorClassName, children } = this.props;

    if (error && info) {
      return (
        <div className={errorClassName || null}>
          Render Failure: {error.message}
        </div>
      );
    }

    return children;
  }
}

class ErrorBoundary extends React.PureComponent<Props> {
  render() {
    const { children, ...extraProps } = this.props;

    if (!children) {
      return null;
    }

    // Unwrap multiple children into single children for better error isolation
    const childArray = Array.isArray(children) ? children : [children];
    return childArray.map((child, i) => (
      <SingleErrorBoundary key={i} {...extraProps}>
        {child}
      </SingleErrorBoundary>
    ));
  }
}

export default ErrorBoundary;
