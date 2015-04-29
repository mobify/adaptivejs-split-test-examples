define([], function() {
    /**
     * WARNING:
     * The following object will only be used during local development.
     * When creating the production build, it will be stripped out,
     * and on the Mobify Cloud, production setting will be injected.
     */
    return {
        cacheBreaker: 11235813 // ensure this is an integer value,
    };
});
