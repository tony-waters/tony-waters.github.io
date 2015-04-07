---
layout: post
title: Creating a reusable Month Picker component with directives using Angular 1.3
tags: [DDD, JPA]
header-img: "img/angular3.jpg"
---

In my [previous post]({{ "/2015/03/28/-web-components-using-angular.html" | prepend: site.baseurl }}) I introduced the Monthly Message System I will be using to illustrate how we may use directives to build Web Components. You can see it in action [here]({{ site.root }}/example-angular).

In this post I will focus on the 'month picker' component.

###The new HTML element we are creating

In order to know when we have finished developing the month-picker component, we need some requirements. These will be a great help when it comes to testing. Since we will be testing with Jasmine, lets save ourselves some work and put the requirements into a Jasmine-style BDD format:

<pre>
  Given a MonthPicker directive
    when in default mode
      should have a months object with the 12 months
      should create 12 buttons
      should have labels on the buttons corresponding to the months
      should mark a single button clicked as active
      should return single month corresponding to selected button
    when in multi mode
      should mark all buttons clicked as active
      should toggle active buttons to inactive
      should return months corresponding to selected buttons

</pre>

Here is a sneek preview of the finished component operating in each mode:

<script src="{{site.root}}/angular/js/angular.js"></script>
<div ng-app="monthPickerModule" class="demo row">

	<div class="panel panel-default col-md-4 col-md-offset-1">
	  <div class="panel-heading">Single Select Mode</div>
	  <div class="panel-body">
	    <month-picker 
	        multi="false" 
	        month-selected-expression="value1 = month">
	    </month-picker>
	  </div>
	</div>
	
	<div class="panel panel-default col-md-4 col-md-offset-3">
	  <div class="panel-heading">Multi Select Mode</div>
	  <div class="panel-body">
	    <month-picker 
	        multi="true" 
	        month-selected-expression="value2 = month">
	    </month-picker>
	  </div>

	</div>
	<h4 class="col-md-offset-1">Single Select: [[[ value1 ]]]</h4>
	<h4 class="col-md-offset-1">Multi Select: [[[ value2 ]]]</h4>
	<script src="{{site.root}}/angular/demo2/monthPicker.js"></script>
</div>

We want to make including this component on a page as simple as possible for the 'end-user' (someone developing the site, perhaps ourselves). At a minimum we will need to inclue in this new element a way of specifying single-select or multi-select mode, and some way of getting the seleced month(s) into the scope of the controller of the rendered page.

Here is how we do it:

{% highlight html linenos %}
<month-picker 
	 multi="true"
    month-selected-expression="someFunction(months)">
</month-picker>
{% endhighlight %}

For this to work the value for `multi` needs to get passed to our directive, so it can change the components operation accordingly. And whatever is in `month-selected-expression` should be evaluated whenever a month is selected, in this case calling `someMethod` in the scope of the page on which it resides, passing in the month that was clicked.

The secret of this working is related to directive scope.

###A note on directive scope
Its worth understanding the relationship this `<month-picker>` tag has with its directive. 

By default a directive shares its parent scope, so has access to the scope of the page it is included on. We could use this for any communication between our directive and the page without any further work. For example, we could have the directive call a method in the page controller. While this approach is convenient it is not a very encapsulated solution, and makes `<month-picker>` less re-usable.

A better solution is to give the directive its own scope -- referred to as 'isolate scope' -- and pass values to and from it using attributes on the `<month-picker>` tag. This way the component is isolated from other scopes, and we have a clear method of communication between it and the page on which it appears.

Configuration isolate scope in directives is done using an empty scope object (`{}`). We can specify we want the `month-selected-expression` and `multi` attributes to be shared between the directive and the page by including their [camel case](http://en.wikipedia.org/wiki/CamelCase) equivalent as properties within this empty scope object:

{% highlight js linenos %}
{
    multi: '@?',
    monthSelectedExpression: '&'
},
{% endhighlight %}

The value passed to these two properties represents the relationship:

* `@` means a value is passed from the parent scope into the isolate directive scope
* `=` is for 2-way binding between the isolate scope of the directive and the parent scope
* `&` is for when a value is pushed back from the directives isolate scope to its parent scope
* `?` indicates that a binding is optional

So in our example:

{% highlight html linenos %}
<month-picker 
	 multi="true"
    month-selected-expression="someFunction(months)">
</month-picker>
{% endhighlight %}

The month-picker component is set to multi-select mode, and whenever a month is selected, the function `someFunction` is called passing in an object representing the clicked month.

Having outlined our requirements and considered the intricacies of directive scope, lets look at the directive code.

###Writing the directive

To write this directive we will need:

1. a template containing the HTML
2. a controller function to feed the template
3. a directive function to configure the component
4. a module to keep it all in

###1. A template containing the HTML
Nothing special about the components HTML template. It only knows about its controller, represented here by `ctrl`. We do not specify  the actual controller in this template. We will use the directive function to wire things up instead.

Here is the complete HTML template used to create `<month picker>`, note no reference to scope:

{% highlight html linenos %}
<div class="month-picker">
    <button 
        class="month-button btn btn-default col-md-4" 
        ng-repeat="month in vm.months" 
        ng-class="{ 'active': vm.isSelected(month) }"
        ng-click="vm.selectMonth(month)">{{month}}
    </button>
</div>
{% endhighlight %}

###2. A controller function to feed the template
A controller function is needed to feed our template. Angular 1.2 introduced the `Controller As` syntax which means we can drop reference to `$scope` from the controllers. Our controller function uses this new syntax:

{% highlight js linenos %}
function controller () {
	var vm = this;
	
	// api
	
	vm.isSelected = isSelected
	vm.months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
	vm.multi = false
	vm.selected = []
	vm.selectMonth = selectMonth

	// api methods
	
	function isSelected(month) {
		return vm.selected.indexOf(month) > -1
	}

	function selectMonth(month) {
	// refactor to switch
		if (isMultiMode()) {
			if (isSelected(month)) {
                 var index = vm.selected.indexOf(month)
                 vm.selected.splice(index, 1)
             } else {
                 vm.selected.push(month)
             }
         } else {
             vm.selected = []
             vm.selected.push(month)
         }
         monthSelectedExpressionCallback()
     }

     // private methods

     function isMultiMode() {
         return vm.multi === 'true'
     }

     function monthSelectedExpressionCallback() {
         vm.monthSelectedExpression({'month': vm.selected})
     }
 }
{% endhighlight %}


###3. A directive function to configure the component

The directive function is used to tie the pieces together and provide configuration of how the directive will work. The function must return a 'Directive Definition Object', basically an object with a number of properties describing how the directive works. The full list is [here](https://docs.angularjs.org/api/ng/service/$compile), but we generally just use a subset corresponding to our requirements.

Here is the directive function we will be using for `<month-picker>`:

{% highlight js linenos %}
 function directive() {
     return {
     		templateUrl: 'monthPicker/monthPicker.html',
         restrict: 'AE',
         replace: true,
         scope: {
             multi: '@?',
             monthSelectedExpression: '&'
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

The `replace` property is set `true`, meaning the `<month-picker>` tags will not be in the compiled DOM, but replaced entirely by our HTML template. The default is false, which would put the templates contents within `<month-picker>` tags.

Wiring the controller to `<month-picker>` is done with the last three properties. The `controller` property of the directive specifies which controller function to use. In this case the controller function is in the same file as the directive function, so it is just referenced by name. We then specify what to call the controller object when it is used in the HTML template. Of course, this can be different to what is actually used in the controller (which is simply a reference to `this`) but I have called them both `ctrl`.

Finally, we specify `bindToController` as `true`. This is a new feature in 1.3, and its set to change in 1.4 to something more useful, but for now just include it or it won't work. 

###4. A module to keep it all in
Here is the complete module definition for the month picker component, showing the directive and controller functions previously discussed:

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

I had planned to look at how we can test our new component, but I'll save that for a later post. What I'd like to do next is show how we can use directives to give a consistent structure to our pages. So I'll cover that first.
