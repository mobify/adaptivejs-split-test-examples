
module.exports = function(grunt) {
    grunt.registerTask('nightwatch', function () {
        var callback = this.async();

        grunt.util.spawn({
                cmd: 'node',
                args: [].concat(['node_modules/nightwatch/bin/runner.js', '-c', 'tests/system/nightwatch.json'], grunt.option.flags()),
                opts: {stdio: 'inherit'}
            },
            function(error, result, code) {
                if (code !== 0) {
                    grunt.fail.fatal('Tests failed', code);
                }
                callback();
            });
    });

    grunt.registerTask('nightwatch-parallel', function () {
        var callback = this.async();
        grunt.util.spawn({
            cmd: 'node',
            args: [].concat(['node_modules/nightwatch/bin/runner.js', '-c', 'tests/system/nightwatch.json', '-e', 'workflows,components,pages'], grunt.option.flags()),
            opts: {stdio: 'inherit'}
        },
        function(error, result, code) {
            if (code !== 0) {
                grunt.fail.fatal('Tests failed', code);
            }
            callback();
        });
    });
};