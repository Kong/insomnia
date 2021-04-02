// @flow

import * as React from 'react';
import type { WrapperProps } from './wrapper';
import { ToggleSwitch, Button } from 'insomnia-components';
import type { MigrationOptions } from '../../common/migrate-from-designer';
import migrateFromDesigner, {
  existsAndIsDirectory,
  restartApp,
} from '../../common/migrate-from-designer';
import { getDataDirectory, getDesignerDataDir } from '../../common/misc';
import { useDispatch } from 'react-redux';
import OnboardingContainer from './onboarding-container';
import { goToNextActivity } from '../redux/modules/global';
import HelpTooltip from './help-tooltip';
import { trackEvent } from '../../common/analytics';

type Step = 'options' | 'migrating' | 'results';

type SettingProps = {
  label: string,
  name: $Keys<MigrationOptions>,
  options: MigrationOptions,
};

type TextSettingProps = SettingProps & {
  handleChange: (SyntheticEvent<HTMLInputElement>) => void,
  errorMessage?: string,
};
const TextSetting = ({ handleChange, label, name, options, errorMessage }: TextSettingProps) => {
  if (!options.hasOwnProperty(name)) {
    throw new Error(`Invalid text setting name ${name}`);
  }

  const hasError = !!errorMessage;

  return (
    <div className="form-control form-control--outlined margin-bottom">
      <label>
        {label}
        <input
          className={hasError && 'input--error'}
          type="text"
          name={name}
          defaultValue={options[name]}
          onBlur={handleChange}
        />
        {hasError && <div className="font-error space-top">{errorMessage}</div>}
      </label>
    </div>
  );
};

type BooleanSettingProps = SettingProps & {
  handleChange: (boolean, Object, string) => void,
  help?: string,
};
const BooleanSetting = ({ handleChange, label, name, options, help }: BooleanSettingProps) => {
  if (!options.hasOwnProperty(name)) {
    throw new Error(`Invalid text setting name ${name}`);
  }

  const labelNode = React.useMemo(
    () => (
      <>
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
      </>
    ),
    [help, label],
  );

  return (
    <ToggleSwitch
      labelClassName="row margin-bottom wide"
      checked={options[name]}
      id={name}
      label={labelNode}
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
    const { name, value } = e.currentTarget;
    setOptions(prevOpts => ({ ...prevOpts, [name]: value }));
  }, []);

  const handleSwitchChange = React.useCallback((checked: boolean, event: Object, id: string) => {
    setOptions(prevOpts => ({ ...prevOpts, [id]: checked }));
  }, []);

  const {
    coreDataDir,
    designerDataDir,
    useDesignerSettings,
    copyWorkspaces,
    copyPlugins,
  } = options;

  const coreExists = React.useMemo(() => existsAndIsDirectory(coreDataDir), [coreDataDir]);

  const designerExists = React.useMemo(() => existsAndIsDirectory(designerDataDir), [
    designerDataDir,
  ]);

  const hasSomethingToMigrate = useDesignerSettings || copyWorkspaces || copyPlugins;
  const dirsExist = coreExists && designerExists;
  const canStart = hasSomethingToMigrate && dirsExist;

  return (
    <>
      <p>
        From the list below, select the individual items you would like to migrate from Designer.
      </p>
      <div className="text-left">
        <BooleanSetting
          label="Copy Workspaces"
          name="copyWorkspaces"
          options={options}
          handleChange={handleSwitchChange}
          help={
            'This includes all resources linked to a workspace (eg. requests, proto files, api specs, environments, etc)'
          }
        />
        <BooleanSetting
          label="Copy Plugins"
          name="copyPlugins"
          options={options}
          handleChange={handleSwitchChange}
          help={
            'Merge plugins between Designer and Insomnia, keeping the Designer version where a duplicate exists'
          }
        />
        <BooleanSetting
          label="Copy Designer Application Settings"
          name="useDesignerSettings"
          options={options}
          handleChange={handleSwitchChange}
          help={'Keep user preferences from Designer'}
        />
        <details>
          <summary className="margin-bottom">Advanced options</summary>
          <TextSetting
            label="Designer Data Directory"
            name="designerDataDir"
            options={options}
            handleChange={handleInputChange}
            errorMessage={!designerExists && 'Directory does not exist'}
          />
          <TextSetting
            label="Insomnia Data Directory"
            name="coreDataDir"
            options={options}
            handleChange={handleInputChange}
            errorMessage={!coreExists && 'Directory does not exist'}
          />
        </details>
      </div>

      <div className="margin-top">
        <Button
          key="start"
          bg="surprise"
          radius="3px"
          size="medium"
          variant="contained"
          onClick={() => start(options)}
          disabled={!canStart}>
          Start Migration
        </Button>
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
    trackEvent('Data', 'Migration', 'Skip');
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
  <OnboardingContainer
    wrapperProps={wrapperProps}
    header="Migrate from Insomnia Designer"
    subHeader="Insomnia Designer and Core are now Insomnia!">
    <MigrationBody />
  </OnboardingContainer>
);

export default WrapperMigration;
