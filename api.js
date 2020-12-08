const errors = require('errors')
const express = require('express')
const bodyParser = require('body-parser')
const Logger = require('logger')
const boring = require('./boring')
const db = require('./lib/db')

const logger = new Logger('api')
logger.setLevel(5)

const tableExists = async (tablename, schema = 'public') => {
  const query = {
    text: 'SELECT COUNT(*)::INT AS count FROM information_schema.tables where table_name = $1 AND table_schema = $2',
    values: [tablename, schema]
  }
  logger.debug(query)
  const result = await db.query(query)
  const exists = !!result.rows[0].count

  logger.log(`Table "${schema}"."${tablename}"`, exists ? 'exists' : 'does not exist')
  return exists
}

const createNotes = async () => {
  const exists = await tableExists('notes')

  if (exists) {
    return
  }

  const query = `
    CREATE TABLE "public"."notes" (
      "id" serial,
      "time_begin" int,
      "time_end" int,
      "note" text,
      "ip" cidr,
      "timestamp" timestamp,
      "path" float[][],
      "hidden" boolean,
      "site" int NOT NULL DEFAULT 0,
      PRIMARY KEY ("id")
    )
  `
  logger.debug(query)
  await db.query(query)
}

const createBlacklist = async () => {
  const exists = await tableExists('blacklist')

  if (exists) {
    return
  }

  const query = `
    CREATE TABLE "public"."blacklist" (
      "ip" cidr,
      PRIMARY KEY ("ip")
    )
  `
  logger.debug(query)
  await db.query(query)
}

const isDuplicate = async (ip, paths) => {
  logger.debug('Check if duplicate', ip)
  const query = {
    text: `
      SELECT
        notes.id,
        time_begin,
        time_end,
        note,
        path,
        timestamp
      FROM
        "public"."notes"
      WHERE
        ip = $1
      ORDER BY
        id DESC
      LIMIT 1
    `,
    values: [ip]
  }
  logger.debug(query)
  const result = await db.query(query)

  const row = result.rows[0]
  if (row && row.time_begin === Math.round(paths[0].time) && row.time_end === Math.round(paths[paths.length - 1].time)) {
    logger.warn('Duplicate found for', ip, paths)
    throw new errors.BadRequest('Duplicate')
  }

  logger.log('Not a duplicate, can proceed')
}

const checkRateLimit = async (ip) => {
  logger.debug('Check if rate limited', ip)
  const query = {
    text: `
      SELECT
        COUNT(*)::INT AS count
      FROM
        "notes"
      WHERE
        ip = $1 AND
        timestamp > NOW() - INTERVAL '10 minute'
    `,
    values: [ip]
  }
  logger.debug(query)
  const result = await db.query(query)

  if (result.rows.count > 15) {
    logger.warn('Rate limit hit for IP', ip)
    throw new errors.Forbidden('Note add rate limit')
  }

  logger.log('No rate limits, can proceed')
}

module.exports = {
  setup: () => {
    const api = express()
    api.use(bodyParser.json())
    api.enable('trust proxy')

    /* query("SELECT * FROM information_schema.tables where table_name = 'paths'", function(rows, ret){
     if(ret.length == 0){
     query('CREATE TABLE "public"."paths" (\
     "id" serial,\
     "coordinate" point,\
     "time" int,\
     "note_id" int,\
     PRIMARY KEY ("id"));')
     }
     }); */

    createNotes()
      .then(() => {
        logger.log('Verified that the storage for notes exists')
      })
      .catch((err) => {
        logger.error('Failed to verify that the storage for notes exists')
        logger.error(err)
      })

    createBlacklist()

    api.get('/notes/count', async (req, res, next) => {
      const site = req.query.site || 0
      const result = await db.query({
        text: 'SELECT COUNT(*)::INT AS count FROM notes WHERE site = $1',
        values: [site]
      })

      const count = result.rows[0]

      if (!count) {
        return res
          .status(404)
          .json({
            status: 'error',
            message: 'Site not found'
          })
      }

      res.send(count)
    })

    api.get('/regex', (req, res, next) => {
      res.json({
        all: boring.getRegex(),
        psql: boring.getPsqlRegex(),
        parts: boring.getRegexes()
      })
    })

    api.get('/clean', async (req, res, next) => {
      console.log('Cleaning: marking all boring content in database hidden.')
      const psqlRegex = boring.getPsqlRegex()

      const result = await db.query({
        text: 'UPDATE public.notes SET hidden = TRUE WHERE HIDDEN IS NULL AND LOWER(note) ~ $1 RETURNING note',
        values: [psqlRegex]
      })
      res.send(result.rows.map(function (result) {
        console.log('Done cleaning')
        return result.note
      }))
    })

    api.get('/notes/recent/hidden', async (req, res, next) => {
      const limit = Math.min((req.query.limit || 250), 1000)
      const site = req.query.site || 0

      const result = await db.query({
        text: 'SELECT note FROM notes WHERE hidden = TRUE AND site = $1 ORDER BY timestamp DESC LIMIT $2',
        values: [site, limit]
      })

      res.send(result.rows.map(row => row.note))
    })

    api.get('/notes/recent/visible', async (req, res, next) => {
      const limit = Math.min((req.query.limit || 250), 1000)
      const site = req.query.site || 0
      const result = await db.query({
        text: 'SELECT note FROM notes WHERE hidden IS NULL AND site = $1 ORDER BY timestamp DESC LIMIT $2',
        values: [site, limit]
      })

      res.send(result.rows.map(row => row.note))
    })

    api.get('/notes', async (req, res, next) => {
      const startTime = Math.round(req.query.timeframeStart)
      const endTime = Math.round(req.query.timeframeEnd)
      const ip = req.query.ip || req.ip
      const site = req.query.site || 0
      const result = await db.query({
        text: `
          SELECT
            id,
            time_begin,
            time_end,
            note,
            path
          FROM
            notes
          WHERE
            time_end >= $1 AND
            time_begin <= $2 AND
            site = $3 AND
            (
              ip = $4 OR NOT (
                hidden IS TRUE OR (
                  HIDDEN IS NULL AND
                  EXISTS (
                    SELECT 1 FROM blacklist WHERE ip = notes.ip
                  )
                )
              )
            )
          LIMIT 250
        `,
        values: [startTime, endTime, site, ip]
      })

      const rows = result.rows.map(row => {
        const path = row.path.map((p) => {
          return {
            x: p[0],
            y: p[1],
            time: p[2]
          }
        })

        row.path = path
        return row
      })

      res.send(rows)
    })

    api.post('/notes', async (req, res, next) => {
      try {
        const paths = req.body.path
        let text = req.body.text
        const site = req.body.site

        if (paths.length < 2) {
          res.status(400).send('At least 2 points in a path are required')
          return
        }

        if (!text) {
          res.status(400).send('Text is missing')
          return
        }

        if (site === undefined) {
          res.status(400).send('Site is missing')
          return
        }

        if (text.length > 140) {
          text = text.substr(0, 140)
        }

        // TODO value testing
        const q = []
        for (let i = 0; i < paths.length; i++) {
          q.push('{' + paths[i].x + ',' + paths[i].y + ',' + Math.round(paths[i].time) + '}')
        }

        // Get the last entry by the IP
        await isDuplicate(req.ip, paths)
        await checkRateLimit(req.ip)
        const hidden = boring.check(text)
        const query = {
          text: `
            INSERT INTO
              "public"."notes"
              (
                "time_begin",
                "time_end",
                "note",
                "ip",
                "timestamp",
                "path",
                "hidden",
                "site"
              )
            VALUES
              ($1, $2, $3, $4, NOW(), $5, $6, $7)
            RETURNING
              id
          `,
          values: [
            Math.round(paths[0].time),
            Math.round(paths[paths.length - 1].time),
            text,
            req.ip,
            '{' + q.join(',') + '}',
            hidden ? true : null,
            site
          ]
        }
        logger.debug(query)
        const result = await db.query(query)

        const id = result.rows[0].id
        res.send({ id })
      } catch (err) {
        logger.error('Failed to create a note', err.message)
        logger.debug(err.stack)

        res
          .status(err.statusCode || 500)
          .json({
            status: 'error',
            error: err.message,
            code: err.statusCode || 500
          })
      }
    })

    return api
  }
}
