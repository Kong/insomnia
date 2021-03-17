import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import Link from '../base/link';
import { showPrompt } from '../modals/index';
import { docsImportExport } from '../../../common/documentation';
import { strings, stringsPlural } from '../../../common/strings';

@autoBindMethodsForReact(AUTOBIND_CFG)
class ImportExport extends PureComponent {
  _handleImportUri() {
    const promptOptions = {
      title: 'Import Data from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      placeholder: 'https://website.com/insomnia-import.json',
      onComplete: uri => {
        window.localStorage.setItem('insomnia.lastUsedImportUri', uri);
        this.props.handleImportUri(uri);
      },
    };

    const lastUsedImportUri = window.localStorage.getItem('insomnia.lastUsedImportUri');

    if (lastUsedImportUri) {
      promptOptions.defaultValue = lastUsedImportUri;
    }

    showPrompt(promptOptions);
  }

  render() {
    const {
      handleImportFile,
      handleImportClipBoard,
      handleExportAll,
      handleShowExportRequestsModal,
    } = this.props;

    return (
      <div>
        <p className="no-margin-top">
          Import format will be automatically detected (
          <strong>Insomnia, Postman v2, HAR, Curl, Swagger, OpenAPI v3</strong>)
        </p>
        <p>
          Don't see your format here? <Link href={docsImportExport}>Add Your Own</Link>.
        </p>
        <div className="pad-top">
          <Dropdown outline>
            <DropdownButton className="btn btn--clicky">
              Export Data <i className="fa fa-caret-down" />
            </DropdownButton>
            <DropdownDivider>Choose Export Type</DropdownDivider>
            <DropdownItem onClick={handleShowExportRequestsModal}>
              <i className="fa fa-home" />
              Current {strings.document} / {strings.collection}
            </DropdownItem>
            <DropdownItem onClick={handleExportAll}>
              <i className="fa fa-empty" />
              All {stringsPlural.document} / {stringsPlural.collection}
            </DropdownItem>
          </Dropdown>
          &nbsp;&nbsp;
          <Dropdown outline>
            <DropdownButton className="btn btn--clicky">
              Import Data <i className="fa fa-caret-down" />
            </DropdownButton>
            <DropdownDivider>Choose Import Type</DropdownDivider>
            <DropdownItem onClick={handleImportFile}>
              <i className="fa fa-file-o" />
              From File
            </DropdownItem>
            <DropdownItem onClick={this._handleImportUri}>
              <i className="fa fa-link" />
              From URL
            </DropdownItem>
            <DropdownItem onClick={handleImportClipBoard}>
              <i className="fa fa-clipboard" />
              From Clipboard
            </DropdownItem>
          </Dropdown>
          &nbsp;&nbsp;
          <Link href="https://insomnia.rest/create-run-button" className="btn btn--compact" button>
            Create Run Button
          </Link>
        </div>
        <p className="italic faint">* Tip: You can also paste Curl commands into the URL bar</p>
      </div>
    );
  }
}

ImportExport.propTypes = {
  handleImportFile: PropTypes.func.isRequired,
  handleImportClipBoard: PropTypes.func.isRequired,
  handleImportUri: PropTypes.func.isRequired,
  handleExportAll: PropTypes.func.isRequired,
  handleShowExportRequestsModal: PropTypes.func.isRequired,
};

export default ImportExport;
