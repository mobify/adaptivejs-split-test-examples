module.exports = function(grunt) {
    return {
        css: {
            files: '**/*.scss',
            tasks: ['vellum_build_dev']
        }
    };
};
