import { DOMParser } from 'xmldom';
import xpath from 'xpath';

/**
 * A revised type for the return value of `xpath.select(expression, node)`
 */
type SelectedValue = string | number | boolean | Node[];

/**
 * Query an XML blob with XPath
 */
export const queryXPath = (xml: string, query?: string) => {
  if (query === undefined) {
    throw new Error('Must pass an XPath query.');
  }
  const dom = new DOMParser().parseFromString(xml);
  let selectedValues: SelectedValue = [];
  try {
    selectedValues = xpath.select(query, dom) as SelectedValue;
  } catch (err) {
    throw new Error(`Invalid XPath query: ${query}`);
  }

  if (Array.isArray(selectedValues)) {
    return selectedValues
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
  }

  return [{ outer: selectedValues, inner: selectedValues }];
};
