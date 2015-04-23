angular.module('app', [
    'monthPickerModule',
    'panelModule',
    'pageModule',
    'pageControllerModule',
    'alertListModule',
    'alertAddModule',
    'alertServiceModule'
])

.config(function ($interpolateProvider) {
    $interpolateProvider.startSymbol('[[[').endSymbol(']]]');
})

angular.module('monthPickerModule')
angular.module('panelModule')
angular.module('pageModule')
angular.module('pageControllerModule')
angular.module('alertListModule')
angular.module('alertAddModule')
angular.module('alertServiceModule')
