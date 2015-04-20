(function () {

    angular.module('monthPickerModule', [])
            .config(function ($interpolateProvider) {
                $interpolateProvider.startSymbol('[[[').endSymbol(']]]')
            })
            .directive("monthPicker", directive)
            .controller("MonthPickerController", controller)

    function directive() {
        return {
            restrict: 'AE',
            replace: true,
            templateUrl: '/angular/demo2/monthPicker.html',
            scope: {
                multi: '@?',
                monthSelectedExpression: '&'
            },
            controller: controller,
            controllerAs: 'ctrl',
            bindToController: true,
        }
    }

    function controller () {
        var ctrl = this;
        
        // api
        
        ctrl.isSelected = isSelected
        ctrl.months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        ctrl.multi = false
        ctrl.selected = []
        ctrl.selectMonth = selectMonth

        // api methods

        function isSelected(month) {
            return ctrl.selected.indexOf(month) > -1
        }

        function selectMonth(month) {
            if (isMultiMode()) {
                if (isSelected(month)) {
                    var index = ctrl.selected.indexOf(month)
                    ctrl.selected.splice(index, 1)
                } else {
                    ctrl.selected.push(month)
                }
            } else {
                ctrl.selected = []
                ctrl.selected.push(month)
            }
            monthSelectedExpressionCallback()
        }

        // private methods

        function isMultiMode() {
            return ctrl.multi === 'true'
        }

        function monthSelectedExpressionCallback() {
            ctrl.monthSelectedExpression({'month': ctrl.selected})
        }
    }

})()