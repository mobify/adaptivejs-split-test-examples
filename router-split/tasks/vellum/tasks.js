module.exports = function(grunt) {

    ['contrib-sass', 'autoprefixer']
        .forEach(function(name) {
            grunt.loadNpmTasks('grunt-' + name);
        });

    grunt.registerTask('vellum_build_dev',  ['adaptive-ensure_sass_exists_for_vellum', 'sass:dev',  'autoprefixer']);
    grunt.registerTask('vellum_build_prod', ['adaptive-ensure_sass_exists_for_vellum', 'sass:prod', 'autoprefixer']);
    grunt.registerTask('vellum_build', ['vellum_build_dev']);
};
