angular.module('checkboxModule', [])

.directive("checkbox", checkbox)
    
function checkbox() {
    return {
        restrict: 'AE',
        replace: true,
        controller: function() {
            var ctrl = this
        },
        controllerAs: 'ctrl',
        bindToController: true,
        templateUrl: 'checkbox.html',
        scope: {
            label: '@?',
            class: '@?',
            model: '='
        }
    }
}

//.directive("", function() {
//    return {
//        restrict: 'AE',
//        replace: true,
//        controller: function() {
//            var vm = this;
//        },
//        controllerAs: 'vm',
//        bindToController: true,
//        templateUrl: 'directive/script/form/checkbox.html',
//        scope: {
//            label: '@?',
//            class: '@?',
//            model: '='
////            monthSelectedExpression: '&'
//        }
//    }
//});