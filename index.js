const favicon = require('serve-favicon')
const express = require('express')
const sassMiddleware = require('node-sass-middleware')
const config = require('./lib/config')

const path = require('path')

// Setup api app
const api = require('./api').setup()

// Setup express app
const app = express()

// Put everything behind a username / password if PASSWORD is set
if (process.env.PASSWORD) {
  const basicAuth = require('basic-auth')
  const auth = function (req, res, next) {
    function unauthorized (res) {
      res.set('WWW-Authenticate', 'Basic realm=Authorization Required')
      return res.sendStatus(401)
    }

    const user = basicAuth(req)

    if (!user || !user.name || !user.pass) {
      return unauthorized(res)
    }

    if (user.name === process.env.PASSWORD && user.pass === process.env.PASSWORD) {
      return next()
    }

    return unauthorized(res)
  }
  app.use('/', auth)
}

app.set('port', config.get('server.port', 5000))

app.use(favicon(path.join(__dirname, 'public/favicon.ico')))

// Adding the SASS middleware
app.use(sassMiddleware({
  src: path.join(__dirname, 'sass'),
  dest: path.join(__dirname, 'public'),
  debug: false,
  outputStyle: 'compressed'
}))

// Add new locations here.
const sites = ['pescara']

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public/index.html'))
})

sites.forEach(function (site) {
  app.get('/' + site, function (req, res) {
    res.sendFile(path.join(__dirname, 'public/index.html'))
  })
})

app.use('/', express.static(path.join(__dirname, 'public')))

// Host the api on /api
app.use('/api', api)

app.listen(app.get('port'), function () {
  console.log('Node app is running at localhost:' + app.get('port'))
})
