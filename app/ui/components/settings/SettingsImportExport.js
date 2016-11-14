import React, {PropTypes} from 'react';

const SettingsImportExport = ({
  handleImport,
  handleExportAll,
  handleExportWorkspace
}) => (
  <div>
    <p>
      Be aware that you may be exporting <strong>private data</strong>.
      Also, any imported data may overwrite existing data.
    </p>
    <p>
      <button className="btn btn--super-compact btn--outlined" onClick={e => handleImport()}>
        Import
      </button>
      {" "}
      <button className="btn btn--super-compact btn--outlined" onClick={e => handleExportAll()}>
        Export All Data
      </button>
      {" "}
      <button className="btn btn--super-compact btn--outlined" onClick={e => handleExportWorkspace()}>
        Export Current Workspace
      </button>
    </p>
  </div>
);

SettingsImportExport.propTypes = {
  handleImport: PropTypes.func.isRequired,
  handleExportAll: PropTypes.func.isRequired,
  handleExportWorkspace: PropTypes.func.isRequired,
};

export default SettingsImportExport;
