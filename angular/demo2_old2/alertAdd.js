(function () {

    angular.module('alertAddModule', [])
            .directive("alertAdd", directive)
            .controller("AlertAddController", controller)

    function directive() {
        return {
            restrict: 'AE',
            replace: true,
            templateUrl: '/angular/demo2/alertAdd.html',
            scope: {
                currentMonth: "@"
            },
            controller: controller,
            controllerAs: 'ctrl',
            bindToController: true,
        }
    }

    function controller(AlertService) {
        var ctrl = this;

        ctrl.clickAdd = clickAdd
        ctrl.message = ""
        ctrl.month = ""
        ctrl.months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        ctrl.severity = ""
        
        function clickAdd() {
            console.log("Adding (" + ctrl.month + "), severity(" + ctrl.severity + "), message(" + ctrl.message + ")")
            var newAlert = {month: ctrl.currentMonth, severity: ctrl.severity, message: ctrl.message}
            AlertService.addAlert(newAlert)
            ctrl.month = ""
            ctrl.severity = ""
            ctrl.message = ""
            ctrl.alertForm.$setPristine()
            ctrl.alertForm.$setUntouched()
        }
    }

})()