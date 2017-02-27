import React, {PureComponent, PropTypes} from 'react';
import classnames from 'classnames';
import {DEBOUNCE_MILLIS} from '../../../common/constants';
import KeyValueEditorRow from './Row';

const NAME = 'name';
const VALUE = 'value';
const ENTER = 13;
const BACKSPACE = 8;
const UP = 38;
const DOWN = 40;
const LEFT = 37;
const RIGHT = 39;

const nullFn = () => null;

class KeyValueEditor extends PureComponent {
  constructor (props) {
    super(props);

    this._focusedPair = -1;
    this._focusedField = NAME;
    this._rows = [];

    this.state = {
      pairs: props.pairs
    }
  }

  _handlePairChange = (i, pair) => {
    const pairs = [
      ...this.state.pairs.slice(0, i),
      pair,
      ...this.state.pairs.slice(i + 1),
    ];

    this._onChange(pairs);
  };

  _handlePairDelete = i => this._deletePair(i, true);

  _handleFocusName = i => {
    this._focusedPair = i;
    this._focusedField = NAME;
  };

  _handleFocusValue = i => {
    this._focusedPair = i;
    this._focusedField = VALUE;
  };

  _handleAddFromName = () => {
    this._focusedField = NAME;
    this._addPair();
  };

  _handleAddFromValue = () => {
    this._focusedField = VALUE;
    this._addPair();
  };

  _handleKeyDown = (i, e, value) => {
    if (e.metaKey || e.ctrlKey) {
      return;
    }

    if (e.keyCode === ENTER) {
      e.preventDefault();
      this._focusNext(true);
    } else if (e.keyCode === BACKSPACE) {
      if (!value) {
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
  };

  ///////////////////////////

  _onChange (pairs, updateState = true) {
    clearTimeout(this._triggerTimeout);
    this._triggerTimeout = setTimeout(() => this.props.onChange(pairs), DEBOUNCE_MILLIS);
    updateState && this.setState({pairs});
  }

  _addPair (position, patch) {
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
      Object.assign({name: '', value: ''}, patch),
      ...this.state.pairs.slice(position)
    ];

    this.props.onCreate && this.props.onCreate();

    this._onChange(pairs);
  }

  _deletePair (position, breakFocus = false) {
    if (this._focusedPair >= position) {
      this._focusedPair = breakFocus ? -1 : this._focusedPair - 1;
    }

    const pair = this.state.pairs[position];
    this.props.onDelete && this.props.onDelete(pair);

    const pairs = this.state.pairs.filter((_, i) => i !== position);

    this._onChange(pairs);
  };

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
      if (!pair.name && !pair.value && !pair.fileName && deleteIfEmpty) {
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

  _updateFocus () {
    const row = this._rows[this._focusedPair];

    if (!row) {
      return;
    }

    if (this._focusedField === NAME) {
      row.focusName();
    } else {
      row.focusValue();
    }
  }

  componentDidUpdate () {
    this._updateFocus();
  }

  render () {
    const {
      maxPairs,
      className,
      valueInputType,
      valuePlaceholder,
      namePlaceholder,
      multipart,
      sortable,
    } = this.props;

    const {
      pairs
    } = this.state;

    return (
      <ul key={pairs.length} className={classnames('key-value-editor', 'wide', className)}>
        {pairs.map((pair, i) => (
          <KeyValueEditorRow
            id={i}
            key={`${pairs.length}:${i}`}
            ref={n => this._rows[i] = n}
            sortable={sortable}
            namePlaceholder={namePlaceholder}
            valuePlaceholder={valuePlaceholder}
            valueInputType={valueInputType}
            onChange={this._handlePairChange}
            onDelete={this._handlePairDelete}
            onFocusName={this._handleFocusName}
            onFocusValue={this._handleFocusValue}
            onKeyDown={this._handleKeyDown}
            multipart={multipart}
            pair={pair}
          />
        ))}

        {!maxPairs || pairs.length < maxPairs ?
          <KeyValueEditorRow
            id="last-row"
            sortable
            hideButtons
            className="faded"
            onChange={nullFn}
            onDelete={nullFn}
            onFocusName={this._handleAddFromName}
            onFocusValue={this._handleAddFromValue}
            pair={{name: '', value: ''}}
          /> : null
        }
      </ul>
    )
  }
}

KeyValueEditor.propTypes = {
  onChange: PropTypes.func.isRequired,
  pairs: PropTypes.arrayOf(PropTypes.object).isRequired,

  // Optional
  handleRender: PropTypes.func,
  multipart: PropTypes.bool,
  sortable: PropTypes.bool,
  maxPairs: PropTypes.number,
  namePlaceholder: PropTypes.string,
  valuePlaceholder: PropTypes.string,
  valueInputType: PropTypes.string,
  onToggleDisable: PropTypes.func,
  onChangeType: PropTypes.func,
  onChooseFile: PropTypes.func,
  onDelete: PropTypes.func,
  onCreate: PropTypes.func,
};

export default KeyValueEditor;
