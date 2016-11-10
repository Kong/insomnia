import React from 'react';
import Link from '../base/Link';
import {getAppName} from '../../../common/constants';

const SettingsAbout = () => (
  <div>
    <h1>Hi there!</h1>
    <p>
      <Link href="http://insomnia.rest">
        {getAppName()}
      </Link> is made with love by me,
      {" "}
      <Link href="http://schier.co">Gregory Schier</Link>.
    </p>
    <p>
      You can help me out by sending your feedback to
      {" "}
      <Link href="mailto:support@insomnia.rest">
        support@insomnia.rest
      </Link>
      {" "}
      or tweet
      {" "}
      <Link href="https://twitter.com/GetInsomnia">@GetInsomnia</Link>.
    </p>
    <p>Thanks!</p>
    <br/>
    <p>~ Gregory</p>
  </div>
);

SettingsAbout.propTypes = {};

export default SettingsAbout;
