const path = require('path')
const Logger = require('logger')
const ServerConfig = require('helpers.js/lib/ServerConfig')
const config = new ServerConfig()
const logger = new Logger('lib/config')

config.loadFile(path.join(__dirname, '..', 'config', 'defaults'))
logger.log('Loaded configuration')

if (process.env.ENVIRONMENT) {
  config.loadFile(path.join(__dirname, '..', 'config', process.env.ENVIRONMENT), true)
}

config.loadFile(path.join(__dirname, '..', 'config', 'local'), true)
config.loadFile(path.join(__dirname, '..', 'config', `${process.env.ENVIRONMENT}-local`), true)

Logger.setMaxLevel(config.get('logger.max_level'))

module.exports = config
