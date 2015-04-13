define([
    'lib/viewMocker',
    'views/home',
    'text!fixtures/home.html'
],
function(test, view, fixture) {
    /*
     * Example of a test using HTML file fixtures in conjunction with the processed context.
     *
     * This is the preferred way.
     */
    test('Home view context', view, fixture, {
        /**
         * This is from our document fragment
         */
        'context contains the correct template name': function($, context) {
            var templateName = context.templateName;
            assert.equal(templateName, 'home', 'home context has correct template name');
        },

        /*
         * This is from within the Home template
         */
        'context.header property contains the title': function($, context) {
            var title = context.header.title;
            assert.equal(title, 'Home test');
        }
    });

    /**
     * Example of tests using DOM selections. Selections are made against the fully
     * adapted DOM, when our mobile templates are rendered.
     */
    test('Home view DOM', view, fixture, {
        'adaptation adds the correct template class': function($) {
            var $root = $('#x-root');

            assert.isTrue($root.hasClass('t-home'), 'x-root has class t-home');
        }
    });
});
