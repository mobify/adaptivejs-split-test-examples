define([
    '$',
    'views/base',
    'dust!templates/home',
],
function($, BaseView, Template) {

    return {
        template: Template,
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
