angular.module("pageControllerModule", [])
            .config(function ($interpolateProvider) {
                $interpolateProvider.startSymbol('[[[').endSymbol(']]]')
            })
            .controller("PageController", pageController)
    
function pageController() {
    var ctrl = this
    
    ctrl.setSelectedMonths = setSelectedMonths
    ctrl.setLastSelectedMonth = setLastSelectedMonth

    ctrl.selectedMonths = [];

    ctrl.lastSelectedMonth = "";

    ctrl.multiMode = true
    ctrl.showDanger = true
    ctrl.showInfo = true
    ctrl.showWarning = true
    ctrl.messageFilter = "testing"
    
    function setSelectedMonths(months) {
//        console.log("Selecting months " + months)
        ctrl.selectedMonths = months
    }
    
    function setLastSelectedMonth(month) {
//        console.log("Last selected month " + month)
        ctrl.lastSelectedMonth = month;
    }
}