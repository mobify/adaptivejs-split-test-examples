define([
    '$',
    'fastclick',
    'deckard'
],
function($, fastclick) {
    var globalUI = function() {
        fastclick.attach(document.body);

        // Add any scripts you would like to run on ALL pages here
    };

    return globalUI;
});
