describe('given a MonthPicker directive', function () {
    var element, scope, controller

    beforeEach(module("monthPickerModule"))
    
    beforeEach(module('templates'))
    
    describe('when in default mode', function() {

        beforeEach(inject(function ($rootScope, $compile, $controller) {
            element = angular.element('<month-picker month-selected-expression="monthSelected(month)"></month-picker>')
            scope = $rootScope
            controller = $controller('MonthPickerController as ctrl', {$scope: scope})

            $compile(element)(scope)
            scope.$digest()

            scope.monthSelected = function(month) {}
        }))
        
        it('should be properly set up', function() {
            expect(controller).toBeDefined()
        })

        it('should have a months object with the 12 months', function() {
            expect(controller.months).toEqual(jasmine.arrayContaining(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']))
        })

        it('should create 12 buttons', function() {
            var monthButtons = element.find('button.month-button')
            expect(monthButtons.length).toBe(12)
        })

        it('should have labels on the buttons corresponding to the months', function() {
            var monthButtons = element.find('button.month-button')
            expect(monthButtons.length).toBe(12)
            expect($(monthButtons[0]).html()).toMatch('^Jan.*')
            expect($(monthButtons[1]).html()).toMatch('^Feb.*')
            expect($(monthButtons[2]).html()).toMatch('^Mar.*')
            expect($(monthButtons[3]).html()).toMatch('^Apr.*')
            expect($(monthButtons[4]).html()).toMatch('^May.*')
            expect($(monthButtons[5]).html()).toMatch('^Jun.*')
            expect($(monthButtons[6]).html()).toMatch('^Jul.*')
            expect($(monthButtons[7]).html()).toMatch('^Aug.*')
            expect($(monthButtons[8]).html()).toMatch('^Sep.*')
            expect($(monthButtons[9]).html()).toMatch('^Oct.*')
            expect($(monthButtons[10]).html()).toMatch('^Nov.*')
            expect($(monthButtons[11]).html()).toMatch('^Dec.*')
        })

        it('should mark a single button clicked as active', function() {
            var monthButtons = element.find('button.month-button')

            monthButtons.eq(0).click()
            var clicked =  element.find('button.active')
            expect(clicked.length).toBe(1)
            expect(clicked[0]).toEqual(monthButtons[0])

            monthButtons.eq(9).click()
            clicked =  element.find('button.active')
            expect(clicked.length).toBe(1)
            expect(clicked[0]).toEqual(monthButtons[9])
        })

        it('should return single month corresponding to selected button', function() {
            var monthButtons = element.find('button.month-button')
            spyOn(scope, 'monthSelected')

            monthButtons.eq(0).click()
            expect(scope.monthSelected).toHaveBeenCalledWith(['Jan'])

            monthButtons.eq(9).click()
            expect(scope.monthSelected).toHaveBeenCalledWith(['Oct'])
        })
    })
    
    describe('when in multi mode', function() {
        
        beforeEach(inject(function ($rootScope, $compile, $controller) {
            element = angular.element('<month-picker multi="true" month-selected-expression="monthSelected(month)"></month-picker>')
            scope = $rootScope
            controller = $controller('MonthPickerController as vm', {$scope: scope})

            $compile(element)(scope)
            scope.$digest()

            scope.monthSelected = function(month) {}
        }))
        
        it('should mark all buttons clicked as active', function() {
            var monthButtons = element.find('button.month-button')

            monthButtons.eq(0).click()
            var clicked =  element.find('button.active')
            expect(clicked.length).toBe(1)
            expect(clicked[0]).toEqual(monthButtons[0])

            monthButtons.eq(9).click()
            clicked =  element.find('button.active')
            expect(clicked.length).toBe(2)
            expect(clicked[0]).toEqual(monthButtons[0])
            expect(clicked[1]).toEqual(monthButtons[9])
        })
        
        it('should toggle active buttons to inactive', function() {
            var monthButtons = element.find('button.month-button')

            monthButtons.eq(5).click();
            var clicked =  element.find('button.active')
            expect(clicked.length).toBe(1)
            expect(clicked[0]).toEqual(monthButtons[5])


            monthButtons.eq(5).click();
            clicked =  element.find('button.active')
            expect(clicked.length).toBe(0)
        })

        it('should return months corresponding to selected buttons', function() {
            var monthButtons = element.find('button.month-button')
            spyOn(scope, 'monthSelected')

            monthButtons.eq(0).click()
            expect(scope.monthSelected).toHaveBeenCalledWith(['Jan'])

            monthButtons.eq(9).click()
            expect(scope.monthSelected).toHaveBeenCalledWith(['Jan', 'Oct'])
        })
    })
  
})
