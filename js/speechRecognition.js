function Speech() {
    if ('webkitSpeechRecognition' in window) {
        // creating voice capture object
        this.recognition = new webkitSpeechRecognition();

        // settings
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.startCapture = function () {
            this.recognition.start();
        }

        this.stopCapture = function () {
            this.recognition.stop();
        }

        this.previousText = "";
        this.recognition.onresult = function (event) {
            // console.log(`Interim::${event.results[event.resultIndex][0].transcript}`);
            SETCLUE(event.results[event.resultIndex][0].transcript, "localVideo", 1);
            send({ type: "caption", 
            data: event.results[event.resultIndex][0].transcript, 
            isFinal: event.results[event.resultIndex].isFinal })
            // if (event.results[event.resultIndex].isFinal) {
            //     talk.say(event.results[event.resultIndex][0].transcript);
            //     // console.log(`Final::${event.results[event.resultIndex][0].transcript}`);
            // }
        }

        this.recognition.onerror = function (event) {
            console.log(event.error);
            console.info("voice recognition error, restarting...");
            this.abort();
            try { this.start(); } catch (e) { console.log(e) }
        }

        this.recognition.onend = function () {
            console.info("voice recognition ended, restarting...");
            this.abort()
            try { this.start(); } catch (e) { console.log(e) }
        }

        console.log("webkitSpeechRecognition is available.");
    } else {
        console.log("webkitSpeechRecognition is not available.");
    }
}