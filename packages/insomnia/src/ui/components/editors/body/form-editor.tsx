import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../../common/constants';
import { KeyValueEditor } from '../../key-value-editor/key-value-editor';

interface Props {
  onChange: Function;
  parameters: any[];
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class FormEditor extends PureComponent<Props> {
  render() {
    const {
      parameters,
      onChange,
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
            descriptionPlaceholder="description"
            onChange={onChange}
            pairs={parameters}
          />
        </div>
      </div>
    );
  }
}
