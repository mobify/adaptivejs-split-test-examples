require.config({
    'baseUrl': '.',
    'keepBuildDir': true,
    'paths': {
        'buildConfig': '../build/buildConfig',
        'translator': 'i18n/translator',
        'includes': 'views/includes',
        'libs': '../bower_components',
        'package': '../package.json',
        'resizeImages': '../bower_components/imageresize/resizeImages',
        'baseSelectorLibrary': '../vendor/zepto',
        'split-test': '../bower_components/split-test/dist/split-test'
    },
    'shim': {
        'baseSelectorLibrary': {
            'exports': '$'
        }
    }
});
