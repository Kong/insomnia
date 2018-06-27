import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Link from '../base/link';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';

@autobind
class FilterHelpModal extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isJson: true
    };
  }

  _setModalRef(n) {
    this.modal = n;
  }

  show(isJson) {
    this.setState({ isJson });
    this.modal.show();
  }

  hide() {
    this.modal.hide();
  }

  render() {
    const { isJson } = this.state;

    const link = isJson ? (
      <Link href="http://goessner.net/articles/JsonPath/">JSONPath</Link>
    ) : (
      <Link href="https://www.w3.org/TR/xpath/">XPath</Link>
    );

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Response Filtering Help</ModalHeader>
        <ModalBody className="pad">
          <p>
            Use {link} to filter the response body. Here are some examples that
            you might use on a book store API.
          </p>
          <table className="table--fancy pad-top-sm">
            <tbody>
              <tr>
                <td>
                  <code className="selectable">
                    {isJson ? '$.store.books[*].title' : '/store/books/title'}
                  </code>
                </td>
                <td>Get titles of all books in the store</td>
              </tr>
              <tr>
                <td>
                  <code className="selectable">
                    {isJson
                      ? '$.store.books[?(@.price < 10)].title'
                      : '/store/books[price < 10]'}
                  </code>
                </td>
                <td>Get books costing less than $10</td>
              </tr>
              <tr>
                <td>
                  <code className="selectable">
                    {isJson ? '$.store.books[-1:]' : '/store/books[last()]'}
                  </code>
                </td>
                <td>Get the last book in the store</td>
              </tr>
              <tr>
                <td>
                  <code className="selectable">
                    {isJson ? '$.store.books.length' : 'count(/store/books)'}
                  </code>
                </td>
                <td>Get the number of books in the store</td>
              </tr>
            </tbody>
          </table>
        </ModalBody>
      </Modal>
    );
  }
}

export default FilterHelpModal;
