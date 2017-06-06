module.exports = `
module.exports.templateTags = [{
    name: 'hello',
    displayName: 'Say Hello',
    description: 'says hello to someone',
    args: [{
        displayName: 'Mood',
        type: 'enum',
        options: [
            {displayName: 'Calm', value: 'calm'},
            {displayName: 'Talkative', value: 'talkative'},
            {displayName: 'Ecstatic', value: 'ecstatic'},
        ]
    }, {
        displayName: 'Name',
        description: 'who to say "hi" to',
        type: 'string',
        defaultValue: 'Karen'
    }],
    async run (context, mood, name) {
        switch (mood) {
            case 'calm':
                return \`Hi \${name}.\`;
            case 'talkative':
                return \`Oh, hello \${name}, it's so nice to see you! How have you been?\`;
            case 'ecstatic':
                return \`OH MY GOD, HI \${name.toUpperCase()}!\`;
            default:
                return \`Hello \${name.toUpperCase()}.\`;
        }
    }
}];
`.trim();
