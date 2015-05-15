module.exports = function (grunt) {
    'use strict';

    // Project configuration
    grunt.initConfig({
        // Metadata
        pkg: grunt.file.readJSON('package.json'),
        'closure-compiler': {
            tag: {
                closurePath: 'lib',
                js: 'public/js/tag.js',
                jsOutputFile: 'public/js/tag.exposed.min.js',
                maxBuffer: 500,
                noreport: true,
                options: {
                    compilation_level: 'SIMPLE_OPTIMIZATIONS',
                    language_in: 'ECMASCRIPT5_STRICT'
                }
            },
            prod: {
                closurePath: 'lib',
                js: 'public/js/tag.js',
                jsOutputFile: 'public/js/tag.min.js',
                maxBuffer: 500,
                noreport: true,
                options: {
                    compilation_level: 'ADVANCED_OPTIMIZATIONS',
                    language_in: 'ECMASCRIPT5_STRICT',
                    define: [
                        '"accept_const_keyword"',
                        '"define EXPOSE=false"',
                        '"js tag/v7.js"',
                        '"use_types_for_optimization"'
                    ]
                }
            }
        },
        watch: {
            tag: {
                files: '**/js/tag.js',
                tasks: ['closure-compiler:tag', 'closure-compiler:prod'],
                options: {
                    livereload: true
                }
            }
        }
    });

    // These plugins provide necessary tasks
    //grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-closure-compiler');

    // Default task
    grunt.registerTask('default', ['jshint', 'qunit', 'concat', 'closure-compiler:tag']);
    grunt.registerTask('prodTag', ['jshint', 'qunit', 'concat', 'closure-compiler:prod']);
};

