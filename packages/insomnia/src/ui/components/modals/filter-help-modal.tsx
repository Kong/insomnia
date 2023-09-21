import React, { FC, forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { Link } from '../base/link';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';

interface HelpExample {
  code: string;
  description: string;
}

const HelpExamples: FC<{ helpExamples: HelpExample[] }> = ({ helpExamples }) => (
  <table className="table--fancy pad-top-sm">
    <tbody>
      {helpExamples.map(({ code, description }) => (
        <tr key={code}>
          <td><code className="selectable">{code}</code></td>
          {description}
        </tr>
      ))}
    </tbody>
  </table>
);

const JqHelper: FC = () => (
  <ModalBody className="pad">
    <p>
      Use <Link href="https://github.com/jqlang/jq/wiki/For-JSONPath-users">Jq</Link> to filter the response body. Here are some examples that you might use on a book store API:
    </p>
    <br />
    <HelpExamples
      helpExamples={[
        { code: '.store.book[].title', description: 'Get titles of all books in the store' },
        { code: '.store.book[] | select(.price < 10)', description: 'Get books costing less than $10' },
        { code: '..|objects.book[-1]', description: 'Get the last book in the store' },
        { code: '.store.book[] | select(.isbn)', description: 'Get all books in the store with an isbn number' },
      ]}
    />
    <br />
    <p>
      Use <Link href="http://goessner.net/articles/JsonPath/">JSONPath</Link> to filter the response body. Here are some examples that you might use on a book store API:
    </p>
    <br />
    <HelpExamples
      helpExamples={[
        { code: '$.store.books[*].title', description: 'Get titles of all books in the store' },
        { code: '$.store.books[?(@.price < 10)].title', description: 'Get books costing less than $10' },
        { code: '$.store.books[-1:]', description: 'Get the last book in the store' },
        { code: '$.store.books.length', description: 'Get the number of books in the store' },
        { code: '$.store.books[?(@.title.match(/lord.*rings/i))]', description: 'Get book by title regular expression' },
      ]}
    />
    <p className="notice info">
      Insomnia supports both <Link href="https://www.npmjs.com/package/node-jq">jq</Link> and <Link href="https://www.npmjs.com/package/jsonpath-plus">JSONPath</Link>.
      Note that there's <Link href="https://cburgmer.github.io/json-path-comparison/">no standard</Link> for JSONPath.
    </p>
  </ModalBody>
);

const XPathHelp: FC = () => (
  <ModalBody className="pad">
    <p>
      Use <Link href="https://www.w3.org/TR/xpath/">XPath</Link> to filter the response body. Here are some examples that you might use on a
      book store API:
    </p>
    <HelpExamples
      helpExamples={[
        { code: '/store/books/title', description: 'Get titles of all books in the store' },
        { code: '/store/books[price < 10]', description: 'Get books costing less than $10' },
        { code: '/store/books[last()]', description: 'Get the last book in the store' },
        { code: 'count(/store/books)', description: 'Get the number of books in the store' },
      ]}
    />
  </ModalBody>
);
interface FilterHelpModalOptions {
  isJSON: boolean;
}
export interface FilterHelpModalHandle {
  show: (options: FilterHelpModalOptions) => void;
  hide: () => void;
}

export const FilterHelpModal = forwardRef<FilterHelpModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<FilterHelpModalOptions>({
    isJSON: true,
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      const { isJSON } = options;
      setState({ isJSON });
      modalRef.current?.show();
    },
  }), []);
  const { isJSON } = state;
  const isXPath = !isJSON;
  return (
    <Modal ref={modalRef}>
      <ModalHeader>Response Filtering Help</ModalHeader>
      {isJSON ? <JqHelper /> : null}
      {isXPath ? <XPathHelp /> : null}
    </Modal>
  );
});
FilterHelpModal.displayName = 'FilterHelpModal';
