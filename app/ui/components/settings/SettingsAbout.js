import React from 'react';
import Link from '../base/Link';

const SettingsAbout = () => (
  <div className="pad">
    <h1>Hi, I'm Greg!</h1>
    <p>
      Insomnia started as a side-project of mine in 2014 and transitioned into what I do full-time
      in mid 2016.
    </p>
    <p>
      If you have any question or concerns, don't hesitate to reach out. And, if you want access to
      cloud sync or just feel like being awesome, you can sign up for
      {" "}
      <Link href="https://insomnia.rest/pricing/">Plus Plan</Link>
      {" "}
      <i className="fa fa-smile-o txt-xl"/>
    </p>
    <p>
      Thanks, and I hope you enjoy the app!
    </p>
    <p>
      ~ Gregory
    </p>
  </div>
);

SettingsAbout.propTypes = {};

export default SettingsAbout;
