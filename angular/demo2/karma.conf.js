// Karma configuration
// http://karma-runner.github.io/0.12/config/configuration-file.html
// Generated on 2015-03-25 using
// generator-karma 0.9.0

module.exports = function (config) {
    'use strict';

    config.set({
        preprocessors: {
            'monthPicker.html': ['ng-html2js']
        },
        ngHtml2JsPreprocessor: {
            moduleName: 'templates'
        },
        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: false,
        // base path, that will be used to resolve files and exclude
        basePath: '',
        // testing framework to use (jasmine/mocha/qunit/...)
        frameworks: ['jasmine-jquery', 'jasmine'],
        // list of files / patterns to load in the browser
        files: [
            // bower:js
            'assets/jquery.js',
            'assets/angular.js',
            'assets/bootstrap.js',
            'assets/angular-mocks.js',
            'monthPicker.js',
            'monthPicker.spec.js',
            'monthPicker.html',
            'alertService.js',
            'alertService.spec.js',
            'alertList.js',
            'alertList.spec.js'
        ],
        // list of files / patterns to exclude
        exclude: [
        ],
        // web server port
        port: 8080,
        // Start these browsers, currently available:
        // - Chrome
        // - ChromeCanary
        // - Firefox
        // - Opera
        // - Safari (only Mac)
        // - PhantomJS
        // - IE (only Windows)
        browsers: [
            'PhantomJS'
//               'Chrome'
        ],
        // Which plugins to enable
        plugins: [
            'karma-ng-html2js-preprocessor',
            'karma-phantomjs-launcher',
//            'karma-chrome-launcher',
            'karma-jasmine-jquery',
            'karma-jasmine',
            'karma-spec-reporter'
        ],
        // Continuous Integration mode
        // if true, it capture browsers, run tests and exit
        singleRun: true,
        colors: true,
        // level of logging
        // possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
        logLevel: config.LOG_INFO,
        // Uncomment the following lines if you are using grunt's server to run the tests
        // proxies: {
        //   '/': 'http://localhost:9000/'
        // },
        // URL root prevent conflicts with the site root
        // urlRoot: '_karma_'
        client: {
            captureConsole: true
        },
        reporters: ['spec']


    });
};
