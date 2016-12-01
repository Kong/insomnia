import React, {PropTypes} from 'react';
import {Dropdown, DropdownButton, DropdownItem, DropdownDivider} from '../base/dropdown';
import Link from '../base/Link';

const SettingsImportExport = ({
  handleImport,
  handleExportAll,
  handleExportWorkspace
}) => (
  <div>
    <h1 className="no-margin-top">Data Import and Export</h1>
    <p>
      Import format will be automatically detected (<strong>Insomnia, Postman v2, HAR, Curl</strong>)
    </p>
    <p>
      Don't see your format here?
      {" "}
      <Link href="https://insomnia.rest/documentation/import-export">Add Your Own</Link>.
    </p>
    <div className="pad-top">
      <Dropdown outline={true}>
        <DropdownButton className="btn btn--clicky">
          Export Data <i className="fa fa-caret-down"></i>
        </DropdownButton>
        <DropdownDivider name="Choose Export Type"/>
        <DropdownItem onClick={e => handleExportWorkspace()}>
          <i className="fa fa-home"></i>
          Current Workspace
        </DropdownItem>
        <DropdownItem onClick={e => handleExportAll()}>
          <i className="fa fa-empty"></i>
          All Workspaces
        </DropdownItem>
      </Dropdown>
      &nbsp;&nbsp;
      <button className="btn btn--clicky" onClick={e => handleImport()}>
        Import Data
      </button>
    </div>
    <p className="italic faint">
      * Tip: You can also paste Curl commands into the URL bar
    </p>
  </div>
);

SettingsImportExport.propTypes = {
  handleImport: PropTypes.func.isRequired,
  handleExportAll: PropTypes.func.isRequired,
  handleExportWorkspace: PropTypes.func.isRequired,
};

export default SettingsImportExport;
