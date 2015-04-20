describe('Given an alertList directive', function () {
    var element, scope, controller, service

    beforeEach(module("alertListModule", 'alertServiceModule'))
        
    beforeEach(module('templates'))
    
    describe('when in default mode', function() {

        beforeEach(inject(function ($rootScope, $compile, $controller) {
//            element = angular.element('<month-picker month-selected-expression="monthSelected(month)"></month-picker>')
            scope = $rootScope
            controller = $controller('AlertListController as ctrl', {$scope: scope})

//            $compile(element)(scope)
//            scope.$digest()

//            scope.monthSelected = function(month) {}
        }))
        
        it('should be properly set up', function() {
            expect(controller).toBeDefined()
        })
        
        
        
    })
})