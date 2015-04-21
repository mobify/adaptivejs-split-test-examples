define([
    '$',
    'adaptivejs/router',
    'split-test',

    // View variations
    'views/home1',
    'views/home2',
    'views/home3'
],
function($, Router, SplitTest) {
    var router = new Router();

    var splitTest = SplitTest.init({
        'home1': 0.2,               // 20% of traffic sees home1 variation
        'home2': 0.6,               // 60% of traffic sees home2 variation
        'home3': 0.2                // 20% of traffic sees home3 variation
    }, {
        namespace: 'mobify',        // make sure we don't have cookie name conflict
        lifetime: 15 * 24 * 3600    // cookie will expire in 15 days represented in seconds
    });

    var choice = splitTest.getChoice();

    router
        .add(Router.selectorMatch('body'), require('views/' + choice));

    return router;
});
