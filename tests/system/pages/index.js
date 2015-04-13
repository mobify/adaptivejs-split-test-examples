
module.exports = {
    'setUp': function(browser) {
        browser.preview()
    },

    'Index test': function(browser) {
        // Page level tests go here, product index, PDP, etc
        // Change to the selector for your header
        browser
            .verify.elementPresent('#x-root')
            .end();
    }
}
