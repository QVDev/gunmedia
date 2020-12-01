# WebRTCGunMedia - Multimedia through the Gun #

Demo: https://qvdev.github.io/gunmedia/

* Submit the room name in the prompt.
* Send the link or the room name to a peer.
* Chat with eachother with audio and video through the Gun.

This WebRTC system attempts to apply the WebRTC Gun to transmit uncompressed audio and video between peer-browsers.

The system attempts to mimic how current music collaboration tools transmit audio over IP-nettworks, i.e. uncompressed and unbuffered. The aim is to achieve an audio connection with lower delay (and higher quality) compared to the standard audio channel in WebRTC. 

## Installation Guide ##
```sh
python -m SimpleHTTPServer 8000
```

Then open http://localhost:8000 to see your app. <br>

## The system ##
The system consists of a client.

### Client ###
After loading the client page requires "vanilla" selection of a room name (of the user choice). When two clients have join a room, audio may be exchanged.

  * Batch forwarding: A peer may record an audio clip and forward to the other peer. Receiveing peer may play out the clip.
  * Realtime: A peer may initiate a live audiostream
  
All audio is forwarded across the WebRTC Gun.

Client JavaScript-code is in `js/main.js`.

## Status ##
  
The system is **very much under development**, and currently not fully implemented.
