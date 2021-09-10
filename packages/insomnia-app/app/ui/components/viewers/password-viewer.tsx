import React, { FC, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { selectSettings } from '../../redux/selectors';

const EyeIcon = styled.i({
  cursor: 'pointer',
  paddingRight: 'var(--padding-xs)',
});

const MASK_CHARACTER = '•';
/** randomly get anywhere between 4 and 11 mask characters on each invocation */
const getMask = () => MASK_CHARACTER.repeat(4 + (Math.random() * 7));

export const PasswordViewer: FC<{
  onShow?: () => void;
  initiallyHidden?: boolean;
  text: string | null;

  /**
   * If true, between 4 and 11 mask characters (e.g. '••••••••') will be shown in place of the password (immediately after the show/hide button).
   * If false, nothing is rendered after the show/hide button.
   *
   * @default true
   * @note the number is random to avoid exposing the length of the password.
   */
  maskText?: boolean;
}> = ({
  onShow,
  initiallyHidden = true,
  text,
  maskText = true,
}) => {
  const { showPasswords } = useSelector(selectSettings);
  const [mask, setMask] = useState<string | null>(null);
  useEffect(() => {
    if (maskText) {
      setMask(getMask());
    }
  }, [maskText]);

  const [textVisible, setTextVisible] = useState(showPasswords ?? initiallyHidden);
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
      {textVisible ? <span className="selectable">{text}</span> : mask}
    </span>
  );
};
