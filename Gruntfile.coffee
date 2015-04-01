module.exports = (grunt) ->
  
  grunt.initConfig
    pkg: grunt.file.readJSON("package.json")
    currentBuild: null
    browserify:
      basic:
        src: ["./src/assetManager.coffee:asset-manager"]
        dest: "lib/asset-manager.js"
        options:
          transform: ["coffeeify"]
          external: ["path", "url", "composite-detect", "q", "minilog"]
          alias: ["./src/assetManager.coffee:asset-manager"]
    coffee:
      coffee_to_js:
        options:
          bare: true
          sourceMap: true
        expand: true
        flatten: true
        cwd: "src"
        src: ["**/*.coffee"]
        dest: 'dist'
        ext: ".js"

    bump:
      options:
        files: ['package.json','bower.json']
        updateConfigs: []
        commit: true
        commitMessage: 'Release of v%VERSION%'
        commitFiles: ['package.json','bower.json'] # '-a' for all files
        createTag: true
        tagName: '%VERSION%'
        tagMessage: 'Version %VERSION%'
        push: false
        pushTo: 'upstream'
        gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d' #options to use with '$ git describe'

  grunt.loadNpmTasks "grunt-browserify"
  grunt.loadNpmTasks "grunt-bump"
  grunt.loadNpmTasks('grunt-contrib-coffee');

  # Task(s).
  grunt.registerTask "build-browser-lib", ["browserify"]
  grunt.registerTask "build-dist", ["coffee"]
