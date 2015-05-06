/// <reference path="../typings/tsd.d.ts" />
/// <reference path="api.ts" />
/// <reference path="VideoPlayer.ts" />
/// <reference path="interface.ts" />
/// <reference path="global.ts" />
/// <reference path="drawingCanvas.ts" />
/// <reference path="clock.ts" />



// Fetch every 15sec, fetch 20sec of data
var api = new NotesApi();
api.startFetching(15000, 20000);

var drawingCanvas : DrawingCanvas;
var ui : Interface;
var video : VideoPlayer;
var clock : Clock;

// Wait for a go from youtube api
var onYouTubePlayerAPIReady = () => {
    video = new VideoPlayer({
        onLoadComplete : () => {
            setTimeout(()=>{
                ui.hideLoadingScreen();
            }, 300);
        },
        onNewFrame:(player:VideoPlayer) => {
            api.currentTime = player.currentTime;

            drawingCanvas.updateNotes(api.notes);
            drawingCanvas.updateAnimation();


            clock.frameUpdate(video);

            updateVideoLoop();
        }
    });



    $(document).ready(()=>{
        ui = new Interface({
            onResize: () => {
                video.updatePlayerSize();
            }
        });

        drawingCanvas = new DrawingCanvas();
        drawingCanvas.api = api;
        drawingCanvas.video = video;

        drawingCanvas.events.onDrawingComplete = gotoEditor;

        clock = new Clock();


        $('#back').click(function(){
            gotoVideo(video.currentTime);
        });
    });

}




function gotoEditor(path: Path){
    ui.hideVideo(() => {
        GLOBAL.MODE = "EDITOR";
        video.zoom = 4;

        // Seek to the path start time
        video.seek(path.points[0].time, ()=>{
            ui.showVideo();
        });

        // Set the video zoom position
        video.zoomPos= {x: path.points[0].x, y:path.points[0].y};
        video.updatePlayerSize();

        // Update the interface
        $('#notes').hide();
        $('#addNoteInterface').show();

        $('#note-text').val('').focus();

        $('#rewind').hide();
        $('#back').show();
    });

    var trySubmit = ()=>{
        var text = $('#note-text').val();
        if(text) {
            var note = new Note([]);
            note.path = path;
            note.text = text;
            // Submit the path to the API
            api.submitNote(note);

            // GOTO video mode again
            gotoVideo(path.points[0].time-5000);
        } else {
            $('#note-text').attr('placeholder', 'Please write something').focus();
            $('#submitButton').unbind('click').click(trySubmit)
        }
    };

    $('#submitButton').unbind('click').click(trySubmit)
}


function gotoVideo(seekTime :number){
    ui.hideVideo(()=>{
        GLOBAL.MODE = "PLAYER";
        video.zoom = 1;

        video.updatePlayerSize();
        drawingCanvas.clearMouseTrail();

        // Seek to the path start time
        video.seek(seekTime, ()=>{
            ui.showVideo();
        });

        $('#notes').show();
        $('#addNoteInterface').hide();

        $('#rewind').show();
        $('#back').hide();
    })
}

function updateVideoLoop(){
    if(GLOBAL.MODE == "EDITOR"){
        var time = drawingCanvas.mousePath.last().time;

        var diff = time- drawingCanvas.mousePath.points[0].time;
        if(diff < 3000){
            time += 3000 - diff;
        }

        if(video.currentTime > time){
            this.video.seek(drawingCanvas.mousePath.points[0].time);
        }
    }
}