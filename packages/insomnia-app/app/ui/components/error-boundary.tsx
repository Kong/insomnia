import React, { PureComponent, ReactNode } from 'react';

import { Mailto } from './base/mailto';
import { showError } from './modals/index';

interface Props {
  children: ReactNode;
  errorClassName?: string;
  showAlert?: boolean;
  // Avoid using invalidation with showAlert, otherwise an alert will be shown with every attempted re-render
  invalidationKey?: string;
  renderError?: (error: Error) => ReactNode;
}

interface State {
  error: Error | null;
  info: {
    componentStack: string;
  } | null;
}

class SingleErrorBoundary extends PureComponent<Props, State> {
  state: State = {
    error: null,
    info: null,
  };

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const { error, info } = this.state;
    const invalidationKeyChanged = nextProps.invalidationKey !== this.props.invalidationKey;
    const isErrored = error !== null || info !== null;
    const shouldResetError = invalidationKeyChanged && isErrored;

    if (shouldResetError) {
      this.setState({
        error: null,
        info: null,
      });
    }
  }

  componentDidCatch(
    error: Error,
    info: {
      componentStack: string;
    },
  ) {
    const { children } = this.props;
    const firstChild = Array.isArray(children) && children.length === 1 ? children[0] : children;
    this.setState({ error, info });
    let componentName = 'component';

    try {
      // @ts-expect-error -- TSCONVERSION
      componentName = firstChild.type.name;
    } catch (err) {
      // It's okay
    }

    if (this.props.showAlert) {
      try {
        showError({
          error,
          title: 'Application Error',
          // @ts-expect-error -- TSCONVERSION
          message: (
            <p>
              Failed to render {componentName}. Please send the following error to{' '}
              <Mailto email="support@insomnia.rest" subject="Error Report" body={error.stack} />.
            </p>
          ),
        });
      } catch (err) {
        // UI is so broken that we can't even show an alert
      }
    }
  }

  render() {
    const { error, info } = this.state;
    const { errorClassName, children, renderError } = this.props;

    if (error && info) {
      return renderError ? (
        renderError(error)
      ) : (
        <div className={errorClassName ?? ''}>Render Failure: {error.message}</div>
      );
    }

    return children;
  }
}

export class ErrorBoundary extends PureComponent<Props> {
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
