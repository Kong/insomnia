# Insomnia Default Headers

[![Npm Version](https://img.shields.io/npm/v/insomnia-plugin-default-headers.svg)](https://www.npmjs.com/package/insomnia-plugin-default-headers)

This is a plugin for [Insomnia](https://insomnia.rest) that allows users to set default
headers for requests.

## Installation

Install the `insomnia-plugin-default-headers` plugin from Preferences > Plugins.

## Usage

Headers can be added by setting a `DEFAULT_HEADERS` environment variable.

```json
{
	"DEFAULT_HEADERS": {
		"Content-Type": "application/json",
		"Connection": "close"
	}
}
```
Default header can be removed by setting value to null. For example, use folder environment variables to remove authorization header from anonymous calls
```json
{
  "DEFAULT_HEADERS": {
    "Authorization": "null"
  }
}
```
