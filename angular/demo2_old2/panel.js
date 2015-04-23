(function () {

    angular.module('panelModule', [])
            .config(function ($interpolateProvider) {
                $interpolateProvider.startSymbol('[[[').endSymbol(']]]')
            })
            .directive("panel", directive)
            .controller("PanelController", controller)

    function directive() {
        return {
            restrict: 'AE',
            replace: true,
            templateUrl: '/angular/demo2/panel.html',
            scope: {
                heading: '@'
            },
            transclude: true,
            controller: controller,
            controllerAs: 'ctrl',
            bindToController: true,
        }
    }
    
    function controller() {
        var vm = this
    }

})()