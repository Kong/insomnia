// @flow

import * as React from 'react';
import type { WrapperProps } from './wrapper';
import { ToggleSwitch } from 'insomnia-components';
import type { MigrationOptions } from '../../common/migrate-from-designer';
import migrateFromDesigner, { restartApp } from '../../common/migrate-from-designer';
import { getDataDirectory, getDesignerDataDir } from '../../common/misc';
import { useDispatch } from 'react-redux';
import OnboardingContainer from './onboarding-container';
import { goToNextActivity } from '../redux/modules/global';

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
const BooleanSetting = ({ handleChange, label, name, options, hint }: BooleanSettingProps) => {
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
    copyWorkspaces: false,
    copyPlugins: false,
    designerDataDir: getDesignerDataDir(),
    coreDataDir: getDataDirectory(),
  }));

  const handleInputChange = React.useCallback((e: SyntheticEvent<HTMLInputElement>) => {
    setOptions(prevOpts => ({ ...prevOpts, [e.currentTarget.name]: e.currentTarget.value }));
  }, []);

  const handleSwitchChange = React.useCallback((checked: boolean, event: Object, id: string) => {
    setOptions(prevOpts => ({ ...prevOpts, [id]: checked }));
  }, []);

  const canStart = options.useDesignerSettings || options.copyWorkspaces || options.copyPlugins;

  return (
    <>
      <p>
        <strong>Migrate from Insomnia Designer</strong>
      </p>
      <p>
        Insomnia Designer and Core are now Insomnia! Select the items below you'd like to migrate
        from Designer.
      </p>
      <div className="text-left margin-top">
        <BooleanSetting
          label="Copy Designer Application Settings"
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
          label="Copy Workspaces"
          name="copyWorkspaces"
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
            label="Insomnia Data Directory"
            name="coreDataDir"
            options={options}
            handleChange={handleInputChange}
          />
        </details>
      </div>

      <div className="margin-top">
        <button
          key="start"
          className="btn btn--clicky"
          onClick={() => start(options)}
          disabled={!canStart}>
          Start Migration
        </button>
        <button key="cancel" className="btn btn--super-compact" onClick={cancel}>
          Skip for now
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

const RestartButton = () => (
  <button key="restart" className="btn btn--clicky" onClick={restartApp}>
    Restart Now
  </button>
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
      <RestartButton />
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
      <RestartButton />
    </div>
  </>
);

const MigrationBody = () => {
  // The migration step does not need to be in redux, but a loading state does need to exist there.
  const [step, setStep] = React.useState<Step>('options');
  const [error, setError] = React.useState<Error>(null);

  const start = React.useCallback(async (options: MigrationOptions) => {
    setStep('migrating');
    const { error } = await migrateFromDesigner(options);
    if (error) {
      setError(error);
    }
    setStep('results');
  }, []);

  const reduxDispatch = useDispatch();
  const cancel = React.useCallback(() => {
    reduxDispatch(goToNextActivity());
  }, [reduxDispatch]);

  switch (step) {
    case 'options':
      return <Options start={start} cancel={cancel} />;
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
|};

const WrapperMigration = ({ wrapperProps }: Props) => (
  <OnboardingContainer wrapperProps={wrapperProps}>
    <MigrationBody />
  </OnboardingContainer>
);

export default WrapperMigration;
