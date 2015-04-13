'use strict'

var path = require('path');

module.exports = function(grunt) {
    var _ = grunt.util._;

    grunt.loadNpmTasks('adaptivejs');

    // By default, we load all local tasks from the tasks directory.
    grunt.file.expand('tasks/*').forEach(function(task) {
        grunt.loadTasks(task);
    });

    var configPaths = [
        'node_modules/adaptivejs/tasks/config/*',
        'tasks/config/*'
    ];

    // Populate the config object
    var config = {};
    grunt.file.expand(configPaths).forEach(function(configPath) {
        // Get the grunt-task name to put in the config which is based on the
        // name of the config file
        var configName = configPath.match(/\/([^\/]*)\.js/)[1];
        var option = require(path.join(__dirname + '/' + configPath))(grunt);
        config[configName] = _.extend(config[configName] || {}, option);
    });

    // We hash each file inside of build/assets in order to do cache busting
    // *only* when the file changes. If you have files/folders that you want
    // to hash that aren't in build/assets, add them here:
    config.cachebuster.assets.src.push(
        'build/bower_components/deckard/dist/deckard.min.js'
    );

    grunt.initConfig(config);

    grunt.registerTask('build_dev', ['clean','lint:dev','vellum_build_dev','adaptive-build_dev']);
    grunt.registerTask('build_prod', ['clean','lint:prod','vellum_build_prod','adaptive-build_prod']);
    grunt.registerTask('preview', ['build_dev','adaptive-preview']);
    grunt.registerTask('push', ['clean','lint:prod','vellum_build_prod','adaptive-push']); 
    grunt.registerTask('test', ['build_dev', 'adaptive-test']);
    grunt.registerTask('test_skip_build', ['adaptive-test']);
    grunt.registerTask('test_browser', ['build_dev', 'adaptive-test_browser']);
};
