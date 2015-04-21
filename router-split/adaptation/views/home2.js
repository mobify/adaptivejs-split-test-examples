define([
    '$',
    'views/base',
    'dust!templates/home2'
],
function($, BaseView, Home2) {

    return {
        template: Home2,
        extend: BaseView,
        context: {
            templateName: 'home2',
            variation: 'variation 2',
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
