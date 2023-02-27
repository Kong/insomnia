import styled from 'styled-components';

export const QueryEditorContainer = styled.div({
  display: 'grid',
  height: '100%',
  gridTemplateRows: 'auto minmax(0,1fr)',
  gridTemplateColumns: '100%',
});

export const QueryEditorPreview = styled.div({
  maxHeight: '14rem',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',

  'code': {
    overflow: 'auto',
    minHeight: '2em',
  },
});

export const QueryEditor = styled.div({
  minHeight: '2rem',
  maxHeight: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',

  '.key-value-editor': {
    padding: '0',
  },
});
