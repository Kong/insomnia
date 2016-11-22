import React, {Component, PropTypes} from 'react';
import classnames from 'classnames';
import {DEBOUNCE_MILLIS} from '../../../common/constants';
import PromptButton from '../base/PromptButton';

const NAME = 'name';
const VALUE = 'value';
const ENTER = 13;
const BACKSPACE = 8;
const UP = 38;
const DOWN = 40;
const LEFT = 37;
const RIGHT = 39;

class KeyValueEditor extends Component {
  constructor (props) {
    super(props);

    this._focusedPair = -1;
    this._focusedField = NAME;
    this._nameInputs = {};
    this._valueInputs = {};
    this._focusedInput = null;

    this.state = {
      pairs: props.pairs
    }
  }

  _onChange (pairs, updateState = true) {
    clearTimeout(this._triggerTimeout);
    this._triggerTimeout = setTimeout(() => this.props.onChange(pairs), DEBOUNCE_MILLIS);
    updateState && this.setState({pairs});
  }

  _addPair (position) {
    const numPairs = this.state.pairs.length;
    const {maxPairs} = this.props;

    // Don't add any more pairs
    if (maxPairs !== undefined && numPairs >= maxPairs) {
      return;
    }

    position = position === undefined ? numPairs : position;
    this._focusedPair = position;
    const pairs = [
      ...this.state.pairs.slice(0, position),
      {name: '', value: ''},
      ...this.state.pairs.slice(position)
    ];

    this._onChange(pairs);
  }

  _deletePair (position) {
    if (this._focusedPair >= position) {
      this._focusedPair = this._focusedPair - 1;
    }
    this._onChange(this.state.pairs.filter((_, i) => i !== position));
  }

  _updatePair (position, pairPatch) {
    const pairs = this.state.pairs.map(
      (p, i) => i == position ? Object.assign({}, p, pairPatch) : p
    );
    this._onChange(pairs);
  }

  _togglePair (position) {
    const pairs = this.state.pairs.map(
      (p, i) => i == position ? Object.assign({}, p, {disabled: !p.disabled}) : p
    );
    this._onChange(pairs, true);
  }

  _focusNext (addIfValue = false) {
    if (this._focusedField === NAME) {
      this._focusedField = VALUE;
      this._updateFocus();
    } else if (this._focusedField === VALUE) {
      this._focusedField = NAME;
      if (addIfValue) {
        this._addPair(this._focusedPair + 1);
      } else {
        this._focusNextPair();
      }
    }
  }

  _focusPrevious (deleteIfEmpty = false) {
    if (this._focusedField === VALUE) {
      this._focusedField = NAME;
      this._updateFocus();
    } else if (this._focusedField === NAME) {
      const pair = this.state.pairs[this._focusedPair];
      if (!pair.name && !pair.value && deleteIfEmpty) {
        this._focusedField = VALUE;
        this._deletePair(this._focusedPair);
      } else if (!pair.name) {
        this._focusedField = VALUE;
        this._focusPreviousPair();
      }
    }
  }

  _focusNextPair () {
    if (this._focusedPair >= this.state.pairs.length - 1) {
      this._addPair();
    } else {
      this._focusedPair++;
      this._updateFocus();
    }
  }

  _focusPreviousPair () {
    if (this._focusedPair > 0) {
      this._focusedPair--;
      this._updateFocus();
    }
  }

  _keyDown (e) {
    if (e.metaKey || e.ctrlKey) {
      return;
    }

    if (e.keyCode === ENTER) {
      e.preventDefault();
      this._focusNext(true);
    } else if (e.keyCode === BACKSPACE) {
      if (!e.target.value) {
        e.preventDefault();
        this._focusPrevious(true);
      }
    } else if (e.keyCode === DOWN) {
      e.preventDefault();
      this._focusNextPair();
    } else if (e.keyCode === UP) {
      e.preventDefault();
      this._focusPreviousPair();
    } else if (e.keyCode === LEFT) {
      // TODO: Implement this
    } else if (e.keyCode === RIGHT) {
      // TODO: Implement this
    }
  }

  _updateFocus () {
    let ref;
    if (this._focusedField === NAME) {
      ref = this._nameInputs[this._focusedPair];
    } else {
      ref = this._valueInputs[this._focusedPair];
    }

    // If you focus an already focused input
    if (!ref || this._focusedInput === ref) {
      return;
    }

    // Focus at the end of the text
    ref.focus();
    ref.selectionStart = ref.selectionEnd = ref.value.length;
  }

  componentDidUpdate () {
    this._updateFocus();
  }

  render () {
    const {pairs} = this.state;
    const {maxPairs, className, valueInputType} = this.props;

    return (
      <ul className={classnames('key-value-editor', 'wide', className)}>
        {pairs.map((pair, i) => (
          <li key={`${i}.pair`}
              className={classnames(
                'key-value-editor__row',
                {'key-value-editor__row--disabled': pair.disabled}
              )}>
            <div>
              <div className="form-control form-control--underlined form-control--wide">
                <input
                  type="text"
                  key="name"
                  ref={n => this._nameInputs[i] = n}
                  placeholder={this.props.namePlaceholder || 'Name'}
                  defaultValue={pair.name}
                  onChange={e => this._updatePair(i, {name: e.target.value})}
                  onFocus={e => {
                    this._focusedPair = i;
                    this._focusedField = NAME;
                    this._focusedInput = e.target;
                  }}
                  onBlur={() => {
                    this._focusedPair = -1
                  }}
                  onKeyDown={this._keyDown.bind(this)}
                />
              </div>
            </div>
            <div>
              <div className={classnames(
                'form-control form-control--wide', {
                  'form-control--underlined': valueInputType !== 'file',
                  'form-control--padded': valueInputType === 'file',
                }
              )}>
                <input
                  type={valueInputType || 'text'}
                  placeholder={this.props.valuePlaceholder || 'Value'}
                  ref={n => this._valueInputs[i] = n}
                  defaultValue={pair.value}
                  onChange={e => this._updatePair(i, {value: e.target.value})}
                  onFocus={e => {
                    this._focusedPair = i;
                    this._focusedField = VALUE;
                    this._focusedInput = e.target;
                  }}
                  onBlur={() => {
                    this._focusedPair = -1
                  }}
                  onKeyDown={this._keyDown.bind(this)}
                />
              </div>
            </div>

            <button tabIndex="-1"
                    onClick={e => this._togglePair(i)}
                    title={pair.disabled ? 'Enable item' : 'Disable item'}>
              {pair.disabled ?
                <i className="fa fa-square-o"></i> :
                <i className="fa fa-check-square-o"></i>
              }
            </button>

            <PromptButton key={Math.random()}
                          tabIndex="-1"
                          onClick={e => this._deletePair(i)}
                          title="Delete item"
                          confirmMessage={<i className="fa fa-trash-o"></i>}>
              <i className="fa fa-trash-o"></i>
            </PromptButton>
          </li>
        ))}
        {!maxPairs || pairs.length < maxPairs ? (
          <li className="key-value-editor__row">
            <div className="form-control form-control--underlined form-control--wide">
              <input type="text"
                     placeholder={this.props.namePlaceholder || 'Name'}
                     onFocus={() => {
                       this._focusedField = NAME;
                       this._addPair()
                     }}/>
            </div>
            <div className="form-control form-control--underlined form-control--wide">
              <input type="text"
                     placeholder={this.props.valuePlaceholder || 'Value'}
                     onFocus={() => {
                       this._focusedField = VALUE;
                       this._addPair()
                     }}/>
            </div>
            <button disabled={true} tabIndex="-1">
              <i className="fa fa-blank"></i>
            </button>
            <button disabled={true} tabIndex="-1">
              <i className="fa fa-blank"></i>
            </button>
          </li>
        ) : null}
      </ul>
    )
  }
}

KeyValueEditor.propTypes = {
  onChange: PropTypes.func.isRequired,
  pairs: PropTypes.arrayOf(PropTypes.object).isRequired,

  // Optional
  maxPairs: PropTypes.number,
  namePlaceholder: PropTypes.string,
  valuePlaceholder: PropTypes.string,
  valueInputType: PropTypes.string
};

export default KeyValueEditor;
