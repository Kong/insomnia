import React, {Component, PropTypes} from 'react'
import DebouncingInput from './DebouncingInput'

const NAME = 'name';
const VALUE = 'value';
const ENTER = 13;
const BACKSPACE = 8;
const UP = 38;
const DOWN = 40;
const DEBOUNCE_MILLIS = 300;

class KeyValueEditor extends Component {
  constructor (props) {
    super(props);
    this._focusedPair = -1;
    this._focusedField = NAME;
    this.state = {
      pairs: props.pairs
    }
  }

  _onChange (pairs, debounce = false) {
    // Surround in closure because callback may change before debounce
    clearTimeout(this._timeout);
    const millis = debounce ? DEBOUNCE_MILLIS : 0;
    this._timeout = setTimeout(this.props.onChange.bind(null, pairs), millis);
    if (debounce) {
      this.setState({pairs});
    }
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
    }
  }

  _updateFocus () {
    const refName = `${this._focusedPair}.${this._focusedField}`;
    const ref = this.refs[refName];

    if (ref) {
      ref.focus();

      // Focus at the end of the text
      ref.selectionStart = ref.selectionEnd = ref.value.length;
    }
  }

  componentWillReceiveProps (nextProps) {
    this.setState({pairs: nextProps.pairs})
  }

  componentDidUpdate () {
    this._updateFocus();
  }

  render () {
    const {pairs} = this.state;
    const {maxPairs} = this.props;

    return (
      <div className="grid--v grid--start wide">
        {pairs.map((pair, i) => {
          return (
            <div key={i} className="grid__cell grid__cell--no-flex grid">
              <div className="form-control form-control--underlined form-control--wide grid__cell">
                <input
                  type="text"
                  placeholder={this.props.namePlaceholder || 'Name'}
                  ref={`${i}.${NAME}`}
                  value={pair.name}
                  onChange={e => this._updatePair(i, {name: e.target.value})}
                  onFocus={e => {this._focusedPair = i; this._focusedField = NAME}}
                  onBlur={e => {this._focusedPair = -1}}
                  onKeyDown={this._keyDown.bind(this)}/>
              </div>
              <div>&nbsp;&nbsp;&nbsp;</div>
              <div className="form-control form-control--underlined form-control--wide grid__cell">
                <input
                  type="text"
                  placeholder={this.props.valuePlaceholder || 'Value'}
                  ref={`${i}.${VALUE}`}
                  value={pair.value}
                  onChange={e => this._updatePair(i, {value: e.target.value})}
                  onFocus={e => {this._focusedPair = i; this._focusedField = VALUE}}
                  onBlur={e => {this._focusedPair = -1}}
                  onKeyDown={this._keyDown.bind(this)}/>
              </div>
              <div>&nbsp;&nbsp;&nbsp;</div>
              <div className="grid--v">
                <button className="btn btn--compact"
                        tabIndex="-1"
                        onClick={e => this._deletePair(i)}>
                  <i className="fa fa-trash-o"></i>
                </button>
              </div>
            </div>
          )
        })}
        {maxPairs === undefined || pairs.length < maxPairs ? (
          <div className="grid__cell grid__cell--no-flex grid">
            <div className="form-control form-control--underlined form-control--wide grid__cell">
              <input type="text"
                     placeholder={this.props.namePlaceholder || 'Name'}
                     onFocus={e => {this._focusedField = NAME; this._addPair()}}/>
            </div>
            <div>&nbsp;&nbsp;&nbsp;</div>
            <div className="form-control form-control--underlined form-control--wide grid__cell">
              <input type="text"
                     placeholder={this.props.valuePlaceholder || 'Value'}
                     onFocus={e => {this._focusedField = VALUE; this._addPair()}}/>
            </div>
            <div>&nbsp;&nbsp;&nbsp;</div>
            <div className="grid--v">
              <button className="btn btn--compact" disabled={true} tabIndex="-1">
                <i className="fa fa-blank"></i>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    )
  }
}

KeyValueEditor.propTypes = {
  onChange: PropTypes.func.isRequired,
  pairs: PropTypes.array.isRequired,
  maxPairs: PropTypes.number,
  namePlaceholder: PropTypes.string,
  valuePlaceholder: PropTypes.string
};

export default KeyValueEditor;
