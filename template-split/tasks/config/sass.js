
module.exports = function(grunt) {
    return {
        prod: {
            options: {
                bundleExec: true,
                style: 'compressed',
                sourcemap: 'none',
                loadPath: [
                    './',
                    'bower_components/'
                ]
            },
            files: [
                {
                    expand: true,
                    cwd: 'assets/styles',
                    src: ['*.scss'],
                    dest: 'build/css',
                    ext: '.css'
                }
            ]
        },
        dev: {
            options: {
                bundleExec: true,
                style: 'expanded',
                sourcemap: 'auto',
                loadPath: [
                    './',
                    'bower_components/'
                ]
            },
            files: [
                {
                    expand: true,
                    cwd: 'assets/styles',
                    src: ['*.scss'],
                    dest: 'build/css',
                    ext: '.css'
                }
            ]
        }
    };
};
