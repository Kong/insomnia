module.exports = `
{
    "name": "{{ name }}",
    "displayName": "{{ displayName }}",
    "version": "{{ version | default('0.0.1') }}",
    "private": true,
    "main": "plugin.js",
    "description": "{{ description | default('A plugin for Insomnia') }}",
    "dependencies": {},
    "devEngines": {
        "node": "7.4",
        "npm": "4.x | 5.x"
    }
}
`.trim();
