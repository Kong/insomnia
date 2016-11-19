import React, {PropTypes} from 'react';
import {Dropdown, DropdownButton, DropdownItem, DropdownDivider} from '../base/dropdown';

const SettingsImportExport = ({
  handleImport,
  handleExportAll,
  handleExportWorkspace
}) => (
  <div className="pad">
    <h1>Data Import and Export</h1>
    <p>
      Import format will be automatically detected (<strong>Insomnia, Postman, HAR, cURL</strong>)
    </p>
    <Dropdown outline={true}>
      <DropdownButton className="btn btn--super-compact btn--outlined">
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
    <button className="btn btn--super-compact btn--outlined" onClick={e => handleImport()}>
      Import Data
    </button>
    <p className="italic faint pad-top">
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
