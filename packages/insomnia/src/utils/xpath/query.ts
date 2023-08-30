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
  // Functions return plain strings
  if (typeof selectedValues === 'string') {
    return [{ outer: selectedValues, inner: selectedValues }];
  }

  return (selectedValues as Node[])
    .filter(sv => sv.nodeType === Node.ATTRIBUTE_NODE
      || sv.nodeType === Node.ELEMENT_NODE
      || sv.nodeType === Node.TEXT_NODE)
    .map(selectedValue => {
      const outer = selectedValue.toString().trim();
      if (selectedValue.nodeType === Node.ATTRIBUTE_NODE) {
        return { outer, inner: selectedValue.nodeValue };
      }
      if (selectedValue.nodeType === Node.ELEMENT_NODE) {
        return { outer, inner: selectedValue.childNodes.toString() };
      }
      if (selectedValue.nodeType === Node.TEXT_NODE) {
        return { outer, inner: selectedValue.toString().trim() };
      }
      return { outer, inner: null };
    });

};
