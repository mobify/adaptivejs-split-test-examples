define([
    '$',
    'views/base',
    'split-test',

    // Template variations
    'dust!templates/home1',
    'dust!templates/home2',
    'dust!templates/home3'
],
function($, BaseView, SplitTest) {
    var splitTest = SplitTest.init({
        'home1': 0.2,
        'home2': 0.6,
        'home3': 0.2
    }, {
        namespace: 'mobify',
        lifetime: 15 * 24 * 3600 // 15 days in seconds
    });

    var choice = splitTest.getChoice();

    return {
        template: require('dust!templates/' + choice),
        extend: BaseView,
        context: {
            templateName: 'home',
            variation: choice,
            firstp: function() {
                return $('p').first().text() || 'Could not find the first paragraph text in your page';
            }
        }

        /**
         * If you wish to override preProcess/postProcess in this view, have a look at the documentation:
         * https://cloud.mobify.com/docs/adaptivejs/views/
         */
    };
});
