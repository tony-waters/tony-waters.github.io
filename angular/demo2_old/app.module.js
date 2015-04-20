angular.module('app', [
    'monthPickerModule',
    'panelModule',
    'checkboxModule',
    'pageModule',
    'pageControllerModule',
    'alertListModule'

//    'tw.alerts',
//    'tw.form',
//    'tw.appService'

])

.config(function ($interpolateProvider) {
    $interpolateProvider.startSymbol('[[[').endSymbol(']]]');
})

angular.module('monthPickerModule')
angular.module('panelModule')
angular.module('checkboxModule')
angular.module('pageModule')
angular.module('pageControllerModule')
angular.module('alertListModule')

//angular.module('tw.alerts');
//angular.module('tw.form');




