describe('Given an AlertService', function () {
    
    var service
    
    beforeEach(function() {
        module('alertServiceModule')
        inject(function(AlertService) {
            service = AlertService
            service.removeAllAlerts()
        })
    })
    
    describe('When the service has no alerts', function() {

        it('should be defined', function() {
             expect(service).toBeDefined()
         })

         it('should have the 12 months defined', function() {
             expect(service.months.length).toBe(12)
             expect(service.months[0]).toBe('Jan')
             expect(service.months[1]).toBe('Feb')
             expect(service.months[2]).toBe('Mar')
             expect(service.months[3]).toBe('Apr')
             expect(service.months[4]).toBe('May')
             expect(service.months[5]).toBe('Jun')
             expect(service.months[6]).toBe('Jul')
             expect(service.months[7]).toBe('Aug')
             expect(service.months[8]).toBe('Sep')
             expect(service.months[9]).toBe('Oct')
             expect(service.months[10]).toBe('Nov')
             expect(service.months[11]).toBe('Dec')
         })

         it('should have no alerts', function() {
             expect(service.alerts.length).toBe(0)
         })

         describe('When I add an alert to Jan, Feb, and Mar', function() {

             beforeEach(function() {
                 service.removeAllAlerts()
                 service.addAlert({month: 'Jan', severity:'info', message:'Alert #1 for Jan with severity info'})
                 service.addAlert({month: 'Feb', severity:'info', message:'Alert #1 for Feb with severity info'})
                 service.addAlert({month: 'Mar', severity:'info', message:'Alert #1 for Mar with severity info'})
             })

             it('should have a total of 3 alerts', function() {
                 expect(service.alerts.length).toBe(3)
             })

             it('should have 1 alert for Jan', function() {
                 service.updateSelectedMonths(['Jan'])
                 expect(service.filteredAlerts.length).toBe(1)
             })

             it('should have 1 alert for Feb', function() {
                 service.updateSelectedMonths(['Feb'])
                 expect(service.filteredAlerts.length).toBe(1)
             })

             it('should have 1 alert for Mar', function() {
                 service.updateSelectedMonths(['Mar'])
                 expect(service.filteredAlerts.length).toBe(1)
             })

             it('should have 2 alerts for Jan, Feb', function() {
                 service.updateSelectedMonths(['Jan', 'Feb'])
                 expect(service.filteredAlerts.length).toBe(2)
             })

             it('should have 2 alerts for Feb, Mar', function() {
                 service.updateSelectedMonths(['Feb', 'Mar'])
                 expect(service.filteredAlerts.length).toBe(2)
             })

             it('should have 2 alerts for Jan, Mar', function() {
                 service.updateSelectedMonths(['Jan', 'Mar'])
                 expect(service.filteredAlerts.length).toBe(2)
             })

             it('should have 3 alerts for Jan, Feb, Mar', function() {
                 service.updateSelectedMonths(['Jan','Feb', 'Mar'])
                 expect(service.filteredAlerts.length).toBe(3)
             })

         })
 


    })


    
  
})
