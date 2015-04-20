angular.module('alertListModule', [])

.directive("alertList", function() {
    console.log("In alerts");
    return {
        restrict: 'AE',
        replace: true,
        controller: 'AlertController',
        controllerAs: 'ctrl',
        bindToController: true,
        templateUrl: '/angular/demo2/alertList.html',
        scope: {
            months: '=',
            showDanger: '=?',
            showWarning: '=?',
            showInfo: '=?',
            filter: '=?'
        }
    }
})

.controller("AlertController", function () {
    var ctrl = this;
    
    ctrl.showDanger = true;
    ctrl.showWarning = true;
    ctrl.showInfo = true;
    ctrl.filter = "";
        
    ctrl.currentAlerts = [
        {month: 'Feb', severity:'info', message:'alert 1 message for jan'},
        {month: 'Jan', severity:'warning', message:'alert  2 message for jan'},
        {month: 'Feb', severity:'danger', message:'alert 12 message for jan'},
        {month: 'Feb', severity:'info', message:'alert xx message for jan'},
        {month: 'Feb', severity:'warning', message:'alert add message for jan'},
    ];
    
    ctrl.hasAlerts = function() {
        return ctrl.filterAlerts(ctrl.months).length > 0;
    };
    
    ctrl.hasMonths = function() {
        return ctrl.months.length > 0;
    };
    
    ctrl.filterAlerts = function(months) {
        var filtered = [];
        for(var i=0; i<ctrl.currentAlerts.length; i++) {
            var currentAlert = ctrl.currentAlerts[i];
            if(months.indexOf(currentAlert['month']) > -1) {
                if((currentAlert['severity'] === 'danger' && ctrl.showDanger) 
                        || (currentAlert['severity'] === 'warning' && ctrl.showWarning) 
                        || (currentAlert['severity'] === 'info' && ctrl.showInfo)) {
                    if(ctrl.filter.length === 0) {
                        filtered.push(ctrl.currentAlerts[i]);
                    } else if(currentAlert['message'].indexOf(ctrl.filter) > -1) {
                            filtered.push(currentAlert);
                    }   
                }
            }
        }
        return filtered;
    }
})

.service("AlertsService", function() {
    
    var data = [
        {month: 'Feb', severity:'info', message:'alert message for jan'},
        {month: 'Jan', severity:'warning', message:'alert message for jan'},
        {month: 'Feb', severity:'danger', message:'alert message for jan'},
        {month: 'Feb', severity:'info', message:'alert message for jan'},
        {month: 'Feb', severity:'warning', message:'alert message for jan'},
    ];

    var service = {
        activeMonths: [],
        
        setMonth: function(newMonthArray) {
            var filtered = [];
            for(var i=0; i<data.length; i++) {
                var currentAlert = data[i];
                if(months.indexOf(currentAlert['month']) > -1) {
                    if((currentAlert['severity'] === 'danger' && ctrl.showDanger) 
                            || (currentAlert['severity'] === 'warning' && ctrl.showWarning) 
                            || (currentAlert['severity'] === 'info' && ctrl.showInfo)) {
                        filtered.push(ctrl.currentAlerts[i]);
                    }

                }
            }
            return filtered;
        }
    };
    
    return service;
});