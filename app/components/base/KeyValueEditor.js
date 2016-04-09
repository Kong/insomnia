import React, {Component, PropTypes} from 'react'
import DebouncingInput from './DebouncingInput'

class KeyValueEditor extends Component {
  _addField () {
    console.log('_addField');
    this.props.onChange([...this.props.pairs, {name: '', value: ''}]);
  }

  _onChangeName (position, name) {
    this.props.onChange(
      this.props.pairs.map((p, i) => i == position ? Object.assign({}, p, {name}) : p)
    );
  }

  render () {
    const {pairs} = this.props;
    return (
      <div className="grid--v grid--start wide">
        {pairs.map((pair, i) => (
          <div key={i} className="grid__cell grid__cell--no-flex grid">
            <div className="form-control form-control--underlined grid__cell">
              <DebouncingInput type="text"
                               placeholder="Name"
                               initialValue={pair.name}
                               onChange={name => this._onChangeName(i, name)}
                               debounceMillis={300}
                               autoFocus={!pair.name}/>
            </div>
            <div className="form-control form-control--underlined grid__cell">
              <input type="text"
                     placeholder="Value"
                     defaultValue={pair.value}
                     autoFocus={!pair.value}/>
            </div>
            <div className="grid--v">
              <button className="btn btn--compact" tabIndex="-1">
                <i className="fa fa-trash-o"></i>
              </button>
            </div>
          </div>
        ))}

        <div className="grid__cell grid__cell--no-flex grid">
          <div className="form-control form-control--underlined grid__cell">
            <input type="text" placeholder="Name" onClick={this._addField.bind(this)}/>
          </div>
          <div className="form-control form-control--underlined grid__cell">
            <input type="text" placeholder="Value" onClick={this._addField.bind(this)}/>
          </div>
          <div className="grid--v">
            <button className="btn btn--compact" disabled={true} tabIndex="-1">
              <i className="fa fa-blank"></i>
            </button>
          </div>
        </div>
      </div>
    )
  }
}

KeyValueEditor.propTypes = {
  onChange: PropTypes.func.isRequired,
  pairs: PropTypes.array.isRequired
};

export default KeyValueEditor;
