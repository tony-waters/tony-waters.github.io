angular.module("pageControllerModule", [])
        
.controller("PageController", pageController)
    
function pageController() {
    var ctrl = this

    ctrl.currentMonth = []
    ctrl.messageFilter = "testing"
    ctrl.multiMode = true
    ctrl.selectMonth = selectMonth
    ctrl.showDanger = true
    ctrl.showInfo = true
    ctrl.showWarning = true
    
    function selectMonth(month) {
        ctrl.currentMonth = month
    }
}