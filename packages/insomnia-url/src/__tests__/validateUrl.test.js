const { validateUrl,
  validateScheme,
  validateHostname,
  getValidUrlSchemes,
  getDomainNameRegExp,
  getIPv4RegExp,
  getIPv6RegExp } = require('./validateUrl')

test('check if the string is a valid url scheme string', () => {
  let urlSchemes = getValidUrlSchemes()
  for (let scheme of urlSchemes) {
    expect(validateScheme(`${scheme}:`)).toBe(true)
  }
})

test('check if the string is an invalid url scheme string', () => {
  let invalidUrlSchemes = ['example', 'insomnia', '1234', 'abcd', 'what?']
  for (let scheme of invalidUrlSchemes) {
    expect(validateScheme(`${scheme}:`)).toBe(false)
  }
})

test('check if the RegEx.test returns true for valid domain names', () => {
  let validDomainName = ['example.com', 'www.google.com', 'web.mit.edu', '9gag.com', 'www.geekskool.com', 'insomnia.rest']
  let domainNameRegExp = getDomainNameRegExp()
  for (let domainName of validDomainName) {
    expect(domainName).toMatch(domainNameRegExp)
  }
})

test('check if the RegEx.test returns false for invalid domain names', () => {
  let invalidDomainNames = ['example', '1234', 'awesome', 'd342dfr', 'www.',
  'example.c']
  let domainNameRegExp = getDomainNameRegExp()
  for (let invalidDomainName of invalidDomainNames) {
    expect(invalidDomainName).not.toMatch(domainNameRegExp)
  }
})

test('check if the RegEx.test returns true for valid IPv4 address', () => {
  let validIPv4addresses = [
    '255.255.255.255',
    '0.0.0.0',
    '192.168.0.1',
    '1.1.1.1'
  ]
  let IPv4RegExp = getIPv4RegExp()
  for (let IPV4 of validIPv4addresses) {
    expect(IPV4).toMatch(IPv4RegExp)
  }
})

test('check if the RegEx.test returns false for invalid IPv4 address', () => {
  let inValidIPv4addresses = [
    '255.255.255.256',
    '0.0.0.',
    '192.168.-1.1',
    '1.1.1.ab'
  ]
  let IPv4RegExp = getIPv4RegExp()
  for (let invalidIPV4 of inValidIPv4addresses) {
    expect(invalidIPV4).not.toMatch(IPv4RegExp)
  }
})

test('check if the RegEx.test returns true for valid IPv6 address', () => {
  let validIPv6addresses = [
    '[FE80:0000:0000:0000:0202:B3FF:FE1E:8329]',
    '[2001:0db8:0001:0000:0000:0ab9:C0A8:0102]'
  ]
  let IPv6RegExp = getIPv6RegExp()
  for (let ipV6 of validIPv6addresses) {
    expect(ipV6).toMatch(IPv6RegExp)
  }
})

test('check if the RegEx.test returns false for invalid IPv6 address', () => {
  let inValidIPv6addresses = [
    'FH80:0000:0000:0000:0202:B3-F:FE1E:8329',
    '2001:0db8:0001:0000:0000:0ao9:C0A8:0102',
    '[FE80:0000:0000:00M0:0202:B3FF:FE1E:8329]'
  ]
  let IPv6RegExp = getIPv6RegExp()
  for (let invalidIPV6 of inValidIPv6addresses) {
    expect(invalidIPV6).not.toMatch(IPv6RegExp)
  }
})

test('check if the string is a valid host name', () => {
  let validHostNames = ['example.com', 'www.google.com', 'web.mit.edu', '9gag.com', 'www.geekskool.com', 'insomnia.rest', '255.255.255.255', '0.0.0.0', '192.168.0.1', '1.1.1.1', '[FE80:0000:0000:0000:0202:B3FF:FE1E:8329]',
    '[2001:0db8:0001:0000:0000:0ab9:C0A8:0102]']
  for (let hostname of validHostNames) {
    expect(validateHostname(hostname)).toBe(true)
  }
})

test('check if the string is a invalid host name', () => {
  let inValidHostNames = ['example.c', '1.1..1', '192.168.256.1', '[FE80:0000:0000:00M0:0202:B3FF:FE1E:8329]']
  for (let hostname of inValidHostNames) {
    expect(validateHostname(hostname)).toBeFalsy()
  }
})

test('check if the string is a valid URL', () => {
  let validUrls = [
    'http://www.google.com',
    'http://example.co',
    'http://192.168.0.1',
    'https://google.com',
    'http://[FE80:FE80:FE80:FE80:0202:B3FF:FE1E:8329]'
  ]
  for (let validUrl of validUrls) {
    expect(validateUrl(validUrl)).toBe(true)
  }
})
