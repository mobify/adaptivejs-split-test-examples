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
        'home1': 0.2,               // 20% of traffic sees home1 variation
        'home2': 0.6,               // 60% of traffic sees home2 variation
        'home3': 0.2                // 20% of traffic sees home3 variation
    }, {
        namespace: 'mobify',        // make sure we don't have cookie name conflict
        lifetime: 15 * 24 * 3600    // cookie will expire in 15 days represented in seconds
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
