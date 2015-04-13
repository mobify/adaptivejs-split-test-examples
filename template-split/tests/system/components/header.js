
module.exports = {
    'setUp': function(browser) {
        browser.preview()
    },

    'Header test': function(browser) {
        // Resuable component tests go here
        // Change to the selector for your header
        browser
            .verify.elementPresent('.t-header')
            .end();
    }
}
