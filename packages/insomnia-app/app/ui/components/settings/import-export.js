import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem
} from '../base/dropdown';
import Link from '../base/link';
import { showPrompt } from '../modals/index';

@autobind
class ImportExport extends PureComponent {
  _handleImportUri() {
    showPrompt({
      title: 'Import Data from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      placeholder: 'https://website.com/insomnia-import.json',
      onComplete: uri => {
        this.props.handleImportUri(uri);
      }
    });
  }

  render() {
    const {
      handleImportFile,
      handleExportAll,
      handleExportWorkspace
    } = this.props;

    return (
      <div>
        <p className="no-margin-top">
          Import format will be automatically detected (<strong>
            Insomnia, Postman v2, HAR, Curl, Swagger
          </strong>)
        </p>
        <p>
          Don't see your format here?{' '}
          <Link href="https://support.insomnia.rest/article/52-importing-and-exporting-data">
            Add Your Own
          </Link>.
        </p>
        <div className="pad-top">
          <Dropdown outline>
            <DropdownButton className="btn btn--clicky">
              Export Data <i className="fa fa-caret-down" />
            </DropdownButton>
            <DropdownDivider>Choose Export Type</DropdownDivider>
            <DropdownItem onClick={handleExportWorkspace}>
              <i className="fa fa-home" />
              Current Workspace
            </DropdownItem>
            <DropdownItem onClick={handleExportAll}>
              <i className="fa fa-empty" />
              All Workspaces
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
          </Dropdown>
        </div>
        <p className="italic faint">
          * Tip: You can also paste Curl commands into the URL bar
        </p>
      </div>
    );
  }
}

ImportExport.propTypes = {
  handleImportFile: PropTypes.func.isRequired,
  handleImportUri: PropTypes.func.isRequired,
  handleExportAll: PropTypes.func.isRequired,
  handleExportWorkspace: PropTypes.func.isRequired
};

export default ImportExport;
