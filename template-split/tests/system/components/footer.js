
module.exports = {
    'setUp': function(browser) {
        browser.preview()
    },

    'Footer test': function(browser) {
        // Resuable component tests go here
        // Change to the selector for your footer
        browser
            .verify.elementPresent('.t-footer')
            .end();
    }
}
