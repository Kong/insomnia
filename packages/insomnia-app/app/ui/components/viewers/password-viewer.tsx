import React, { FC, useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { selectSettings } from '../../redux/selectors';

const EyeIcon = styled.i({
  cursor: 'pointer',
  paddingRight: 'var(--padding-xs)',
});

export const PasswordViewer: FC<{
  onShow?: () => void;
  initiallyHidden?: boolean;
  text: string | null;
}> = ({
  onShow,
  initiallyHidden,
  text,
}) => {
  const { showPasswords } = useSelector(selectSettings);
  const [textVisible, setTextVisible] = useState(Boolean(showPasswords ?? initiallyHidden));
  const toggleVisible = useCallback(() => {
    onShow?.();
    setTextVisible(!textVisible);
  }, [textVisible, onShow]);

  return (
    <span className="monospace">
      <EyeIcon
        className={`fa ${textVisible ? 'fa-eye' : 'fa-eye-slash'}`}
        onClick={toggleVisible}
      />
      {textVisible ? <span className="selectable">{text}</span> : null}
    </span>
  );
};
