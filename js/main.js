'use strict';

var configuration = null;
var localStream;

// HTML elements //
var localAudio = document.querySelector('#localAudio');
var localVideo = document.querySelector('#localVideo');
var videoBtn = document.querySelector('#videoBtn');
var bytesSentTxt = document.querySelector('#bytesSent');
var bytesReceivedTxt = document.querySelector('#bytesReceived');

// Photo context variables for video grab data
var localCanvas = document.getElementById('localCanvas');
var localContext = localCanvas.getContext('2d');
var photoContextW;
var photoContextH;
var bytesReceived = 0;
var bytesSent = 0;
var jpegQuality = 50 / 100;
var framePeriod = 30;
var scale = 30 / 100;
var remoteScale;

var speech = new Speech();
var talk;

var sender = receiveVideoData()

var opt = { peers: ['https://gunptt.herokuapp.com/gun'], localStorage: false, radisk: false };
const gun = Gun(opt);

gun.on("in", function (msg) {
  if (msg.id == gun._.opt.pid) {
    return
  }

  getRemoteVideo(msg.id);

  if (msg.type == "video") {
    sender(msg);
  } else if (msg.type == "audio") {
    audio(msg)
  } else if (msg.type == "caption") {
    SETCLUE(msg.data, "remoteVideo", 1);
    if (msg.isFinal && talk !== undefined) {
      talk.say(msg.data);
    }
  } else if (msg.type = "msg") {
    console.log(msg);
    if (msg.data == "bye") {
      removeRemoteVideo(msg.id)
    }
  }
})

function removeRemoteVideo(id) {
  var remoteCanvas = document.getElementById(`${id}-canvas`)
  if (remoteCanvas !== undefined) {
    remoteCanvas.parentNode.removeChild(remoteCanvas);
  }
}

function getRemoteVideo(id) {
  var remoteCanvas = document.getElementById(`${id}-canvas`)
  if (remoteCanvas == undefined) {
    remoteCanvas = document.createElement('canvas');
    remoteCanvas.id = `${id}-canvas`;
    remoteCanvas.width = 480;
    remoteCanvas.height = 320;

    var videoContainer = document.getElementById("videoContainer");
    videoContainer.appendChild(remoteCanvas);
  }
}

function send(data) {
  gun.on("out", {
    type: data.type,
    data: data.data,
    isFinal: data.isFinal,
    id: gun._.opt.pid
  });
}

getMedia();

/****************************************************************************
* User media (audio and video)
****************************************************************************/

function getMedia() {
  console.log('Getting user media (audio) ...');
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: { width: 480, height: 320, frameRate: { ideal: 24, max: 30 }, facingMode: 'environment' }
  })
    .then(gotStream)
    .catch(function (e) {
      alert('Error: ' + e);
    });
}

function gotStream(stream) {
  console.log('Received local stream');
  localStream = stream;
  var audioTracks = localStream.getAudioTracks();
  var videoTracks = localStream.getVideoTracks();
  if (audioTracks.length > 0) {
    console.log('Using Audio device: ' + audioTracks[0].label);
    console.log('Using Video device: ' + videoTracks[0].label);
  }

  // Live video starts
  // var streamURL = window.URL.createObjectURL(stream);
  localVideo.srcObject = stream;

  localVideo.onloadedmetadata = function () {
    localCanvas.width = photoContextW = localVideo.videoWidth;
    localCanvas.height = photoContextH = localVideo.videoHeight;
    console.log('gotStream with witdh and height:', photoContextW, photoContextH);
    videoBtn.innerText = "GO LIVE";
  };

  localContext.save();
  videoBtn.onclick = function () {
    videoBtn.innerText = "STOP";
    localContext.scale(scale, scale);
    localCanvas.width = photoContextW * scale;
    localCanvas.height = photoContextH * scale;

    // Using photo-data from the video stream to create a matching photocontext
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      console.info("using request video frame callback")
      localVideo.requestVideoFrameCallback(updateVideo)
      localVideo.play();
    } else {
      draw();
    }
    initSpeech();
  }
  // Live video code ends

  function initSpeech() {
    speech.recognition.onstart = function () {
      console.log('Listening started...');
    }

    speech.recognition.onend = function () {
      console.log('Listening stopped.');
      // speech.startCapture();
    }
    speech.startCapture();
  }
  printBitRate();
}

/*
// Receives video stream (images)
*/
function receiveVideoData() {
  var buf = '';
  var bufEmpty = true;

  return function onmessage(event) {
    if (event.data.substring(0, 6) === 'scale:') {
      remoteScale = parseFloat(event.data.substring(6));
    }
    else {
      if (event.data.substring(0, 5) === 'data:') {
        if (!bufEmpty) {
          renderPhoto(buf, event.id);
          bufEmpty = true;
          buf = '';
        }
      }

      buf = buf.concat(event.data);
      bufEmpty = false;

      bytesReceived += event.data.length;
    }
  }
}

/****************************************************************************
* UI-related functions and ETC
****************************************************************************/


//Runs the code when the Peer exits the page
window.onbeforeunload = function () {
  send({ type: "msg", data: 'bye' })
}

function logError(err) {
  console.log(err.toString(), err);
}

// Sending image using dataURL
function sendImage() {
  var CHUNK_LEN = 6400;
  var imgUrl = localCanvas.toDataURL('image/webp', jpegQuality);

  var len = imgUrl.length;
  var n = len / CHUNK_LEN | 0;

  // console.log('Sending a total of ' + len + ' character(s)');
  // split the url and send in chunks of about 6,4KB
  for (var i = 0; i < n; i++) {
    var start = i * CHUNK_LEN,
      end = (i + 1) * CHUNK_LEN;
    send({ type: "video", "data": imgUrl.substring(start, end) });
  }

  if (len % CHUNK_LEN) {
    send({ type: "video", "data": imgUrl.substring(n * CHUNK_LEN) });
  }

  bytesSent += len;
}

// Render image using dataURL
function renderPhoto(dataUrl, id) {
  var img = new Image();
  img.src = dataUrl;
  img.onload = function () {
    var remoteContext = document.getElementById(`${id}-canvas`).getContext('2d');
    remoteContext.drawImage(img, 0, 0, photoContextW, photoContextH);
  }
}

function draw() {
  localContext.drawImage(localVideo, 0, 0, localCanvas.width, localCanvas.height);
  sendImage();

  videoBtn.onclick = function () {
    videoBtn.innerText = "GO LIVE";
    speech.stopCapture();

    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      localVideo.pause();
    } else {
      clearTimeout(keepSending);
    }
  }
  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {

  } else {
    var keepSending = setTimeout(draw, framePeriod);
  }
}

function updateVideo(now, metadata) {
  localVideo.requestVideoFrameCallback(updateVideo)
  draw();
}

function printBitRate() {
  bytesReceivedTxt.innerHTML = bytesReceived * 8;
  bytesSentTxt.innerHTML = bytesSent * 8;
  bytesReceived = 0;
  bytesSent = 0;
  setTimeout(printBitRate, 1000);
}
