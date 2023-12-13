// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parser } = require('nunjucks');

export interface Node {
  readonly typename: string;
  readonly fields: string[];
  colno: number;
  lineno: number;
  [fieldName: string]: any;
}

export function inspect(data: any) {
  const returnData: any = {
    fields: Array.from(data.fields || []),
    typename: data.typename,
    colno: data.colno,
    lineno: data.lineno,
  };
  if (data.children) {
    returnData.children = Array.from(data.children).map(inspect);
  }
  returnData.fields.forEach((f: string) => {
    if (data[f]) {
      if (typeof data[f] === 'object') {
        if (data[f] instanceof Array) {
          returnData[f] = data[f].map(inspect);
          return;
        } else if (data[f].typename || data[f].constructor?.name === 'subclass') {
          returnData[f] = inspect(data[f]);
          return;
        }
      }
      returnData[f] = data[f];
    } else {
      console.warn(data, f);
    }
  });
  return returnData;
}

function processValue(valueNode: Node): ParsedVariable | ArgumentValue | null {
  if (valueNode.typename === 'Literal') {
    return {
      dataType: 'primitive',
      value: valueNode.value,
    };
  } else if (valueNode.typename === 'Symbol') {
    return {
      dataType: 'variable',
      value: valueNode.value,
    };
  } else if (valueNode.typename === 'LookupVal') {
    let variableName = '';
    let currentVal: Node | null = valueNode;
    while (currentVal) {
      if (currentVal.typename === 'LookupVal') {
        if (variableName) {
          variableName = currentVal.val.value + '.' + variableName;
        } else {
          variableName = currentVal.val.value;
        }
        currentVal = currentVal.target;
      } else {
        variableName = currentVal.value + '.' + variableName;
        currentVal = null;
      }
    }
    return {
      dataType: 'variable',
      value: variableName,
    };
  }
  return null;
}

function processFilter(node: Node): [ParsedFilter | null, Node | null] {
  if (node.name && node.args?.children?.length) {
    const nextNode = node.args.children[0];
    const args = node.args.children
      .slice(1)
      .map(processValue);
    const typeData: ParsedFilter = {
      dataType: 'filter',
      name: node.name.value,
      args,
    };
    if (!typeData.args.find(a => !a)) {
      return [typeData, nextNode];
    }
  }
  return [null, null];
}

export const parseRaw = function(stringValue: string) {
  return parser.parse(stringValue);
};

export interface ParsedVariableFilter {
  dataType: 'variable' | 'filter';
  value?: string | number | boolean | undefined;
  name?: string;
  args?: ArgumentValue[];
}

export interface ParsedFilter extends ParsedVariableFilter {
  dataType: 'filter';
  name: string;
  args: ArgumentValue[];
}

interface ParsedVariable extends ParsedVariableFilter {
  dataType: 'variable';
  value: string | number | boolean | undefined;
}

export interface ArgumentValue {
  dataType: 'variable' | 'primitive';
  value: string | number | boolean | undefined;
}

export const parseVariableAndFilter = function(stringValue: string): ParsedVariableFilter[] | null {
  const rootData: Node = parseRaw(stringValue);
  const flatData: ParsedVariableFilter[] = [];
  if (rootData.typename === 'Root' && rootData.children?.length === 1) {
    let currentNode: Node | null = rootData.children[0];
    if (currentNode && currentNode.typename === 'Output') {
      if (currentNode.children?.length === 1) {
        currentNode = currentNode.children[0];
      } else {
        currentNode = null;
      }
    }
    while (currentNode) {
      switch (currentNode.typename) {
        case 'Filter':
          const [filterData, nextNode] = processFilter(currentNode);
          if (filterData) {
            flatData.push(filterData);
          }
          currentNode = nextNode;
          break;
        case 'LookupVal':
        case 'Symbol':
        case 'Literal':
          const valueData = processValue(currentNode);
          if (valueData) {
            flatData.push(valueData as ParsedVariable);
          }
          currentNode = null;
          break;
        default:
          return null;
      }
    }
    flatData.reverse();
    if (flatData.length &&
      flatData[0].dataType === 'variable' &&
      !flatData.find(d => !d)
    ) {
      return flatData;
    }
  }
  return null;
};

export const stringifyVariableAndFilter = function(data: ParsedVariableFilter[], excludeExpression: boolean | undefined = false) {
  let output: any = '';
  for (const item of data) {
    switch (item.dataType) {
      case 'variable':
        output = item.value;
        break;
      case 'filter':
        const isHasArgValue = item.args?.filter(a => a.value)?.length;
        const args = item.args?.map(a => {
          if (a.dataType === 'variable') {
            return a.value;
          } else {
            return JSON.stringify(a.value).replace(/"/ig, '\'');
          }
        }).join(', ');
        if (args?.length && isHasArgValue) {
          output += ` | ${item.name}(${args})`;
        } else {
          output += ` | ${item.name}`;
        }
        break;
      default:
        return '';
    }
  }
  return excludeExpression ? output : `{{ ${output} }}`;
};
