import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import KeyValueEditor from '../../key-value-editor/editor';

@autobind
class FormEditor extends PureComponent {
  render() {
    const {
      parameters,
      onChange,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode
    } = this.props;

    return (
      <div className="scrollable-container tall wide">
        <div className="scrollable">
          <KeyValueEditor
            sortable
            allowFile
            allowMultiline
            namePlaceholder="name"
            valuePlaceholder="value"
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            nunjucksPowerUserMode={nunjucksPowerUserMode}
            onChange={onChange}
            pairs={parameters}
          />
        </div>
      </div>
    );
  }
}

FormEditor.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  parameters: PropTypes.arrayOf(PropTypes.object).isRequired,
  nunjucksPowerUserMode: PropTypes.bool.isRequired,

  // Optional
  handleRender: PropTypes.func,
  handleGetRenderContext: PropTypes.func
};

export default FormEditor;
