require([
    'router',
    'adaptivejs/adaptive',
    'adaptivejs/view',
    'adaptivejs/utils',
    'adaptivejs/defaults'
],
function(router, Adaptive, View, Utils, Defaults) {

    Adaptive.init(function(capturedDocument) {
        try {
            var view = router.resolve(capturedDocument);
            if (!view) {
                console.error('No routes were matched. Rendering original document.');
                Adaptive.restore();
                return;
            }

            // Make any changes to defaultContext here, then add it to view.context
            var defaultContext = Defaults.getContext();

            // Build up context of the main view
            var resultContext = View.evaluateContext(view, defaultContext);

            // Feed context to template and render result
            view.template(resultContext, function(err, out) {
                Adaptive.renderPage(out);
            });
        } catch (e) {
            console.error(e.stack);
            Adaptive.restore();
        }
    });

}, undefined, true);
// relPath, forceSync
