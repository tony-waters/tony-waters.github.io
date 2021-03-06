(function () {

    angular.module('panelModule', [])
            .directive('panel', directive)
            .controller('PanelController', controller)
            .config(function ($interpolateProvider) {
                $interpolateProvider.startSymbol('[[[').endSymbol(']]]')
            })

    function directive() {
        return {
            restrict: 'AE',
            replace: true,
            transclude: true,
            templateUrl: '/angular/demo2/panel.html',
            scope: {
                heading: '@'
            },
            controller: controller,
            controllerAs: 'ctrl',
            bindToController: true,
        }
    }
    
    function controller() {
//        var ctrl = this;
    }

})()
