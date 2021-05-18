import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../../common/constants';
import KeyValueEditor from '../../key-value-editor/editor';
import { HandleGetRenderContext, HandleRender } from '../../../../common/render';

interface Props {
  onChange: Function;
  parameters: any[];
  nunjucksPowerUserMode: boolean;
  isVariableUncovered: boolean;
  handleRender?: HandleRender;
  handleGetRenderContext?: HandleGetRenderContext;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class UrlEncodedEditor extends PureComponent<Props> {
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

export default UrlEncodedEditor;
