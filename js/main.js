'use strict';

//
// Audio worker node forwarding audio data uncompressed onto a data channel
//
class AudioSampleQueue {
  // Queue class for 32bit float audio samples
  constructor(maxqueuelength = 1024) {
    this.maxQueueLength = maxqueuelength;
    this.queue = new Float32Array(this.maxQueueLength);
    this.front = 0;
    this.end = 0;
    this.empty = true;
  }

  enqueue(sample) {
    // Insert sample at end of queue
    if (this.length() == this.maxQueueLength) {
      // console.log("Queue is full.")
    } else {
      this.queue[this.end] = sample;
      this.end = (this.end + 1) % this.maxQueueLength;
      this.empty = false;
    }
  }

  dequeue() {
    // Remove and return sample from front of queue
    if (this.length() > 0) {
      var sample = this.queue[this.front];
      this.front = (this.front + 1) % this.maxQueueLength;
      this.empty = (this.front == this.end);
      return sample;
    }
    // console.log("Queue is empty (" + this.front + ")");
    return null;
  }

  length() {
    // Return length of queue
    if (this.empty) {
      return 0;
    }
    var l = (this.end - this.front + this.maxQueueLength) % this.maxQueueLength;
    return l == 0 ? this.maxQueueLength : l;
  }
}

var configuration = null;
var localStream;

// HTML elements //
var localAudio = document.querySelector('#localAudio');
var remoteAudio = document.querySelector('#remoteAudio');
var localVideo = document.querySelector('#localVideo');
var videoBtn = document.querySelector('#videoBtn');
var stopVideoBtn = document.querySelector('#stopVideoBtn');
var liveBtn = document.querySelector('#liveBtn');
var stopLiveBtn = document.querySelector('#stopLiveBtn');
var recordBtn = document.getElementById('recordBtn');
var stopBtn = document.getElementById('stopBtn');
var compressionSlider = document.getElementById('compressionSlider');
var localClips = document.querySelector('.local-clips');
var remoteClips = document.querySelector('.remote-clips');
var notifications = document.querySelector('#notifications');
var bytesSentTxt = document.querySelector('#bytesSent');
var bytesReceivedTxt = document.querySelector('#bytesReceived');
var liveAudio = document.querySelector('#liveAudio');
var dataChannelNotification = document.getElementById('dataChannelNotification');
var liveAudioNotification = document.createElement('p');
liveAudioNotification.className = "notifications";

// Photo context variables for video grab data
// remoteCanvas is a canvas with continously an updated photo-context to make a video
var remoteCanvas = document.getElementById('remoteCanvas');
var localCanvas = document.getElementById('localCanvas');
var remoteContext = remoteCanvas.getContext('2d');
var localContext = localCanvas.getContext('2d');
var photoContextW;
var photoContextH;
var bytesReceived = 0;
var bytesSent = 0;
var jpegQuality = (document.getElementById("compressionNumber").innerHTML) / 100;
var framePeriod = document.getElementById("frameperiodNumber").innerHTML;
var scale = (document.getElementById("scaleNumber").innerHTML) / 100;
var remoteScale;

// Peerconnection and data channel variables
var liveDataChannel;
var clipDataChannel;
var videoDataChannel;

// Audio buffer variables
var bufferSize = document.getElementById('bufferSizeSelector').value;
console.log(bufferSize);
var txrxBufferSize = bufferSize * 10;
var peerCon;
var output1 = new AudioSampleQueue(txrxBufferSize);
var output2 = new AudioSampleQueue(txrxBufferSize);

// Audio context variables
var audioContext;
var audioContextSource;
var scriptNode;

// isInitiator is the one who's creating the room
var isInitiator;

// Check if the room is in the URL, if not - promp the user to type in a room name.
var room = window.location.hash.substring(1);
if (!room) {
  // room = window.location.hash = prompt('Enter a room name:');
}

var sender = receiveVideoData()
var audio = receiveLiveData();
// const gun = Gun('https://gunptt.herokuapp.com/gun');

var opt = { peers: ['https://gunptt.herokuapp.com/gun'], localStorage: false, radisk: false };
const gun = Gun(opt);

gun.on("in", function (msg) {
  if (msg.type == "video") {
    sender(msg);
  } else if (msg.type == "audio") {
    audio(msg)
  }
})

function send(data) {
  // data.socketId = self.socketId;
  // data.pid = self.root._.opt.pid;
  // data.room = self.room;
  gun.on("out", {
    type: data.type,
    data: data.data
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
    video: { width: 480, height: 320, frameRate: { ideal: 24, max: 30 } }
  })
    .then(gotStream)
    .catch(function (e) {
      alert('Error: ' + e.name);
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
    remoteCanvas.width = photoContextW;
    remoteCanvas.height = photoContextH;
    console.log('gotStream with with and height:', photoContextW, photoContextH);
    liveBtn.disabled = false;
    videoBtn.disabled = false;
    scaleSlider.disabled = false;
  };
  localContext.save();
  videoBtn.onclick = function () {
    videoBtn.disabled = true;
    stopVideoBtn.disabled = false;
    localContext.scale(scale, scale);
    localCanvas.width = photoContextW * scale;
    localCanvas.height = photoContextH * scale;
    scaleSlider.disabled = true;
    // Using photo-data from the video stream to create a matching photocontext
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      // The API is supported!
      console.info("using request video frame callback")
      localVideo.requestVideoFrameCallback(updateVideo)
      localVideo.play();
    } else {
      draw();
    }

  }
  // Live video code ends

  // Live audio starts
  printBitRate();
  liveBtn.onclick = function () {
    liveBtn.disabled = true;
    stopLiveBtn.disabled = false;
    document.getElementById('bufferSizeSelector').disabled = true;
    startBuffer();
    audioContextSource.connect(scriptNode);
    scriptNode.connect(audioContext.destination);
    sendMessage('startLive');
  }

  stopLiveBtn.onclick = function () {
    audioContextSource.disconnect(scriptNode);
    scriptNode.disconnect(audioContext.destination);
    liveBtn.disabled = false;
    stopLiveBtn.disabled = true;
    sendMessage('stopLive');
    audioContext.close();
    document.getElementById('bufferSizeSelector').disabled = false;
  }
  // Live audio ends

  // MediaRecorder starts
  // chromium: mimeType audio/webm
  // firefox: mimeType audio/ogg
  // var mediaRecorder = new MediaRecorder(localStream,  {mimeType : 'audio/webm; codecs=opus'});
  var mediaRecorder = new MediaRecorder(localStream);
  var chunks = [];
  recordBtn.disabled = false

  recordBtn.onclick = function () {
    recordBtn.disabled = true;
    stopBtn.disabled = false;

    mediaRecorder.start();
    console.log(mediaRecorder.state);
  }

  stopBtn.onclick = function () {
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    mediaRecorder.stop();
  }

  mediaRecorder.onstop = function (e) {
    console.log("data available after MediaRecorder.stop() called.");
    var blob = new Blob(chunks, { 'type': 'audio/ogg; codecs=opus' });
    saveAudioClip(blob);
    chunks = [];
  }

  mediaRecorder.ondataavailable = function (e) {
    chunks.push(e.data);
    console.log(e.data);
  }
  // MediaRecorder ends

}

/*
// Receives live audio stream throigh data channel
*/
function receiveLiveData() {
  return function onmessage(event) {
    var decoded = decode(event.data);
    var remoteAudioBuffer = new Float32Array(decoded);
    for (var sample = 0; sample < remoteAudioBuffer.length; sample++) {
      output1.enqueue(remoteAudioBuffer[sample]);
      output2.enqueue(remoteAudioBuffer[sample]);
    }
    bytesReceived += remoteAudioBuffer.length * 4;
  }
}

/*
// Receives audio clip
*/
function receiveClipData() {
  return function onmessage(event) {
    var data = new Uint8ClampedArray(event.data);
    var blob = new Blob([data], { 'type': 'audio/ogg; codecs=opus' });
    receiveAudio(blob);
  }
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
          renderPhoto(buf);
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

// dataChannel.send(data), data gets received by using event.data
// Sending a blob through RTCPeerConnection is not supported. Must use an ArrayBuffer?
function sendData(blob) {
  var fileReader = new FileReader();
  var arrayBuffer;

  fileReader.onloadend = () => {
    arrayBuffer = fileReader.result;
    console.log(arrayBuffer);
    clipDataChannel.send(arrayBuffer);
  }

  fileReader.readAsArrayBuffer(blob);
}

function saveAudioClip(audioblob) {
  var clipName = prompt('Enter a name for your sound clip?', 'My unnamed clip');
  console.log(clipName);
  var clipContainer = document.createElement('article');
  var clipLabel = document.createElement('p');
  var audio = document.createElement('audio');
  var deleteButton = document.createElement('button');
  var sendButton = document.createElement('button');

  clipContainer.classList.add('clip');
  audio.setAttribute('controls', '');
  deleteButton.textContent = 'Delete';
  deleteButton.className = 'deleteBtn';
  sendButton.textContent = 'Send';
  sendButton.className = 'sendBtn'

  if (clipName === null) {
    clipLabel.textContent = 'My unnamed clip';
  } else {
    clipLabel.textContent = clipName;
  }

  clipContainer.appendChild(audio);
  clipContainer.appendChild(clipLabel);
  clipContainer.appendChild(deleteButton);
  clipContainer.appendChild(sendButton);
  localClips.appendChild(clipContainer);

  audio.controls = true;
  var audioURL = window.URL.createObjectURL(audioblob);
  audio.src = audioURL;

  deleteButton.onclick = function (e) {
    var evtTgt = e.target;
    evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
  }

  sendButton.onclick = function (e) {
    sendData(audioblob);
  }
}

function receiveAudio(audioblob) {
  var clipContainer = document.createElement('article');
  var clipLabel = document.createElement('p');
  var audio = document.createElement('audio');
  var deleteButton = document.createElement('button');
  var clipName = remoteClips.children.length;

  clipContainer.classList.add('clip');
  audio.setAttribute('controls', '');
  deleteButton.textContent = 'Delete';
  deleteButton.className = 'deleteBtn';

  clipLabel.textContent = "Clip: " + clipName;

  clipContainer.appendChild(audio);
  clipContainer.appendChild(clipLabel);
  clipContainer.appendChild(deleteButton);
  remoteClips.appendChild(clipContainer);

  audio.controls = true;
  var audioURL = window.URL.createObjectURL(audioblob);
  audio.src = audioURL;

  deleteButton.onclick = function (e) {
    var evtTgt = e.target;
    evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
  }
}

//Runs the code when the Peer exits the page
window.onbeforeunload = function () {
  sendMessage('bye');
  liveDataChannel.close();
  clipDataChannel.close();
  videoDataChannel.close();
}

function logError(err) {
  console.log(err.toString(), err);
}

function startBuffer() {
  audioContext = new AudioContext();
  audioContextSource = audioContext.createMediaStreamSource(localStream);
  scriptNode = audioContext.createScriptProcessor(bufferSize, 2, 2);

  // Listens to the audiodata
  scriptNode.onaudioprocess = function (e) {

    /*
    // Using ScriptNodeProcessor to start audio
    */
    var input = e.inputBuffer.getChannelData(0);    
    var encoded = encode(input);
    send({ type: "audio", data: encoded })
    // audio({ type: "audio", data: encoded })
    bytesSent += input.length * 4;

    if (output1.length() == 0) {

    }
    else {
      var outputBuffer1 = e.outputBuffer.getChannelData(0);
      var outputBuffer2 = e.outputBuffer.getChannelData(1);
      for (var sample = 0; sample < bufferSize; sample++) {
        outputBuffer1[sample] = output1.dequeue();
        outputBuffer2[sample] = output2.dequeue();
      }
    }
  }
}

function changeBuffer() {
  bufferSize = document.getElementById('bufferSizeSelector').value;
  txrxBufferSize = bufferSize * 10;
  output1 = new AudioSampleQueue(txrxBufferSize);
  output2 = new AudioSampleQueue(txrxBufferSize);
  console.log(bufferSize);
}

function changeCompression(value) {
  document.getElementById("compressionNumber").innerHTML = value;
  jpegQuality = (document.getElementById("compressionNumber").innerHTML) / 100;
}

// Only changes the viewed scale in the HTML
function changeScaleView(value) {
  document.getElementById("scaleNumber").innerHTML = value;
}

// Changed the scale variable in the code and sends it to the other peer
function changeScaleInput(value) {
  localContext.restore();
  scale = (document.getElementById("scaleNumber").innerHTML) / 100;
  send({ type: "video", "data": "scale:" + scale });
}

function changeFrameperiod(value) {
  document.getElementById("frameperiodNumber").innerHTML = value;
  framePeriod = document.getElementById("frameperiodNumber").innerHTML;
}

// Sending image using dataURL
function sendImage() {
  var CHUNK_LEN = 6400;
  var imgUrl = localCanvas.toDataURL('image/jpeg', jpegQuality);

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
  console.log("sent:" + len);
}

// Render image using dataURL
function renderPhoto(dataUrl) {
  var img = new Image();
  img.src = dataUrl;
  img.onload = function () {
    remoteContext.drawImage(img, 0, 0, photoContextW, photoContextH);
  }
}

function draw() {
  localContext.drawImage(localVideo, 0, 0, localCanvas.width, localCanvas.height);
  sendImage();

  stopVideoBtn.onclick = function () {
    videoBtn.disabled = false;
    stopVideoBtn.disabled = true;
    scaleSlider.disabled = false;

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


// flag that will be sliped in the json string
const FLAG_TYPED_ARRAY = "FLAG_TYPED_ARRAY";

// // ENCODING ***************************************
// function encode(object) {
//   var jsonStr = JSON.stringify(object, function (key, value) {
//     // the replacer function is looking for some typed arrays.
//     // If found, it replaces it by a trio
//     if (value instanceof Float32Array) {
//       var replacement = {
//         constructor: value.constructor.name,
//         data: Array.apply([], value),
//         flag: FLAG_TYPED_ARRAY
//       }
//       return replacement;
//     }
//     return value;
//   });
//   return jsonStr;
// }

// function decode(jsonStr) {
//   var decodedJson = JSON.parse(jsonStr, function (key, value) {
//     // the reviver function looks for the typed array flag
//     try {
//       if ("flag" in value && value.flag === FLAG_TYPED_ARRAY) {
//         // if found, we convert it back to a typed array
//         return new context[value.constructor](value.data);
//       }
//     } catch (e) { }

//     // if flag not found no conversion is done
//     return value;
//   });
//   return decodedJson;
// }

function encode(fary) {
  // ENCODING TEST
  let uint = new Uint8Array(fary.buffer);
  let str = btoa(String.fromCharCode.apply(null, uint)); //btoa( String.fromCharCode( ...uint ) );
  return str;

}

function decode(str) {
  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // DECODE TEST
  let blob = atob(str);

  let ary_buf = new ArrayBuffer(blob.length);
  let dv = new DataView(ary_buf);
  for (let i = 0; i < blob.length; i++) dv.setUint8(i, blob.charCodeAt(i));
  return ary_buf;
}

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// For WebGL Buffers, can skip Float32Array, just return ArrayBuffer is all thats needed.
