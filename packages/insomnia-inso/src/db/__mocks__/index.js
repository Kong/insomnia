// eslint-disable-next-line filenames/match-exported
const db = jest.requireActual('../index');

const database = db.emptyDb();

db.loadDb = jest.fn().mockResolvedValue(database);

module.exports = db;
