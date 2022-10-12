import styled from 'styled-components';

import { ListGroupItem } from '../list-group';

export const ProtoListItem = styled(ListGroupItem).attrs(() => ({
  className: 'row-spaced',
}))`
  button i.fa {
    font-size: var(--font-size-lg);
  }

  height: var(--line-height-sm);
`;
