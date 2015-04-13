require(['config'], function(){
    require(['require',
             'chai',
             'chaiPlugin/assertions',
             'mocha'],
    function(require, chai, customAssertions, mocha){

        var tests = [
            'tests/integration/homeTest'
        ];

        require(tests, function() {
            global.assert       = chai.assert;
            global.expect       = chai.expect;

            chai.use(customAssertions);

            if (window.mochaPhantomJS) {
                return window.mochaPhantomJS.run();
            }
            mocha.run();
        });
    });
});
