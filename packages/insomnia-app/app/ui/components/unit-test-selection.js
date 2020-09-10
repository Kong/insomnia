// @flow
import React from 'react';

type Props = {
  onChange: Function,
  unitTest: Object,
  selectableRequests: Object,
};

export default function UnitTestSelection({ onChange, unitTest, selectableRequests }: Props) {
  return (
    <div className="form-control form-control--outlined">
      <select
        name="request"
        id="request"
        onChange={onChange}
        value={unitTest.requestId || '__NULL__'}>
        <option value="__NULL__">
          {selectableRequests.length ? '-- Select Request --' : '-- No Requests --'}
        </option>
        {selectableRequests.map(({ name, request }) => (
          <option key={request._id} value={request._id}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
