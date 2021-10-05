import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { Button } from 'insomnia-components';
import React, { Fragment, PureComponent } from 'react';

import { AUTOBIND_CFG, getAppLongName } from '../../common/constants';
import * as models from '../../models';
import chartSrc from '../images/chart.svg';
import type { WrapperProps } from './wrapper';

interface Props {
  wrapperProps: WrapperProps;
  handleDone: (...args: any[]) => any;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class Analytics extends PureComponent<Props> {
  async _handleAnalyticsSetting(enableAnalytics: boolean) {
    const { settings } = this.props.wrapperProps;
    // Update settings with analytics preferences
    await models.settings.update(settings, {
      enableAnalytics,
    });
    this.props.handleDone();
  }

  async _handleClickEnableAnalytics() {
    this._handleAnalyticsSetting(true);
  }

  async _handleClickDisableAnalytics() {
    this._handleAnalyticsSetting(false);
  }

  render() {
    return (
      <Fragment>
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
          onClick={this._handleClickEnableAnalytics}
        >
          Share Usage Analytics
        </Button>
        <button
          key="disable"
          className="btn btn--super-compact"
          onClick={this._handleClickDisableAnalytics}
        >
          Don't share usage analytics
        </button>
      </Fragment>
    );
  }
}
