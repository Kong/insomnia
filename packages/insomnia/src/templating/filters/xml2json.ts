import { PluginTemplateFilter } from '../extensions';

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable operator-linebreak */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable eqeqeq */
/* This work is licensed under Creative Commons GNU LGPL License.

    License: http://creativecommons.org/licenses/LGPL/2.1/
   Version: 0.9
    Author:  Stefan Goessner/2006
    Web:     http://goessner.net/
*/
function xml2json(xml: Document) {
  const X = {
    toObj: function(xml: any): Record<string, any> | string | any[] | null {
      let o: Record<string, any> | string | any[] | null = {};
      if (xml.nodeType == 1) {
        // element node ..
        if (xml.attributes.length) {
          // element with attributes  ..
          for (let i = 0; i < xml.attributes.length; i++) {
            const attributeName = (xml.attributes[i].nodeName || '').replace(':', '_');
            o['a_' + attributeName] = (xml.attributes[i].nodeValue || '').toString();
          }
        }
        if (xml.firstChild) { // element has child nodes ..
          let textChild = 0;
          let cdataChild = 0;
          let hasElementChild = false;
          for (let n = xml.firstChild; n; n = n.nextSibling) {
            if (n.nodeType == 1) {
              hasElementChild = true;
            } else if (n.nodeType == 3 && n.nodeValue.match(/[^ \f\n\r\t\v]/)) {
              textChild++; // non-whitespace text
            } else if (n.nodeType == 4) {
              cdataChild++; // cdata section node
            }
          }
          if (hasElementChild) {
            if (textChild < 2 && cdataChild < 2) { // structured element with evtl. a single text or/and cdata node ..
              X.removeWhite(xml);
              for (let n = xml.firstChild; n; n = n.nextSibling) {
                if (n.nodeType == 3) {
                  // text node
                  // eslint-disable-next-line camelcase
                  o.h_text = X.escape(n.nodeValue);
                } else if (n.nodeType == 4) {
                  // cdata node
                  // eslint-disable-next-line camelcase
                  o.h_cdata = X.escape(n.nodeValue);
                } else if (o[n.nodeName]) {
                  // multiple occurence of element ..
                  if (o[n.nodeName] instanceof Array) {
                    o[n.nodeName][o[n.nodeName].length] = X.toObj(n);
                  } else {
                    o[n.nodeName] = [o[n.nodeName], X.toObj(n)];
                  }
                } else {
                  // first occurence of element..
                  o[n.nodeName] = X.toObj(n);
                }
              }
            } else { // mixed content
              if (!xml.attributes.length) {
                o = X.escape(X.innerXml(xml));
              } else {
                o['#text'] = X.escape(X.innerXml(xml));
              }
            }
          } else if (textChild) { // pure text
            o['#text'] = X.escape(X.innerXml(xml));
          } else if (cdataChild) { // cdata
            if (cdataChild > 1) {
              o = X.escape(X.innerXml(xml));
            } else {
              for (let n = xml.firstChild; n; n = n.nextSibling) {
                o['#cdata'] = X.escape(n.nodeValue);
              }
            }
          }
        }
        if (!xml.attributes.length && !xml.firstChild) {
          o = null;
        }
      } else if (xml.nodeType == 9) { // document.node
        o = X.toObj(xml.documentElement);
      } else {
        alert('unhandled node type: ' + xml.nodeType);
      }
      return o;
    },
    innerXml: function(node: Document | HTMLElement) {
      let s = '';
      if ('innerHTML' in node) {
        s = node.innerHTML;
      } else {
        const asXml = function(n: any) {
          let s = '';
          if (n.nodeType == 1) {
            s += '<' + n.nodeName;
            for (let i = 0; i < n.attributes.length; i++) {
              s += ' ' + n.attributes[i].nodeName + '="' + (n.attributes[i].nodeValue || '').toString() + '"';
            }
            if (n.firstChild) {
              s += '>';
              for (let c = n.firstChild; c; c = c.nextSibling) {
                s += asXml(c);
              }
              s += '</' + n.nodeName + '>';
            } else {
              s += '/>';
            }
          } else if (n.nodeType == 3) {
            s += n.nodeValue;
          } else if (n.nodeType == 4) {
            s += '<![CDATA[' + n.nodeValue + ']]>';
          }
          return s;
        };
        for (let c = node.firstChild; c; c = c.nextSibling) {
          s += asXml(c);
        }
      }
      return s;
    },
    escape: function(txt: string) {
      return txt.replace(/[\\]/g, '\\\\')
        .replace(/["]/g, '\\"')
        .replace(/[\n]/g, '\\n')
        .replace(/[\r]/g, '\\r');
    },
    removeWhite: function(e: Document | HTMLElement | ChildNode) {
      e.normalize();
      for (let n = e.firstChild; n;) {
        if (n.nodeType == 3) {
          // text node
          if (n.nodeValue && !n.nodeValue.match(/[^ \f\n\r\t\v]/)) { // pure whitespace text node
            const nxt = n.nextSibling;
            e.removeChild(n);
            n = nxt;
          } else {
            n = n.nextSibling;
          }
        } else if (n.nodeType == 1) {
          // element node
          X.removeWhite(n);
          n = n.nextSibling;
        } else {
          // any other node
          n = n.nextSibling;
        }
      }
      return e;
    },
  };
  let doc: Document | HTMLElement = xml;
  if (xml.nodeType == 9) { // document node
    doc = xml.documentElement;
  }
  return X.toObj(X.removeWhite(doc));
}

function parseXml(xml: string): Document | null {
  let dom:any = null;
  if (window.DOMParser) {
    try {
      dom = (new DOMParser()).parseFromString(xml, 'text/xml');
    } catch (e) {
        dom = null;
    }
  } else {
    alert('cannot parse xml string!');
  }
  return dom;
}

const xml2JsonFilter : PluginTemplateFilter = {
  name: 'xml2json',
  displayName: 'XML to JSON',
  args: [],
  description: 'Parse xml to json object',
  run: function(_ctx: any, value: string) {
    let body;
    try {
      body = parseXml(value);
      if (body) {
        return xml2json(body);
      }
    } catch (err) {
      throw new Error(`Invalid XML: ${err.message}`);
    }
    return '';
  },
};

export default xml2JsonFilter;
