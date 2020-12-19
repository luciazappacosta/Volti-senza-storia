const PathPoint = (function () {
  function PathPoint (x, y, time) {
    this.x = x
    this.y = y
    this.time = time
    //  console.log(this);
  }
  return PathPoint
})()

const Path = (function () {
  function Path (json) {
    this.points = []
    if (json && json.length > 0) {
      for (let i = 0; i < json.length; i++) {
        this.points.push(new PathPoint(json[i].x, json[i].y, json[i].time))
      }
      // Check that the path is at least 3 sec long
      const diff = this.last().time - this.points[0].time
      if (diff < 3000) {
        this.points[this.points.length - 1].time += 3000 - diff
      }
    }
  }

  Path.prototype.push = function (point) {
    this.points.push(point)
  }

  Path.prototype.last = function () {
    return _.last(this.points)
  }

  Path.prototype.first = function () {
    return _.first(this.points)
  }

  Path.prototype.getPosAtTime = function (time) {
    if (!this.points.length) {
      return
    }

    if (time < this.points[0].time) {
      return undefined
    }

    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i].time >= time) {
        if (!i) {
          return this.points[i]
        }

        const p = this.points[i - 1]
        const n = this.points[i]
        const pct = (time - p.time) / (n.time - p.time)

        return {
          x: p.x * (1 - pct) + n.x * pct,
          y: p.y * (1 - pct) + n.y * pct,
          time: time
        }
      }
    }
  }
  Path.prototype.simplify = function () {
    this.points = simplify(this.points, 0.002) // eslint-disable-line no-undef
  }
  return Path
})()

const Note = (function () {
  function Note (json) {
    if (json) {
      this.id = json.id
      this.time_begin = json.time_begin
      this.time_end = json.time_end
      this.text = json.note
      this.path = new Path(json.path)
      if (this.text) {
        const dur = this.time_end - this.time_begin
        const minDur = this.text.length / 140 * 6000 + 3000 // 6 seconds to read 140 characters
        if (dur < minDur) {
          const newPoint = new PathPoint(this.path.last().x, this.path.last().y, this.path.first().time + minDur)
          this.path.push(newPoint)
          this.time_end = this.time_begin + minDur
        }
      }
    }
  }
  return Note
})()
