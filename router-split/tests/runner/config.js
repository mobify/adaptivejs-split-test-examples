require.config({
    baseUrl: '../../',
    paths: {
        'adaptivejs': 'node_modules/adaptivejs/src',
        'lib': 'node_modules/adaptivejs/lib',
        'buildConfig': 'build/buildConfig',
        'chai': 'node_modules/chai/chai',
        'chaiPlugin': 'node_modules/mobify-chai-assertions',
        'devSettings': 'adaptation/devSettings',
        'documentFactory': 'node_modules/adaptivejs/lib/documentFactory',
        'dust': 'node_modules/adaptivejs/lib/dust-requirejs',
        'dust-custom': 'node_modules/adaptivejs/lib/dustPatch',
        'dust-core': 'bower_components/dustjs-linkedin/dist/dust-core',
        'dust-full': 'bower_components/dustjs-linkedin/dist/dust-full',
        'fixtures': 'tests/fixtures',
        'includes': 'adaptation/views/includes',
        'json': 'node_modules/adaptivejs/bower_components/requirejs-plugins/src/json',
        'mobifyjs': 'node_modules/adaptivejs/node_modules/mobifyjs/src',
        'mobifyjs/utils': 'node_modules/adaptivejs/node_modules/mobifyjs-utils/utils',
        'mocha': 'node_modules/mocha/mocha',
        'package': 'package.json',
        'resizeImages': 'bower_components/imageresize/resizeImages',
        'router': 'adaptation/router',
        'baseSelectorLibrary': 'vendor/zepto',
        '$': 'node_modules/adaptivejs/src/selectorLibrary',
        'settings': 'node_modules/adaptivejs/lib/settings',
        'templates': 'adaptation/templates',
        'text': 'node_modules/adaptivejs/bower_components/requirejs-plugins/lib/text',
        'views': 'adaptation/views',
        'utils': 'adaptation/utils',
        'lodash': 'node_modules/lodash/dist/lodash'
    },
    'shim': {
        'mocha': {
            init: function() {
                this.mocha.setup('bdd');
                return this.mocha;
            }
        },
        'dust-core': {
            'exports': 'dust'
        },
        'dust-full': {
            'exports': 'dust'
        },
        'baseSelectorLibrary': {
            'exports': '$'
        }
    }
});
