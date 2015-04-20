(function () {

    angular.module('alertServiceModule', [])
            .service("AlertService", service)
    
    
    function service() {

        var service = {
            months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            updateSelectedMonths: updateSelectedMonths,
            alerts: [],
            filteredAlerts: [],
            addAlert: addAlert,
            removeAllAlerts: removeAllAlerts,
        }
        
        init()
        
        function init() {
            service.addAlert({month: 'Jan', severity:'info', message:'Alert #1 for Jan with severity info'})
            service.addAlert({month: 'Jan', severity:'warning', message:'Alert #2 for Jan with severity warning'})
            service.addAlert({month: 'Jan', severity:'danger', message:'Alert #3 for Jan with severity danger'})
            service.addAlert({month: 'Feb', severity:'info', message:'Alert #1 for Feb with severity info'})
        }
        
        function addAlert(alert) {
            service.alerts.push(alert)
        }
        
        function updateSelectedMonths(months) {
            service.filteredAlerts = []
            for(var i=0; i<service.alerts.length; i++) {
                var currentAlert = service.alerts[i]
                if(months.indexOf(currentAlert.month) > -1) {
                    service.filteredAlerts.push(currentAlert)
                }
            }
        }
        
        function removeAllAlerts() {
            service.alerts = [];
        }
        
        var data = [
            {month: 'Feb', severity:'info', message:'alert message for jan'},
            {month: 'Jan', severity:'warning', message:'alert message for jan'},
            {month: 'Feb', severity:'danger', message:'alert message for jan'},
            {month: 'Feb', severity:'info', message:'alert message for jan'},
            {month: 'Feb', severity:'warning', message:'alert message for jan'},
        ]

        var allAlerts = []
        
        var filteredAlerts = []
        
        function hasAlerts() {
            
        }

        function getAlertsForMonth(month) {
            return allAlerts;
        }

        function setMonth(newMonthArray) {
            var filtered = []
            for(var i=0; i<data.length; i++) {
                var currentAlert = data[i]
                if(months.indexOf(currentAlert['month']) > -1) {
                    if((currentAlert['severity'] === 'danger' && ctrl.showDanger) 
                            || (currentAlert['severity'] === 'warning' && ctrl.showWarning) 
                            || (currentAlert['severity'] === 'info' && ctrl.showInfo)) {
                        filtered.push(ctrl.currentAlerts[i])
                    }
                }
            }
            return filtered
        }
        return service
    }

})()