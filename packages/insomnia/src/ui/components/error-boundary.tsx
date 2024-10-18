import React, { PureComponent, type ReactNode } from 'react';

import { showError } from './modals/index';

interface Props {
  children: ReactNode;
  errorClassName?: string;
  showAlert?: boolean;
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
      componentName = firstChild.type.name;
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
              Failed to render {componentName}. Please report the error to <a href="https://github.com/Kong/insomnia/issues">our GitHub Issues</a>
            </p>
          ),
        });
      } catch (err) {
        // UI is so broken that we can't even show an alert
      }
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className={this.props.errorClassName ?? 'font-error'}>Render Failure: {this.state.error.message}</div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = (props: Props) => {
  const { children, ...extraProps } = props;

  if (!children) {
    return null;
  }

  return (
    <SingleErrorBoundary {...extraProps}>
      {children}
    </SingleErrorBoundary>
  );
};
