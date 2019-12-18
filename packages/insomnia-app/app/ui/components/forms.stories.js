import React from 'react';
import '../../../.storybook/index.less';
import IndeterminateCheckbox from './base/indeterminate-checkbox';

export default { title: 'Forms' };

export const input = () => (
  <form>
    <div className="form-control form-control--outlined">
      <input type="text" placeholder="text input" />
    </div>
  </form>
);

export const inputWithLabel = () => (
  <form>
    <div className="form-control form-control--outlined">
      <label>
        Text Input
        <input type="text" placeholder="text input" />
      </label>
    </div>
  </form>
);

export const selectWithLabel = () => (
  <form>
    <div className="form-control form-control--outlined">
      <label>
        Select One
        <select>
          <option>Option 1</option>
          <option>Option 2</option>
        </select>
      </label>
    </div>
  </form>
);

export const checkboxWithLabel = () => (
  <form>
    <div className="form-control form-control--thin">
      <label className="inline-block">
        Check Me
        <input type="checkbox" />
      </label>
    </div>
    <div className="form-control form-control--thin">
      <label className="inline-block">
        Check Me Too!
        <input type="checkbox" />
      </label>
    </div>
  </form>
);

export const intermediaryCheckbox = () => (
  <form>
    <div className="form-control form-control--thin">
      <label className="inline-block">
        Check me, maybe
        <IndeterminateCheckbox indeterminate={true} checked={false} />
      </label>
    </div>
  </form>
);

export const exampleForm = () => (
  <form className="storybook-skinny">
    <div className="form-row">
      <div className="form-control form-control--outlined">
        <label>
          First Name
          <input type="text" required placeholder="Jane" />
        </label>
      </div>
      <div className="form-control form-control--outlined">
        <label>
          Last Name
          <input type="text" placeholder="Strong" />
        </label>
      </div>
    </div>

    <div className="form-control form-control--outlined">
      <label>
        Email
        <input type="email" placeholder="text input" required />
      </label>
    </div>

    <div className="form-control form-control--outlined">
      <label>
        Favorite Color
        <select>
          <option>Blue</option>
          <option>Pink</option>
          <option>Yellow</option>
        </select>
      </label>
    </div>

    <div className="form-control form-control--thin">
      <label className="inline-block">
        Check me
        <input type="checkbox" />
      </label>
    </div>

    <div className="form-control form-control--thin">
      <label className="inline-block">
        Check me too, maybe
        <IndeterminateCheckbox indeterminate={true} checked={false} />
      </label>
    </div>

    <div className="form-control margin-top">
      <button type="submit" className="btn btn--clicky">
        Submit
      </button>
    </div>
  </form>
);
