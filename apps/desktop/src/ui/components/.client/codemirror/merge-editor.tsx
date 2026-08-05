import './base-imports';

import classnames from 'classnames';
import CodeMirror from 'codemirror';
import type { MergeView } from 'codemirror/addon/merge/merge';
import { DiffMatchPatch, DiffOp } from 'diff-match-patch-ts';
import React, { useEffect, useRef } from 'react';

import { debounce } from '~/common/misc';
import { useIsLightTheme } from '~/ui/hooks/theme';

// these global variables are required by codemirror merge addon
window.diff_match_patch = DiffMatchPatch;
window.DIFF_DELETE = DiffOp.Delete;
window.DIFF_INSERT = DiffOp.Insert;
window.DIFF_EQUAL = DiffOp.Equal;

interface Props {
  leftContent: string;
  rightContent: string;
  centerContent: string;
  onChange: (value: string) => void;
}

export const MergeEditor = ({ leftContent, rightContent, centerContent, onChange }: Props) => {
  const divRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);

  const leftContentRef = useRef(leftContent);
  const rightContentRef = useRef(rightContent);
  const centerContentRef = useRef(centerContent);
  const onChangeRef = useRef<(value: string) => void>(onChange);

  useEffect(() => {
    leftContentRef.current = leftContent;
    rightContentRef.current = rightContent;
    centerContentRef.current = centerContent;
    onChangeRef.current = onChange;
  }, [leftContent, rightContent, centerContent, onChange]);

  const isLightTheme = useIsLightTheme();
  const isLightThemeRef = useRef(isLightTheme);

  useEffect(() => {
    const onChange = debounce((instance: CodeMirror.Editor) => {
      onChangeRef.current(instance.getDoc().getValue());
    }, 300);
    if (!divRef.current) {
      return;
    }
    const div = divRef.current;
    mergeViewRef.current = CodeMirror.MergeView(div, {
      value: centerContentRef.current,
      origLeft: leftContentRef.current,
      origRight: rightContentRef.current,
      lineNumbers: true,
      mode: 'yaml',
      theme: isLightThemeRef.current ? 'default' : 'base16-dark',
    });
    mergeViewRef.current.editor().on('changes', onChange);
    return () => {
      if (mergeViewRef.current) {
        mergeViewRef.current.editor().off('changes', onChange);
      }
      mergeViewRef.current = null;
      if (div) {
        div.innerHTML = '';
      }
    };
  }, []);

  useEffect(() => {
    if (mergeViewRef.current?.editor().getDoc().getValue() !== centerContent) {
      mergeViewRef.current?.editor().getDoc().setValue(centerContent);
    }
  }, [centerContent]);

  return (
    <div
      className={classnames('h-full', {
        'dark-merge-editor': !isLightTheme,
      })}
      ref={divRef}
    />
  );
};
