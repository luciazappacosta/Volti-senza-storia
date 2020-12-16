const { Pool, types } = require('pg')
const { buildUrl } = require('helpers.js')

const config = require('./config')

const connectionString = config.get('db.connection_string') || buildUrl({
  protocol: 'postgresql',
  ...config.get('db')
})
// Do not use JS Date objects internally for Postgres date since time zone difference will be a mess
types.setTypeParser(1082, 'text', (val) => {
  return val
})

const connection = new Pool({
  connectionString: connectionString
})

module.exports = connection
