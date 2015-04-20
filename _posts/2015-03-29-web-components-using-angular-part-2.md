---
layout: post
title: Creating a reusable Month Picker component with directives using Angular 1.3
tags: [DDD, JPA]
header-img: "img/angular3.jpg"
---
<!--[if lt IE 9]>
<div class="alert alert-danger" role="alert">
Angular 1.3 is not supported in IE8 and below. To see the demo you need to use at least Internet Explorer 9.
</div>
<![endif]-->

In my [previous post]({{ "/2015/03/28/-web-components-using-angular.html" | prepend: site.baseurl }}) I introduced the Monthly Message System I will be using to illustrate building components using AngularJs 1.3. You can see it in action [here]({{ site.root }}/example-angular) and its source code [here](https://github.com/tony-waters/example-angular/tree/master).

In this post I will focus on the 'month picker' component.

###The new HTML element we are creating

The best way to understand the month-picker component is by looking at its requirements. We will be testing with Jasmine, so here they are in a Jasmine-style BDD format:

<pre>
  Given a MonthPicker
    when in default mode
      it should create 12 buttons
      it should have labels on the buttons corresponding to the months
      it should mark a single button clicked as active
      it should return single month corresponding to selected button
    when in multi mode
      it should mark all buttons clicked as active
      it should toggle active buttons to inactive
      it should return months corresponding to selected buttons
</pre>

Here is the finished component operating in each of its two modes:

<!--[if (gt IE 8)|!(IE)]><!-->
<script src="{{site.root}}/angular/js/angular.js"></script>
<div ng-app="monthPickerModule" class="demo row">

	<div class="panel panel-default col-md-4 col-md-offset-1">
	  <div class="panel-heading">Single Select Mode</div>
	  <div class="panel-body">
	    <month-picker 
	        multi="false" 
	        selected-months="value1 = months"
	        last-selected-month="lastValue1 = month">
	    </month-picker>
	  </div>
	</div>
	
	<div class="panel panel-default col-md-4 col-md-offset-3">
	  <div class="panel-heading">Multi Select Mode</div>
	  <div class="panel-body">
	    <month-picker 
	        multi="true" 
	        selected-months="value2 = months"
	        last-selected-month="lastValue2 = month">
	    </month-picker>
	  </div>

	</div>
	<hr />
	<h4 class="col-md-offset-1">Single Select: [[[ value1 ]]]</h4>
	<h4 class="col-md-offset-1">Last Single Select: [[[ lastValue1 ]]]</h4>
	<hr />
	<h4 class="col-md-offset-1">Multi Select: [[[ value2 ]]]</h4>
	<h4 class="col-md-offset-1">Last Multi Select: [[[ lastValue2 ]]]</h4>
	<script src="{{site.root}}/angular/demo2/monthPicker.js"></script>
</div>
<!--<![endif]-->

<!--[if lt IE 9]>
<div class="alert alert-danger" role="alert">
Angular 1.3 is not supported in IE8 and below. To see this demo you need to use at least Internet Explorer 9.
</div>
<![endif]-->


We want to make including this component on a page as simple as possible for the 'end-user' (someone developing the site, perhaps ourselves). We will need to include in this new element a way of specifying single-select or multi-select mode, and some way of getting the seleced month(s) into the scope of the controller of the rendered page.

We do this using attributes:

{% highlight html linenos %}
<month-picker 
	multi="true"
	selected-months="someFunction(months)">
</month-picker>
{% endhighlight %}

For this to work our directive needs to be able to locate the value for `multi`, so it can change the components operation accordingly. And whatever is in `selected-months` should be evaluated whenever a month is selected -- in this case calling `someMethod` in the scope of the page on which it resides, passing in the month that was clicked.

The secret of this working is related to directive scope.

###A note on directive scope
Its worth understanding the relationship a `<month-picker>` tag has with its directive. 

By default a directive shares its parent scope, so has access to the scope of the page it is included on. We could use this for any communication between our directive and the page without any further work. For example, we could have the directive call a method in the page controller. While this approach is convenient it is not a very encapsulated solution, and makes `<month-picker>` reliant on the scope of the page on which it appears.

A better solution is to give the directive its own scope -- referred to as 'isolate scope' -- and pass values to and from it using attributes on the `<month-picker>` tag. This way the component is isolated from other scopes, and we have a clear method of communication between it and the page it appears on.

To configure an isolate scope we pass a directive an empty scope object (`{}`). We can specify we want the `selected-months` and `multi` attributes to be shared between the directive and the page by including their [camel case](http://en.wikipedia.org/wiki/CamelCase) equivalent as properties within this empty scope object:

{% highlight js linenos %}
{
	multi: '@?',
	selectedMonths: '&'
},
{% endhighlight %}

The value passed to these two properties represents the relationship between the parent/page scope and the isolate scope of the directive:

* `@` means a value is passed from the parent scope into the isolate directive scope
* `=` is for 2-way binding between the isolate scope of the directive and the parent scope
* `&` is for when a value is pushed back from the directives isolate scope to its parent scope, such as when a month is clicked
* `?` indicates that a binding is optional

So in our example:

{% highlight html linenos %}
<month-picker 
	multi="true"
	selected-months="someFunction(months)">
</month-picker>
{% endhighlight %}

The month-picker component is set to multi-select mode, and whenever a month is selected, the function `someFunction` is called passing in an object representing the clicked month.

Having outlined our requirements and considered the intricacies of directive scope, lets look at how we code the directive.

###Writing the directive

To write this directive we will need:

1. a template containing the HTML
2. a controller function to feed the template
3. a directive function to configure the component
4. a module to keep it all in

###1. A template containing the HTML
Nothing special about the components HTML template. It only knows about its controller, represented here by `ctrl`. We do not specify the actual controller in this template. We will use the directive function to wire things up instead.

Here is the complete HTML template used to create `<month picker>`, note no reference to scope:

{% highlight html linenos %}
<div id="month-picker">
    <button id="month-{{month | lowercase}}"
        class="month-button btn btn-default col-md-4" 
        ng-repeat="month in ctrl.months" 
        ng-class="{ 'active': ctrl.isSelected(month) }"
        ng-click="ctrl.selectMonth(month)">{{month}}
    </button>
</div>
{% endhighlight %}

###2. A controller function to feed the template
A controller function is needed to feed our template. Angular 1.2 introduced the `Controller As` syntax which means we can drop reference to `$scope` from the controllers. Our controller function uses this new syntax:

{% highlight js linenos %}
 function controller () {
     var ctrl = this;

     ctrl.isSelected = isSelected
     ctrl.months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
     ctrl.multi = 'false'
     ctrl.selected = []
     ctrl.lastSelected = ""
     ctrl.selectMonth = selectMonth

     function isSelected(month) {
         return ctrl.selected.indexOf(month) > -1
     }

     function selectMonth(month) {
//            console.log("selecting: " + month)
         
         if (isMultiMode()) {
             if (isSelected(month)) {
                 var index = ctrl.selected.indexOf(month)
                 ctrl.selected.splice(index, 1)
             } else {
                 ctrl.selected.push(month)
                 ctrl.lastSelected = month
             }
         } else {
             ctrl.selected = []
             ctrl.selected.push(month)
             ctrl.lastSelected = month
         }
         selectedMonthsCallback()
         lastSelectedMonthCallback()
     }

     // private methods

     function isMultiMode() {
         return ctrl.multi === 'true'
     }

     function selectedMonthsCallback() {
         ctrl.selectedMonths({'months': ctrl.selected})
     }
     
     function lastSelectedMonthCallback() {
         ctrl.lastSelectedMonth({'month': ctrl.lastSelected});
     }
 }
{% endhighlight %}


###3. A directive function to configure the component

The directive function is used to tie the pieces together. The function must return a <i>Directive Definition Object</i>, basically an object with properties describing how the directive works. The full list of possible properties is [here](https://docs.angularjs.org/api/ng/service/$compile), but we generally just use a subset corresponding to our requirements.

Here is the directive function we will be using for `<month-picker>`:

{% highlight js linenos %}
 function directive() {
     return {
         restrict: 'AE',
         replace: true,
         templateUrl: 'monthPicker.html',
         scope: {
             multi: '@?',
             selectedMonths: '&'
         },
         controller: controller,
         controllerAs: 'ctrl',
         bindToController: true,
     }
 }
{% endhighlight %}

The first four properties relate to the template, beginning with the `templateUrl` itself. Next we `restrict` usage of the directive to Attributes and Elements, meaning we will be able to write these:

{% highlight html linenos %}
<month-picker></month-picker>
<div month-picker></div>
{% endhighlight %}
	
But not the less common:

{% highlight html linenos %}
<div class='month-picker'></div>
<!-- month-picker -->
{% endhighlight %}

The `replace` property is set `true`, meaning the `<month-picker>` tags will not be in the compiled DOM, but replaced entirely by the HTML template. The default is false, which would put the templates contents within `<month-picker>` tags.

Wiring the controller to `<month-picker>` is done with the last three properties. The `controller` property of the directive specifies which controller function to use. In this case I have included the controller function in the same file as the directive function, so it is just referenced by name.

Angular 1.2 introduced `controllerAs`, which binds the scope to the controllers `this` reference and significantly simplifies controller design. The value of the `controllerAs` in our Directive Definition Object specifies what to call the controller when it is used in the HTML template.

Finally, we specify `bindToController` as `true`. This is a new feature in 1.3 that makes the attributes specified in `scope` -- `multi` and `selectedMonths` -- available as properties in the controller. Note that its set to [change in 1.4](https://github.com/angular/angular.js/issues/10420). 

###4. A module to keep it all in
Here is the module definition for the month picker component, showing how the directive and controller functions previously discussed fit in:

{% highlight js linenos %}
 angular.module('monthPickerModule', [])
         .directive("monthPicker", directive)
         .controller("MonthPickerController", controller)

 function directive() {
	
	// ... code ommited ...	
	
 }

 function controller () {
	
	// ... code ommited ...	
	
 }
{% endhighlight %}

You can find the full code [here](https://github.com/tony-waters/example-angular/blob/master/monthPicker.js).

###Unit testing the month picker
We need some unit tests to ensure our Month Picker works as expected, and make sure we are informed when future changes to the code base interfere with its functioning. Remember that we looked at the requirements at the start of this post:

<pre>
  Given a MonthPicker
    when in default mode
      it should create 12 buttons
      it should have labels on the buttons corresponding to the months
      it should mark a single button clicked as active
      it should return single month corresponding to selected button
    when in multi mode
      it should mark all buttons clicked as active
      it should toggle active buttons to inactive
      it should return months corresponding to selected buttons
</pre>

Here is the unit test file for the component, written using Jasmine. I have also used jQuery in the tests, although it is not used in the component itself:

{% highlight js linenos %}
describe('Given a MonthPicker', function () {
    var element, scope, controller

    beforeEach(module("monthPickerModule"))
    
    beforeEach(module('templates'))
    
    describe('when in default mode', function() {

        beforeEach(inject(function ($rootScope, $compile, $controller) {
            element = angular.element('<month-picker multi="false" last-selected-month="lastSelected(month)" selected-months="monthSelected(months)"></month-picker>')
            scope = $rootScope
            controller = $controller('MonthPickerController as ctrl', {$scope: scope})

            $compile(element)(scope)
            scope.$digest()

            scope.monthSelected = function(months) {}
            scope.lastSelected = function(month) {}
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
            element = angular.element('<month-picker multi="true"  last-selected-month="lastSelected(month)" selected-months="monthSelected(months)"></month-picker>')
            scope = $rootScope
            controller = $controller('MonthPickerController as vm', {$scope: scope})

            $compile(element)(scope)
            scope.$digest()

            scope.monthSelected = function(months) {}
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
{% endhighlight %}


