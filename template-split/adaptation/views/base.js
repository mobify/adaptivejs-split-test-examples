define([
    '$',
    'resizeImages',
    'adaptivejs/utils',
    'adaptivejs/defaults',
    'includes/_header',
    'includes/_footer',
    'dust!templates/base',
    'settings'
],
function($, ResizeImages, Utils, Defaults, header, footer, template, Settings) {

    /**
     * Grab the default cache breaker variable from the Mobify Config
     */
    if (ResizeImages && Settings) {
        ResizeImages.defaults.cacheBreaker = Settings.cacheBreaker;
    }

    /**
     *  Grabs the images which you would like to run through
     *  imageResizer and sends them away. Can be setup
     *  with more profiles for different types of images
     *  if needed.
     */
    var resizeImages = function() {
        var $imgs = $('img');
        var defaultOpts = {
            projectName: Defaults.projectName
        };

        ResizeImages.resize($imgs, defaultOpts);

        return $imgs;
    };

    return {
        template: template,
        includes: {
            header: header,
            footer: footer
        },
        /**
        * preProcess receives a context as a paramater and should return
        * that context with any modifications the user needs. This runs
        * before keys in `context` are executed
        */
        preProcess: function(context) {
            // Transforms should take place here rather then within `context`.
            // An example of a DOM transform:
            $('head').find('meta[name="viewport"]').remove();
            $('style, link[rel="stylesheet"]').remove();

            return context;
        },

        /**
        * postProcess receives a context as a paramater and should return
        * that context with any modifications the user needs. This runs
        * after keys in `context` are executed
        */
        postProcess: function(context) {
            // Transforms should take place here rather then within `context`.
            // An example of a DOM transform:
            context.desktopScripts = $('script').remove();

            // Uncomment the following line to use Mobify's image resizer:
            // resizeImages();

            return context;
        },
        context: {
            templateName: 'base',
            html: function() {
                return $('html');
            },
            head: function() {
                return $('head');
            },
            body: function() {
                return $('body');
            }
        }
    };
});
