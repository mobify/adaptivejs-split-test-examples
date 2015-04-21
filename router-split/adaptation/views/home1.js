define([
    '$',
    'views/base',
    'dust!templates/home1'
],
function($, BaseView, Home1) {

    return {
        template: Home1,
        extend: BaseView,
        context: {
            templateName: 'home1',
            variation: 'variation 1',
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
