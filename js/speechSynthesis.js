function Talk() {
    if ('speechSynthesis' in window) {
        this.say = function (text) {
            var utterance = new SpeechSynthesisUtterance(text);
            utterance.voice = window.speechSynthesis.getVoices()[49];
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        }

        console.log("speechSynthesis is available.");
    } else {
        console.log("speechSynthesis is not available.");
    }
}