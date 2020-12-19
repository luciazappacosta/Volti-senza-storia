/// <reference path="../typings/tsd.d.ts" />
const YT_VIDEO_STATE_UNSTARTED = -1 // eslint-disable-line no-unused-vars
const YT_VIDEO_STATE_ENDED = 0
const YT_VIDEO_STATE_PLAYING = 1
const YT_VIDEO_STATE_CUED = 5 // eslint-disable-line no-unused-vars

const VideoPlayer = (function () { // eslint-disable-line no-unused-vars
  function VideoPlayer (playlist, durations, modulusHours, events) {
    const _this = this
    this.aspect = 16.0 / 9.0
    this.zoom = 1.0
    this.zoomPos = { x: 0, y: 0 }
    this.loading = true
    this.startTimes = []
    this.durations = []
    this.modulusHours = 1
    this.totalDur = 0
    /** Current time in millis **/
    this.currentTime = 0
    // onStateChange callback
    this.stateChangeCallback = function (state) {
    }

    this.durations = durations
    this.modulusHours = modulusHours
    // Populate the startTimes array
    let _dur = 0
    for (let i = 0; i < this.durations.length; i++) {
      this.startTimes.push(_dur)
      _dur += this.durations[i] * 1000
    }
    this.startTimes.push(_dur)
    this.totalDur = _dur
    this.events = events
    this.ytplayer = new YT.Player('ytplayer', {
      height: 390,
      width: 640,
      // videoId: '',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        enablejsapi: 1,
        fs: 0,
        modestbranding: 1,
        origin: 'localhost',
        rel: 0,
        showinfo: 0,
        list: playlist,
        listType: 'playlist',
        start: 0,
        mute: 1,
        playsinline: 1
      },
      events: {
        onReady: function () {
          _this.onPlayerReady()
        },
        onStateChange: function () {
          _this.onPlayerStateChange()
        }
      }
    })
  }
  VideoPlayer.prototype.updatePlayerSize = function () {
    const player = $('#videocontainer')
    const size = this.calculatePlayerSize()

    $('#initial-spinner').addClass('hidden')
    $('#start-interactions').on('click', (e) => {
      try {
        e.preventDefault()
        e.stopPropagation()
        ui.hideLoadingScreen()
        this.ytplayer.playVideo()
      } catch (err) {
        console.log(err)
      }

      return false
    })

    // $('#application')
    //   .addClass('ready')

    player
      .css({
        left: size.left,
        top: size.top - 50,
        width: size.width,
        height: size.height + 100
      })

    // updateMouseTrail();
  }

  VideoPlayer.prototype.clientToVideoCoord = function (clientX, clientY) {
    const playerSize = this.calculatePlayerSize()
    const ret = {
      x: clientX,
      y: clientY
    }
    ret.x -= playerSize.left
    ret.y -= playerSize.top
    ret.x /= playerSize.width
    ret.y /= playerSize.height
    return ret
  }

  VideoPlayer.prototype.videoToClientCoord = function (videoX, videoY) {
    const playerSize = this.calculatePlayerSize()
    const ret = {
      x: videoX,
      y: videoY
    }
    ret.x *= playerSize.width
    ret.y *= playerSize.height
    ret.x += playerSize.left
    ret.y += playerSize.top
    return ret
  }

  VideoPlayer.prototype.calculatePlayerSize = function () {
    let left = 0
    let top = 0
    let width = 0
    let height = 0

    if ($(window).width() / $(window).height() > this.aspect) {
      width = $(window).width()
      height = $(window).width() / this.aspect
      top = -(height - $(window).height()) / 2
    } else {
      width = $(window).height() * this.aspect
      height = $(window).height()
      left = -(width - $(window).width()) / 2
    }

    if (this.zoom !== 1) {
      width *= this.zoom
      height *= this.zoom
      left = -this.zoomPos.x * width + $(window).width() * 0.25
      top = -this.zoomPos.y * height + $(window).height() * 0.5
    }
    return { left: left, top: top, width: width, height: height }
  }

  VideoPlayer.prototype.frameUpdate = function () {
    const timeUpdated = this.ytplayer.getCurrentTime() * 1000
    const playing = this.ytplayer.getPlayerState() === 1

    if (playing) {
      if (this._last_time_update === timeUpdated) {
        this.currentTime += 10
      }

      if (this._last_time_update !== timeUpdated) {
        this.currentTime = timeUpdated
        if (this.startTimes[this.ytplayer.getPlaylistIndex()]) {
          this.currentTime += this.startTimes[this.ytplayer.getPlaylistIndex()]
        }
      }
    }

    this._last_time_update = timeUpdated
    if (this.events.onNewFrame) {
      this.events.onNewFrame(this)
    }
  }

  VideoPlayer.prototype.seek = function (ms, cb, dontFetchApi) {
    const _this = this
    if (ms > this.totalDur) {
      ms %= this.totalDur // loops back around to 3:00 - 3:27
    }
    let relativeMs

    for (let i = 0; i < this.startTimes.length - 1; i++) {
      if (ms < this.startTimes[i + 1]) {
        if (this.ytplayer.getPlaylistIndex() !== i) {
          this.ytplayer.playVideoAt(i)
        }
        relativeMs = ms - this.startTimes[i]
        this.ytplayer.seekTo(relativeMs / 1000, true)
        break
      }
    }

    this.currentTime = ms

    // Start an interval and wait for the video to play again
    const interval = setInterval(function () {
      if (_this.ytplayer.getPlayerState()) {
        clearInterval(interval)
        if (!dontFetchApi) {
          api.fetchNotes(ms)
        }

        if (cb) {
          cb()
        }
      }
    }, 100)
  }

  VideoPlayer.prototype.onPlayerReady = function () {
    this.updatePlayerSize()
  }

  VideoPlayer.prototype.onPlayerStateChange = function () {
    const state = this.ytplayer.getPlayerState()
    const _this = this

    if (this.stateChangeCallback) {
      this.stateChangeCallback(state)
    }

    this.ytplayer.mute()

    if (state === YT_VIDEO_STATE_ENDED) {
      this.seek(0)
    }

    if (this.loading && state === YT_VIDEO_STATE_PLAYING) {
      this.loading = false
      if (this.events.onLoadComplete) {
        this.events.onLoadComplete(this)
      }

      setInterval(function () {
        _this.frameUpdate()
      }, 10)
    }
  }

  // use this from the frontend for testing
  VideoPlayer.prototype.setClock = function (time, cb) {
    this.setTime(moment(time, ['H:mm', 'HH:mm', 'HH:mm:ss', 'H:mm:ss']))
  }

  // use this from the backend to avoid time parsing problems
  VideoPlayer.prototype.setTime = function (time, cb) {
    // use the startTime data
    const target = moment(Clock.startTime)
    // use the time hours, minutes, seconds
    target.hour(time.hour())
    target.minute(time.minute())
    target.second(time.second())
    // If the target is before the start clock of the video (its in the morning)
    if (target.isBefore(moment(Clock.startTime))) {
      target.add(24, 'hours')
    }

    const hourMillis = 60 * 60 * 1000
    let diff = target.diff(moment(Clock.startTime))
    // modulus with the number of hours specified
    diff %= this.modulusHours * hourMillis
    // Handle the case where the time is longer then the playlist, then pick a random hour
    if (diff > this.totalDur) {
      diff -= Math.floor(Math.random() * this.modulusHours) * hourMillis
    }
    video.seek(diff, cb)
  }
  return VideoPlayer
})()
