/// <reference path="../typings/tsd.d.ts" />
/// <reference path="global.ts" />
/// <reference path="api.ts" />
/// <reference path="note.ts" />
const DrawingCanvas = (function () { // eslint-disable-line no-unused-vars
  function DrawingCanvas () {
    const _this = this
    this.events = {}
    this.isDragging = false
    // Setup the drawing canvas
    this.drawing = SVG('drawing')
    this.linedrawing = SVG('linedrawing')

    let isDrawing = false

    /**
     * Start drawing a path
     *
     * @param { number } x            X coordinate on the viewport
     * @param { number } y            Y coordinate on the viewport
     */
    const startDrawing = (x, y) => {
      if (!GLOBAL.playerMode()) { // eslint-disable-line node/no-deprecated-api
        return
      }

      isDrawing = true
      // Reset the mousePath
      _this.mousePath = new Path([])
      // Calculate the % position clicked
      const mousePos = _this.video.clientToVideoCoord(x, y)
      // Add the position to the mousePath
      _this.mousePath.push(new PathPoint(mousePos.x, mousePos.y, _this.video.currentTime))
      _this.lastMouseTime = 0
    }

    /**
     * Finish drawing a path
     *
     * @param { number } x            X coordinate on the viewport
     * @param { number } y            Y coordinate on the viewport
     */
    const endDrawing = (x, y) => {
      isDrawing = false

      if (!GLOBAL.playerMode()) { // eslint-disable-line node/no-deprecated-api
        return
      }

      // Listen for mouseUp events
      _this.isDragging = false
      $('#clickArea').unbind('mousemove')

      // Simplify the mouse trail
      _this.mousePath.simplify()
      // Calculate the % position clicked
      const mousePos = _this.video.clientToVideoCoord(x, y)
      // Add the position to the mousePath
      _this.mousePath.push(new PathPoint(mousePos.x, mousePos.y, _this.video.currentTime))

      if (_this.events.onDrawingComplete) {
        _this.events.onDrawingComplete(_this.mousePath)
      }
    }

    const onDraw = (x, y) => {
      if (!GLOBAL.playerMode() || !isDrawing) { // eslint-disable-line node/no-deprecated-api
        return
      }

      // Add the mouse position to the path, if the time has changed
      _this.isDragging = true
      const mousePos = _this.video.clientToVideoCoord(x, y)
      const mouseTime = _this.video.currentTime

      if (_this.lastMouseTime !== mouseTime) {
        _this.lastMouseTime = mouseTime
        _this.mousePath.push(new PathPoint(mousePos.x, mousePos.y, mouseTime))
        _this.updateMouseTrail()
      }
    }

    /**
     * Handle when the interaction leaves the area
     *
     * @param { number } x            X coordinate on the viewport
     * @param { number } y            Y coordinate on the viewport
     */
    const leaveArea = (x, y) => {
      if (!GLOBAL.playerMode() || !_this.isDragging) { // eslint-disable-line node/no-deprecated-api
        return
      }

      // Listen for mouseUp events
      _this.isDragging = false
      $('#clickArea').unbind('mousemove')
      // Simplify the mouse trail
      _this.mousePath.simplify()

      // Calculate the % position clicked
      const mousePos = _this.video.clientToVideoCoord(x, y)

      // Add the position to the mousePath
      _this.mousePath.push(new PathPoint(mousePos.x, mousePos.y, _this.video.currentTime))

      // And go to the editor mode
      // gotoEditor();
      if (_this.events.onDrawingComplete) { _this.events.onDrawingComplete(_this.mousePath) }
    }

    let prevTouches

    $('#clickArea')
      .on('mousedown', (e) => {
        startDrawing(e.pageX, e.pageY)
      })
      .on('mouseup', (e) => {
        endDrawing(e.pageX, e.pageY)
      })
      .on('mousemove', (e) => {
        if (e.which) {
          // Stop dragging
          _this.isDragging = false
          return
        }

        onDraw(e.pageX, e.pageY)
      })
      .on('touchstart', (e) => {
        if (e.originalEvent.touches.length !== 1) {
          return true
        }

        startDrawing(e.originalEvent.touches[0].clientX, e.originalEvent.touches[0].clientY)

        e.preventDefault()
        e.stopPropagation()
        return false
      })
      .on('touchmove', (e) => {
        prevTouches = e.originalEvent.touches
        onDraw(e.originalEvent.touches[0].clientX, e.originalEvent.touches[0].clientY)

        e.preventDefault()
        e.stopPropagation()
        return false
      })
      .on('touchend', (e) => {
        if (!prevTouches || prevTouches.length !== 1) {
          return
        }

        endDrawing(prevTouches[0].clientX, prevTouches[0].clientY)
        prevTouches = null

        e.preventDefault()
        e.stopPropagation()
        return false
      })
      .on('touchcancel', (e) => {
        if (!prevTouches || prevTouches.length !== 1) {
          return
        }

        endDrawing(prevTouches[0].clientX, prevTouches[0].clientY)
        prevTouches = null

        e.preventDefault()
        e.stopPropagation()
        return false
      })

    $(window)
      .on('mouseleave', function (event) {
        leaveArea(event.pageX, event.pageY)
      })
  }

  DrawingCanvas.prototype.updateMouseTrail = function () {
    if (!this.mousePolyline) {
      this.mousePolyline = this.drawing.polyline([]).fill('none').stroke({ width: 5, color: 'white', opacity: 0.5 })
    }

    const c = $('#drawing')
    const scaleX = c.width()
    const scaleY = c.height()
    const p = []
    for (let i = 0; i < this.mousePath.points.length; i++) {
      p.push([this.mousePath.points[i].x * scaleX, this.mousePath.points[i].y * scaleY])
    }
    const casted = this.mousePolyline
    casted.plot(p)
  }

  DrawingCanvas.prototype.updateAnimation = function () {
    if (!GLOBAL.editorMode()) { // eslint-disable-line node/no-deprecated-api
      return
    }

    const p = this.mousePath.getPosAtTime(this.video.currentTime)
    // <mousePath.log(p);
    if (!p) {
      return
    }

    const c = $('#drawing')
    const scaleX = c.width()
    const scaleY = c.height()

    if (!this.circle) {
      this.circle = this.drawing.circle(50).attr({ fill: 'white', opacity: 0.5 })
    }

    this.circle.move(p.x * scaleX - 25, p.y * scaleY - 25)
    this.video.zoomPos.x = p.x
    this.video.zoomPos.y = p.y
    this.video.updatePlayerSize()
  }

  DrawingCanvas.prototype.clearMouseTrail = function () {
    if (!this.mousePolyline) {
      return
    }

    const casted = this.mousePolyline
    casted.plot([])
  }

  DrawingCanvas.prototype.updateNotes = function (notes) {
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]
      const p = note.path.getPosAtTime(video.currentTime)
      if (p) {
        if (!note.elm) {
          note.elm = $('<div class="note"/>')
          const noteText = $('<div class="note-text"/>')
          noteText.text(note.text)
          note.elm.append(noteText)
          $('#notes').append(note.elm)
          note.elm.attr('id', note.id)
          note.line = this.linedrawing.polyline([]).fill('none').stroke({ width: 2, color: 'rgba(0,0,0,0.5)' })
        }
        this.updateNoteElm(note, p)
        return
      }

      if (note.path.last().time + 100 < video.currentTime) {
        // Remove old notes
        if (note.elm) {
          this.removeNote(note)
        }
        notes.splice(i, 1)
        i--
        return
      }

      if (note.elm && note.path.first().time > video.currentTime) {
        // Hide notes not visible yet
        this.removeNote(note)
      }
    }
  }
  // Update a specific notes visual elements position
  DrawingCanvas.prototype.updateNoteElm = function (note, p) {
    if (!p) {
      return
    }

    const pos = video.videoToClientCoord(p.x, p.y)
    if (pos !== note.curPos) {
      if (!note.curPos) {
        note.curPos = pos
      }
      const dirVec = { x: (pos.x - note.curPos.x), y: (pos.y - note.curPos.y) }
      const length = Math.sqrt(dirVec.x * dirVec.x + dirVec.y * dirVec.y)

      const dirUnitVec = {
        x: length > 0 ? dirVec.x / length : 1,
        y: length ? dirVec.y / length : 0
      }

      const dist = 40
      const goalDir = {
        x: dirVec.x - dirUnitVec.x * dist,
        y: dirVec.y - dirUnitVec.y * dist
      }

      note.curPos.x += goalDir.x * 0.1
      note.curPos.y += goalDir.y * 0.1

      const offset = { x: -1, y: -1 }
      if (dirUnitVec.x > 0.1) {
        offset.x = -note.elm.children('.note-text').outerWidth() + 1
      }

      if (dirUnitVec.y > 0.5) {
        offset.y = -note.elm.children('.note-text').outerHeight() + 1
      }

      const playerSize = video.calculatePlayerSize()
      if (note.curPos.y + offset.y > playerSize.height) {
        note.curPos.y = playerSize.height - offset.y
      }

      if (note.curPos.y + offset.y < 0) {
        note.curPos.y = 0 - offset.y
      }

      if (note.curPos.x + offset.x > playerSize.width) {
        note.curPos.x = playerSize.width - offset.x
      }

      if (note.curPos.x + offset.x < 0) {
        note.curPos.x = 0 - offset.x
      }

      note.elm.css({
        top: note.curPos.y + offset.y,
        left: note.curPos.x + offset.x
      })

      const c = $('#drawing')
      const scaleX = c.width()
      const scaleY = c.height()
      const p2 = video.clientToVideoCoord(note.curPos.x, note.curPos.y)
      note.line.plot([[Math.floor(p2.x * scaleX), Math.floor(p2.y * scaleY)], [p.x * scaleX, p.y * scaleY]])
    }
  }
  DrawingCanvas.prototype.removeNote = function (note) {
    note.elm.remove()
    note.line.plot([])
    delete note.line
    delete note.elm
  }
  return DrawingCanvas
})()
