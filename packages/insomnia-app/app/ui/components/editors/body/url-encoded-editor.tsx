import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../../common/constants';
import { KeyValueEditor } from '../../key-value-editor/key-value-editor';

interface Props {
  onChange: Function;
  parameters: any[];
  isVariableUncovered: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class UrlEncodedEditor extends PureComponent<Props> {
  render() {
    const {
      parameters,
      onChange,
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
            isVariableUncovered={isVariableUncovered}
            pairs={parameters}
          />
        </div>
      </div>
    );
  }
}
