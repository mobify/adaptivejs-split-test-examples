define([
    '$',
    'hijax',
    'split-test'
],
function($, Hijax, SplitTest) {
    var hijax = new Hijax();

	var splitTest = SplitTest.init({
        'list': 0.4,               // 40% of traffic sees variation 1
        'tile': 0.6,             // 60% of traffic sees variation 2
    }, {
        namespace: 'mobify',        // make sure we don't have cookie name conflict
        lifetime: 15 * 24 * 3600    // cookie will expire in 15 days represented in seconds
    });

    var choice = splitTest.getChoice();

    // Send split test analytic choice
    Mobify.analytics.ua('mobifyTracker.set', 'dimension5', choice);
    Mobify.analytics.ua('mobifyTracker.send', 'event', 'Mobify', 'SplitTest', {'nonInteraction': 1});

	var getProductTiles = function () {
        hijax
            .set(
                'product-tiles',
                function (url) {
                    return /productTiles/.test(url);
                },
                {
                    complete: function(data, xhr) {
                        $('.c-product-tiles').addClass('c--' + choice);
                    }
                }
            );
	};

    var homeUI = function() {
        // Add any scripts you would like to run only on the home page here
        getProductTiles();

        // simulating an ajax request
        $.ajax({
            url: 'http://localhost:8080/js/productTiles.txt',
            complete: function (data) {
                $('.c-product-tiles').append(data.response);
            }
        });
    };

    return homeUI;
});
