define([
    'adaptivejs/i18n',
    'text!i18n/dictionary.json'
], function(I18n, dictionary) {

    var translator = new I18n('en-CA', dictionary);
    return translator;
});
