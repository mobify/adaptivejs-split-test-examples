
module.exports = function(grunt) {
    return {
        options: {
            browsers: ['iOS >= 6.0', 'Android >= 2.3', 'last 4 ChromeAndroid versions']
        },
        multiple_files: {
            flatten: true,
            src: 'build/css/*.css'
        }
    };
};
