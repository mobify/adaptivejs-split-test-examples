define([
    '$',
    'views/base',
    'dust!templates/home3'
],
function($, BaseView, Home3) {

    return {
        template: Home3,
        extend: BaseView,
        context: {
            templateName: 'home3',
            variation: 'variation 3',
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
