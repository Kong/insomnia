# Insomnia Default Headers

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

