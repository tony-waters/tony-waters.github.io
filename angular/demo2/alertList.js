(function () {

    angular.module('alertListModule', [])
            .config(function ($interpolateProvider) {
                $interpolateProvider.startSymbol('[[[').endSymbol(']]]')
            })
            .directive("alertList", directive)
            .controller("AlertListController", controller)

    function directive() {
        return {
            restrict: 'AE',
            replace: true,
            controller: 'AlertListController',
            controllerAs: 'ctrl',
            bindToController: true,
            templateUrl: '/angular/demo2/alertList.html',
            scope: {
                months: '=',
                filter: '=?'
            }
        }
    }

    function controller(AlertService) {
        var ctrl = this

        // api

        ctrl.filterAlerts = filterAlerts
        ctrl.hasAlerts = hasAlerts
        ctrl.hasMonths = hasMonths

        // api methods

        function filterAlerts(months) {
            AlertService.updateSelectedMonths(months)
            return AlertService.filteredAlerts
        }

        function hasAlerts() {
            return filterAlerts(ctrl.months).length > 0
        }

        function hasMonths() {
            console.log("months: " + ctrl.months.length)
            return ctrl.months.length > 0
        }

    }

})()