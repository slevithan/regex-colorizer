module.exports = function(grunt) {
     grunt.initConfig({
          pkg: grunt.file.readJSON('package.json'),
          uglify: {
               options: {
                    banner: ''
               },
               build: {
                    src: 'regex-colorizer.js',
                    dest: 'regex-colorizer.min.js'
               }
          },
          cssmin: {
               themes: {
                    files: [{
                         expand: true,
                         cwd: 'themes/',
                         src: ['*.css', '!*.min.css'],
                         dest: 'themes/',
                         ext: '.min.css'
                    }]
               }
          },
          jshint: {
               all: ['Gruntfile.js', 'regex-colorizer.js']
          }
     });

     grunt.loadNpmTasks('grunt-contrib-uglify');
     grunt.loadNpmTasks('grunt-contrib-cssmin');
     grunt.loadNpmTasks('grunt-contrib-jshint');

     grunt.registerTask('default', ['uglify', 'cssmin']);
};