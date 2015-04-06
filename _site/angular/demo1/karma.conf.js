// Karma configuration
// http://karma-runner.github.io/0.12/config/configuration-file.html
// Generated on 2015-03-25 using
// generator-karma 0.9.0

module.exports = function (config) {
    'use strict';

    config.set({
        
        basePath: '',
        
        frameworks: ['jasmine-jquery','jasmine'],
        
        files: [
            'js/jquery.js',
            'js/angular.js',
            'js/angular-mocks.js',
            'js/bootstrap.js',

            'monthPicker.js',
            'monthPicker.spec.js',
            'monthPicker.html',
        ],
        
        exclude: [
        ],
        
        // generate js files from html templates
        preprocessors: {
            '*.html': 'ng-html2js'
        },

        
//        ngHtml2JsPreprocessor: {
////            stripPrefix: '',
//            moduleName: 'templates'
//        },
        
        autoWatch: false,
        port: 8080,
        browsers: [
            'PhantomJS'
//               'Chrome'
        ],

        plugins: [
            'karma-ng-html2js-preprocessor',
            'karma-phantomjs-launcher',
//            'karma-chrome-launcher',
            'karma-jasmine-jquery',
            'karma-jasmine',
            'karma-spec-reporter'
        ],

        singleRun: true,

        colors: true,

        logLevel: config.LOG_INFO,

        client: {
            captureConsole: true
        },

        reporters: ['spec']
        
    });
};
