import React, {Component, PropTypes} from 'react';
import classnames from 'classnames';
import Input from '../base/Input';

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

    this.state = {
      pairs: props.pairs
    }
  }

  _onChange (pairs) {
    this.props.onChange(pairs);
  }

  _addPair (position) {
    position = position === undefined ? this.state.pairs.length : position;
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
    if (this._focusedPair >= 0) {
      this._focusedPair--;
      this._updateFocus();
    }
  }

  _keyDown (e) {
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
    const refName = `${this._focusedPair}.${this._focusedField}`;
    const ref = this.refs[refName];

    if (ref) {
      ref.focus();

      // Focus at the end of the text
      ref.selectionStart = ref.selectionEnd = ref.getValue().length;
    }
  }

  // This works, but is commented out because it's caused some bugs
  // TODO: Re-implement this (if needed) after some perf analysis
  // shouldComponentUpdate (nextProps) {
  //   // Compare the config (quick)
  //   if (nextProps.valueInputType !== this.props.valueInputType) {
  //     return true;
  //   }
  //
  //   // Compare uniqueness key (quick)
  //   if (nextProps.uniquenessKey !== this.props.uniquenessKey) {
  //     return true;
  //   }
  //
  //   // Compare array length (quick)
  //   if (nextProps.pairs.length !== this.state.pairs.length) {
  //     return true;
  //   }
  //
  //   // Compare arrays
  //   for (let i = 0; i < nextProps.pairs.length; i++) {
  //     let newPair = nextProps.pairs[i];
  //     let oldPair = this.state.pairs[i];
  //     if (newPair.name !== oldPair.name || newPair.value !== oldPair.value) {
  //       return true;
  //     }
  //   }
  //
  //   return false;
  // }

  componentWillReceiveProps (nextProps) {
    this.setState({pairs: nextProps.pairs})
  }

  componentDidUpdate () {
    this._updateFocus();
  }

  render () {
    const {pairs} = this.state;
    const {maxPairs, className, valueInputType} = this.props;

    return (
      <ul className={classnames('key-value-editor', 'wide', className)}>
        {pairs.map((pair, i) => {
          if (typeof pair.value !== 'string') {
            return null;
          }

          return (
            <li key={i}>
              <div className="key-value-editor__row">
                <div className="form-control form-control--underlined form-control--wide">
                  <Input
                    type="text"
                    placeholder={this.props.namePlaceholder || 'Name'}
                    ref={`${i}.${NAME}`}
                    value={pair.name}
                    onChange={name => this._updatePair(i, {name})}
                    onFocus={() => {
                      this._focusedPair = i;
                      this._focusedField = NAME
                    }}
                    onBlur={() => {
                      this._focusedPair = -1
                    }}
                    onKeyDown={this._keyDown.bind(this)}/>
                </div>
                <div className="form-control form-control--underlined form-control--wide">
                  <Input
                    type={valueInputType || 'text'}
                    placeholder={this.props.valuePlaceholder || 'Value'}
                    ref={`${i}.${VALUE}`}
                    value={pair.value}
                    onChange={value => this._updatePair(i, {value})}
                    onFocus={() => {
                      this._focusedPair = i;
                      this._focusedField = VALUE
                    }}
                    onBlur={() => {
                      this._focusedPair = -1
                    }}
                    onKeyDown={this._keyDown.bind(this)}/>
                </div>

                <button tabIndex="-1" onClick={e => this._deletePair(i)}>
                  <i className="fa fa-trash-o"></i>
                </button>
              </div>
            </li>
          )
        })}
        {maxPairs === undefined || pairs.length < maxPairs ? (
          <li>
            <div className="key-value-editor__row">
              <div className="form-control form-control--underlined form-control--wide">
                <input type="text"
                       placeholder={this.props.namePlaceholder || 'Name'}
                       onFocus={() => {
                         this._focusedField = NAME;
                         this._addPair()
                       }}/>
              </div>
              <div className="form-control form-control--underlined form-control--wide">
                <input type={valueInputType || 'text'}
                       placeholder={this.props.valuePlaceholder || 'Value'}
                       onFocus={() => {
                         this._focusedField = VALUE;
                         this._addPair()
                       }}/>
              </div>
              <button disabled={true} tabIndex="-1">
                <i className="fa fa-blank"></i>
              </button>
            </div>
          </li>
        ) : null}
      </ul>
    )
  }
}

KeyValueEditor.propTypes = {
  onChange: PropTypes.func.isRequired,
  uniquenessKey: PropTypes.string.isRequired,
  pairs: PropTypes.array.isRequired,
  maxPairs: PropTypes.number,
  namePlaceholder: PropTypes.string,
  valuePlaceholder: PropTypes.string,
  valueInputType: PropTypes.string
};

export default KeyValueEditor;
