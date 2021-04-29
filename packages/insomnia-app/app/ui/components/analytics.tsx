import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { Button } from 'insomnia-components';
import * as models from '../../models';
import { AUTOBIND_CFG, getAppLongName } from '../../common/constants';
import type { WrapperProps } from './wrapper';
import chartSrc from '../images/chart.svg';
type Props = {
  wrapperProps: WrapperProps;
  handleDone: (...args: Array<any>) => any;
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class Analytics extends React.PureComponent<Props, State> {
  async _handleAnalyticsSetting(enableAnalytics: boolean) {
    const { settings } = this.props.wrapperProps;
    // Update settings with analytics preferences
    await models.settings.update(settings, {
      enableAnalytics,
    });
    this.props.handleDone();
  }

  async _handleClickEnableAnalytics(e: React.SyntheticEvent<HTMLButtonElement>) {
    this._handleAnalyticsSetting(true);
  }

  async _handleClickDisableAnalytics(e: React.SyntheticEvent<HTMLButtonElement>) {
    this._handleAnalyticsSetting(false);
  }

  render() {
    return (
      <React.Fragment>
        <p>
          <strong>Share Usage Analytics with Kong Inc</strong>
        </p>
        <img src={chartSrc} alt="Demonstration chart" />
        <p>
          Help us understand how <strong>you</strong> use {getAppLongName()} so we can make it
          better.
        </p>
        <Button
          key="enable"
          bg="surprise"
          radius="3px"
          size="medium"
          variant="contained"
          onClick={this._handleClickEnableAnalytics}>
          Share Usage Analytics
        </Button>
        <button
          key="disable"
          className="btn btn--super-compact"
          onClick={this._handleClickDisableAnalytics}>
          Don't share usage analytics
        </button>
      </React.Fragment>
    );
  }
}

export default Analytics;
