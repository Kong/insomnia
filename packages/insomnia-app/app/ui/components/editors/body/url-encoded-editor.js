import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../../common/constants';
import KeyValueEditor from '../../key-value-editor/editor';

@autoBindMethodsForReact(AUTOBIND_CFG)
class UrlEncodedEditor extends PureComponent {
  render() {
    const {
      parameters,
      onChange,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
    } = this.props;

    return (
      <div className="scrollable-container tall wide">
        <div className="scrollable">
          <KeyValueEditor
            sortable
            allowMultiline
            namePlaceholder="name"
            valuePlaceholder="value"
            descriptionPlaceholder="description"
            onChange={onChange}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            nunjucksPowerUserMode={nunjucksPowerUserMode}
            isVariableUncovered={isVariableUncovered}
            pairs={parameters}
          />
        </div>
      </div>
    );
  }
}

UrlEncodedEditor.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  parameters: PropTypes.arrayOf(PropTypes.object).isRequired,
  nunjucksPowerUserMode: PropTypes.bool.isRequired,
  isVariableUncovered: PropTypes.bool.isRequired,

  // Optional
  handleRender: PropTypes.func,
  handleGetRenderContext: PropTypes.func,
};

export default UrlEncodedEditor;
