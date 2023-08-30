import { DOMParser } from 'xmldom';
import xpath, { SelectedValue } from 'xpath';

/**
 * Query an XML blob with XPath
 */
export const queryXPath = (xml: string, query?: string) => {
  const dom = new DOMParser().parseFromString(xml);
  let selectedValues: SelectedValue[] = [];
  if (query === undefined) {
    throw new Error('Must pass an XPath query.');
  }
  try {
    selectedValues = xpath.select(query, dom);
  } catch (err) {
    throw new Error(`Invalid XPath query: ${query}`);
  }
  const output = [];
  // Functions return plain strings
  if (typeof selectedValues === 'string') {
    output.push({
      outer: selectedValues,
      inner: selectedValues,
    });
  } else {
    for (const selectedValue of selectedValues || []) {
      switch ((<Node>selectedValue).nodeType) {
        case Node.ATTRIBUTE_NODE:
          output.push({
            outer: (selectedValue as Attr).toString().trim(),
            inner: (selectedValue as Attr).nodeValue,
          });
          break;

        case Node.ELEMENT_NODE:
          output.push({
            outer: (selectedValue as Node).toString().trim(),
            inner: (selectedValue as Node).childNodes.toString(),
          });
          break;

        case Node.TEXT_NODE:
          output.push({
            outer: (selectedValue as Text).toString().trim(),
            inner: (selectedValue as Text).toString().trim(),
          });
          break;

        default:
          break;
      }
    }
  }
  return output;
};
