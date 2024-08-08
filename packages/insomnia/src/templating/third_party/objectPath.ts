/*
A copy of source code from objectpath npm package
https://github.com/mike-marcacci/objectpath
Solve the issue of infinite loop.
https://github.com/Kong/insomnia/issues/7286
objectPath.parse could enter endless loop if last char in key name is backslash.
*/

type Quote = '\'' | '\"';

const regex = {
    "'": /\\\'/g,
    '"': /\\\"/g,
};

const ObjectPath = {
    parse: function(str: string) {
        if (typeof str !== 'string') {
            throw new TypeError('ObjectPath.parse must be passed a string');
        }

        let i = 0;
        const parts = [];
        let dot, bracket, quote, closing;
        while (i < str.length) {
            dot = str.indexOf('.', i);
            bracket = str.indexOf('[', i);

            if (dot === -1 && bracket === -1) {
                // we've reached the end
                parts.push(str.slice(i, str.length));
                i = str.length;
            } else if (bracket === -1 || (dot !== -1 && dot < bracket)) {
                // dots
                parts.push(str.slice(i, dot));
                i = dot + 1;
            } else {
                // brackets
                if (bracket > i) {
                    parts.push(str.slice(i, bracket));
                    i = bracket;
                }
                quote = str.slice(bracket + 1, bracket + 2);

                if (quote !== '"' && quote !== "'") {
                    closing = str.indexOf(']', bracket);
                    if (closing === -1) {
                        closing = str.length;
                    }
                    parts.push(str.slice(i + 1, closing));
                    i = (str.slice(closing + 1, closing + 2) === '.') ? closing + 2 : closing + 1;
                } else {
                    closing = str.indexOf(quote + ']', bracket);
                    if (closing === -1) {
                        closing = str.length;
                    }

                    /*
                    When there is an even number of backslashes before a single quote,
                    the single quote is not actually escaped.
                    The original implementation of the library did not account for this situation,
                    causing the program to enter an infinite loop when the key ends with a backslash.
                    */
                    while (
                        closing !== -1 &&
                        (function countBackslashesBeforeClosing() {
                            let backslash = 0;
                            while (str.slice(closing - 1 - backslash, closing - backslash) === '\\') {
                                backslash++;
                            }
                            return backslash;
                        })() % 2 === 1 &&
                        bracket < str.length
                    ) {
                        bracket++;
                        closing = str.indexOf(quote + ']', bracket);
                    }
                    if (closing === -1) {
                        closing = str.length;
                    }

                    parts.push(str.slice(i + 2, closing).replace(regex[quote], quote).replace(/\\+/g, function(backslash) {
                        return new Array(Math.ceil(backslash.length / 2) + 1).join('\\');
                    }));
                    i = (str.slice(closing + 2, closing + 3) === '.') ? closing + 3 : closing + 2;
                }
            }
        }
        return parts;
    },

    // root === true : auto calculate root; must be dot-notation friendly
    // root String : the string to use as root
    stringify: function(arr: (string | number)[], quote?: Quote, forceQuote?: boolean) {
        if (!Array.isArray(arr)) {
            arr = [arr];
        }

        quote = (quote === '"') ? '"' : "'";
        const regexp = new RegExp('(\\\\|' + quote + ')', 'g'); // regex => /(\\|')/g

        return arr.map(function(value: string | number, key: number) {
            let property = value.toString();
            if (!forceQuote && /^[A-z_]\w*$/.exec(property)) { // str with only A-z0-9_ chars will display `foo.bar`
                return (key !== 0) ? '.' + property : property;
            } else if (!forceQuote && /^\d+$/.exec(property)) { // str with only numbers will display `foo[0]`
                return '[' + property + ']';
            } else {
                property = property.replace(regexp, '\\$1');
                return '[' + quote + property + quote + ']';
            }
        }).join('');
    },

    normalize: function(data: string, quote?: Quote, forceQuote?: boolean) {
        return ObjectPath.stringify(Array.isArray(data) ? data : ObjectPath.parse(data), quote, forceQuote);
    },
};

export default ObjectPath;
