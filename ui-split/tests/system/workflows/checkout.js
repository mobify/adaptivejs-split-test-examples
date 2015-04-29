
module.exports = {
    'setUp': function(browser) {
        browser.preview()
    },

    'Checkout test': function(browser) {
        // Workflows such as a shopping cart checkout go here
        browser
            .verify.elementPresent('#x-root')
            .end();
    }
}
