define([
    '$',
    'views/base',
    'split-test',
    'dust!templates/home1',
    'dust!templates/home2',
    'dust!templates/home3'
],
function($, BaseView, SplitTest, home1, home2, home3) {
    var template;
    var splitTest = SplitTest.init({
        'home1': 0.2,
        'home2': 0.6,
        'home3': 0.2
    }, {
        namespace: 'mobify',
        lifetime: 15 * 24 * 3600 // 15 days in seconds
    });

    var choice = splitTest.getChoice();

    if (choice === 'home1') {
        template = home1;
    } else if (choice === 'home2') {
        template = home2;
    } else {
        template = home3;
    }

    return {
        template: template,
        extend: BaseView,
        context: {
            templateName: 'home',
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
