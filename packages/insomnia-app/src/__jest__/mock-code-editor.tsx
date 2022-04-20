import React, { createRef, PureComponent } from 'react';

export class MockCodeEditor extends PureComponent<any> {
  ref = createRef<HTMLTextAreaElement>();

  setSelection() {}

  focus() {
    this.ref.current?.focus();
  }

  render() {
    const { id, onChange, placeholder, defaultValue } = this.props;
    return <textarea
      ref={this.ref}
      id={id}
      onChange={e => onChange(e.currentTarget.value)}
      placeholder={placeholder}
      defaultValue={defaultValue}
    />;
  }
}
