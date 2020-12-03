function HIDETRACKS(element) {
    if (element) {
        var video = document.getElementById(element);
    } else {
        var video = document.getElementById("video");
    }
    if (!video) return;
    if (!video.textTracks) return;
    // Oddly, there's no way to remove a track from a video, so hide them instead
    for (i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = "hidden";
    }
};

function SETCLUE(cue, element, hide) {
    if (element) {
        var video = document.getElementById(element);
    } else {
        var video = document.getElementById("video");
    }

    if (hide) HIDETRACKS(element);
    if (cue == 0) return;
    if (!video) return;
    var track = video.addTextTrack("captions", "English", "en");
    if (!track) return;
    var time = parseInt(video.currentTime);
    track.mode = "showing";
    track.addCue(new VTTCue(time, time + 2, cue || "..."));
};

function SETREC(status, element) {
    if (!status) status = "none";
    if (element) {
        var video = document.getElementById(element);
    }
    if (video) video.style.display = status;
}