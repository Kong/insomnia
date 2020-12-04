// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Dropdown from '../base/dropdown/dropdown';
import DropdownItem from '../base/dropdown/dropdown-item';
import DropdownButton from '../base/dropdown/dropdown-button';
import { showPrompt } from '../modals';

type Props = {
  title?: string,
  hint?: string,
  readOnly?: boolean,
  placeholder?: string,
  items?: Array<string>,
  defaultValue?: string,
  submitName?: string,
  onChange?: (value: string, items: Array<string>) => void,
};

@autobind
class HintDropdown extends React.PureComponent<Props> {
  constructor(props) {
    super(props);

    const { title, hint, placeholder, items, submitName, defaultValue } = this.props;

    const selected = defaultValue && items && items.includes(defaultValue) ? defaultValue : '';

    this.state = {
      title: title || 'Values',
      items: items || [],
      placeholder: placeholder || 'Pick an item ...',
      hint: hint || 'To add an item, write then press Enter',
      submitName: submitName || 'Close',
      selected: selected,
    };
  }

  render() {
    const { title, hint, placeholder, selected, items, submitName } = this.state;
    const { readOnly } = this.props;
    return (
      <>
        <Dropdown className="editor--single-line wide">
          <DropdownButton className="editor--single-line input">
            <i className="fa fa-filter space-right" />
            {selected || placeholder}
          </DropdownButton>
          {items.map(e => {
            return (
              <DropdownItem onClick={() => this._handleOnChange(e)} key={e}>
                {e}
              </DropdownItem>
            );
          })}
        </Dropdown>
        {!readOnly && (
          <button
            className="btn btn--micro no-pad"
            style={{ marginLeft: 3 }}
            onClick={() =>
              showPrompt({
                inputType: 'hint',
                title: title,
                hints: items,
                hint: hint,
                submitName: submitName,
                onChange: this._handleOnChange,
              })
            }>
            <h6>
              <i className="fa fa-edit space-right" />
              Edit
            </h6>
          </button>
        )}
      </>
    );
  }

  _forwardOnChange() {
    const { onChange } = this.props;
    const { selected, items } = this.state;
    onChange && onChange(selected, items);
  }

  _handleOnChange(newSelection: string, items?: Array<string>) {
    const { selected } = this.state;
    if (items) {
      if (items.length === 0) {
        this.setState({ selected: '', items: items }, this._forwardOnChange);
      } else if (selected && items.includes(selected)) {
        this.setState({ selected: newSelection || selected, items: items }, this._forwardOnChange);
      } else {
        this.setState({ selected: newSelection || '', items: items }, this._forwardOnChange);
      }
    } else {
      this.setState({ selected: newSelection || selected }, this._forwardOnChange);
    }
  }
}

export default HintDropdown;
