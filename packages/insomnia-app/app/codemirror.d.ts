import 'codemirror';

import { GraphQLInfoOptions } from 'codemirror-graphql/info';
import { GraphQLJumpOptions, ModifiedGraphQLJumpOptions } from 'codemirror-graphql/jump';

import { HandleGetRenderContext, HandleRender } from './common/render';
import { NunjucksParsedTag } from './templating/utils';

type LinkClickCallback = (url: string) => void;

declare module 'codemirror-graphql/jump' {
  type ModifiedGraphQLJumpOptions = Omit<GraphQLJumpOptions, 'onClick'> & {
    onClick: GraphQLInfoOptions['onClick'];
  };
}

interface InsomniaExtensions {
  closeHintDropdown: () => void;
  enableNunjucksTags: (
    handleRender: HandleRender,
    handleGetRenderContext?: HandleGetRenderContext,
    isVariableUncovered?: boolean,
  ) => void;
  isHintDropdownActive: () => boolean;
  makeLinksClickable: (handleClick: LinkClickCallback) => void;
}

declare module 'codemirror' {
  type CodeMirrorLinkClickCallback = LinkClickCallback;

  /* eslint-disable @typescript-eslint/no-empty-interface */
  interface Editor extends InsomniaExtensions {}
  interface EditorFromTextEditor extends InsomniaExtensions {}
  interface TextMarker {
    // This flag is being used internally by codemirror and the fold extension
    __isFold: boolean;
  }

  interface Variable {
    name: string;
    value: any;
  }

  interface Snippet {
    name: string;
    displayValue: string;
    value: () => Promise<unknown>;
  }

  interface EnvironmentAutocompleteOptions {
    getConstants?: () => ShowHintOptions['constants'];
    getVariables?: () => Promise<ShowHintOptions['variables']>;
    getSnippets?: () => Promise<ShowHintOptions['snippets']>;
    getTags?: () => Promise<ShowHintOptions['tags']>;
  }

  interface EditorConfiguration {
    info?: GraphQLInfoOptions;
    jump?: ModifiedGraphQLJumpOptions;
    environmentAutocomplete?: EnvironmentAutocompleteOptions;
  }

  interface ShowHintOptions {
    constants: string[];
    variables: Variable[];
    snippets: Snippet[];
    tags: NunjucksParsedTag[];
    showAllOnNoMatch;
  }
  /* eslint-enable @typescript-eslint/no-empty-interface */
}
