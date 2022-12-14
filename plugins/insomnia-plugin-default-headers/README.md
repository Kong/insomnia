# Insomnia Default Headers

This is a plugin for [Insomnia](https://insomnia.rest) that allows users to set default
headers for requests.

## Installation

`insomnia-plugin-default-headers` is pre-installed into Insomnia since version `2022.7.0` onwards.

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
