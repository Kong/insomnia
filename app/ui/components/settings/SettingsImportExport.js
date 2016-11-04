import React, {PropTypes} from 'react';

const SettingsImportExport = ({importFile, exportAll, exportWorkspace}) => (
  <div>
    <p>
      Be aware that you may be exporting <strong>private data</strong>.
      Also, any imported data may overwrite existing data.
    </p>
    <p>
      <button className="btn btn--super-compact btn--outlined"
              onClick={importFile}>
        Import
      </button>
      {" "}
      <button className="btn btn--super-compact btn--outlined"
              onClick={exportAll}>
        Export All Data
      </button>
      {" "}
      <button className="btn btn--super-compact btn--outlined"
              onClick={exportWorkspace}>
        Export Current Workspace
      </button>
    </p>
  </div>
);

SettingsImportExport.propTypes = {
  importFile: PropTypes.func.isRequired,
  exportAll: PropTypes.func.isRequired,
  exportWorkspace: PropTypes.func.isRequired,
};

export default SettingsImportExport;
