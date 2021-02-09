// @flow

import * as React from 'react';
import type { WrapperProps } from './wrapper';
import { ACTIVITY_HOME } from '../../common/constants';
import { ToggleSwitch } from 'insomnia-components';
import type { MigrationOptions } from '../../common/migrate-from-designer';
import migrateFromDesigner, { restartApp } from '../../common/migrate-from-designer';
import { getDataDirectory, getDesignerDataDir } from '../../common/misc';
import { bindActionCreators } from 'redux';
import * as globalActions from '../redux/modules/global';
import { connect } from 'react-redux';
import OnboardingContainer from './onboarding-container';

type Step = 'options' | 'migrating' | 'results';

type SettingProps = {
  label: string,
  name: $Keys<MigrationOptions>,
  options: MigrationOptions,
};
type TextSettingProps = SettingProps & {
  handleChange: (SyntheticEvent<HTMLInputElement>) => void,
};
const TextSetting = ({ handleChange, label, name, options }: TextSettingProps) => {
  if (!options.hasOwnProperty(name)) {
    throw new Error(`Invalid text setting name ${name}`);
  }

  return (
    <div className="form-control form-control--outlined margin-bottom">
      <label>
        {label}
        <input type="text" name={name} defaultValue={options[name]} onChange={handleChange} />
      </label>
    </div>
  );
};

type BooleanSettingProps = SettingProps & {
  handleChange: (boolean, Object, string) => void,
};
const BooleanSetting = ({ handleChange, label, name, options }: BooleanSettingProps) => {
  if (!options.hasOwnProperty(name)) {
    throw new Error(`Invalid text setting name ${name}`);
  }

  return (
    <ToggleSwitch
      labelClassName="row margin-bottom wide"
      checked={options[name]}
      id={name}
      label={label}
      onChange={handleChange}
    />
  );
};

type OptionsProps = { start: MigrationOptions => void, cancel: () => void };
const Options = ({ start, cancel }: OptionsProps) => {
  const [options, setOptions] = React.useState<MigrationOptions>(() => ({
    useDesignerSettings: false,
    copyResponses: true,
    copyPlugins: true,
    designerDataDir: getDesignerDataDir(),
    coreDataDir: getDataDirectory(),
  }));

  const handleInputChange = React.useCallback((e: SyntheticEvent<HTMLInputElement>) => {
    setOptions(prevOpts => ({ ...prevOpts, [e.currentTarget.name]: e.currentTarget.value }));
  }, []);

  const handleSwitchChange = React.useCallback((checked: boolean, event: Object, id: string) => {
    setOptions(prevOpts => ({ ...prevOpts, [id]: checked }));
  }, []);

  return (
    <>
      <p>
        <strong>Would you like to migrate data from Insomnia Designer?</strong>
      </p>
      <div className="text-left margin-top">
        <BooleanSetting
          label="Use Designer Settings"
          name="useDesignerSettings"
          options={options}
          handleChange={handleSwitchChange}
        />
        <BooleanSetting
          label="Copy Plugins"
          name="copyPlugins"
          options={options}
          handleChange={handleSwitchChange}
        />
        <BooleanSetting
          label="Copy Responses"
          name="copyResponses"
          options={options}
          handleChange={handleSwitchChange}
        />
        <details>
          <summary className="margin-bottom">Advanced options</summary>
          <TextSetting
            label="Designer Data Directory"
            name="designerDataDir"
            options={options}
            handleChange={handleInputChange}
          />
          <TextSetting
            label="Core Data Directory"
            name="coreDataDir"
            options={options}
            handleChange={handleInputChange}
          />
        </details>
      </div>

      <div className="margin-top">
        <button key="start" className="btn btn--clicky" onClick={() => start(options)}>
          Start Migration
        </button>
        <button key="cancel" className="btn btn--super-compact" onClick={cancel}>
          Cancel
        </button>
      </div>
    </>
  );
};

const Migrating = () => (
  <>
    <p>
      <strong>Migrating</strong>
    </p>
    <p>
      <i className="fa fa-spin fa-refresh" />
    </p>
  </>
);

const Success = () => (
  <>
    <p>
      <strong>Migrated successfully!</strong>
    </p>
    <p>
      <i className="fa fa-check" />
    </p>

    <p>Please restart the application for your changes to take effect.</p>

    <div className="margin-top">
      <button key="restart" className="btn btn--clicky" onClick={restartApp}>
        Restart
      </button>
    </div>
  </>
);

type FailProps = {
  error: Error,
};
const Fail = ({ error }: FailProps) => (
  <>
    <p>
      <strong>Something went wrong!!</strong>
    </p>
    <p>
      <i className="fa fa-exclamation" />
    </p>

    <div className="wide text-left">
      <p>
        Something went wrong with the migration and all changes made have been reverted. Please
        restart the application.
      </p>

      {error && (
        <details>
          <summary>Additonal information</summary>
          <pre className="pad-top-sm selectable">
            <code className="wide">{error.stack || error}</code>
          </pre>
        </details>
      )}
    </div>

    <div className="margin-top">
      <button key="restart" className="btn btn--clicky" onClick={restartApp}>
        Restart
      </button>
    </div>
  </>
);

type MigrationBodyProps = {
  handleSetActiveActivity: (activity?: GlobalActivity) => void,
};
const MigrationBody = ({ handleSetActiveActivity }: MigrationBodyProps) => {
  const [step, setStep] = React.useState<Step>('options');
  const [error, setError] = React.useState<Error>(null);

  const doMigration = React.useCallback(async (options: MigrationOptions) => {
    setStep('migrating');
    const { error } = await migrateFromDesigner(options);
    if (error) {
      setError(error);
    }
    setStep('results');
  }, []);

  const cancel = React.useCallback(() => {
    handleSetActiveActivity(ACTIVITY_HOME);
  }, [handleSetActiveActivity]);

  switch (step) {
    case 'options':
      return <Options start={doMigration} cancel={cancel} />;
    case 'migrating':
      return <Migrating />;
    case 'results':
      return error ? <Fail error={error} /> : <Success />;
    default:
      throw new Error(`${this.state.step} is not recognized as a migration step.`);
  }
};

type Props = {|
  wrapperProps: WrapperProps,
  handleSetActiveActivity: (activity?: GlobalActivity) => void,
|};

const WrapperMigration = ({ wrapperProps, handleSetActiveActivity }: Props) => (
  <OnboardingContainer wrapperProps={wrapperProps}>
    <MigrationBody handleSetActiveActivity={handleSetActiveActivity} />
  </OnboardingContainer>
);

function mapDispatchToProps(dispatch) {
  const global = bindActionCreators(globalActions, dispatch);
  return {
    handleSetActiveActivity: global.setActiveActivity,
  };
}

export default connect(null, mapDispatchToProps)(WrapperMigration);
