var audioBridge = (function () {

  var lastTimeStamp = new Date().getTime();
  var initial = true;

  function init() {
    gun.get('audio').get(room).on(function (data, room) {

      if (initial) {
        initial = false;
        return;
      }

      if (lastTimeStamp == data.timestamp) {
        return;
      }
      lastTimeStamp = data.timestamp;

      if (data.user == gun._.opt.pid) {
        return;
      }

      audioReceiver.receive(data)
    })
  }

  function sendToGun(data) {
    data.type = "audio"
    send(data);
    // gun.get('audio').get(room).put(data);
  }

  return {
    init: init,
    send: sendToGun
  };

})();
