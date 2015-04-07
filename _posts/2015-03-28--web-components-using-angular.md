---
layout: post
title: AngularJS Directives as Web Components
tags: [DDD, JPA]
header-img: "img/angular2.jpg"
---

>... judging from mailing list, IRC questions, and so on ... there's a lot of confusion about directives ... its probably my fault. I should have done a better job documenting
>
> ~ (Angular creator)

AngularJs is a powerful and flexible framework, but badly documented in some places. It is also moving at a fast pace. Some of the features discussed here was introduced in version 1.2 (first released Nov 2013) or 1.3 (Oct 2014). Also, new features in 1.4 are set to slightly change how we do things. And Angular 2 is on the horizon, and its promise of Web Components.

The fluctuating changes and lack of good documentation particularly effects directives, which at first may seem like some higher level design function only suitable for meta-developers. Writing them can seem very daunting at first. Also, there is also not much on best practices or general high-level design patterns, so even getting to writing them as a fundamental development activity is seemingly not encouraged.

Yet directives are Angulars killer feature.

In a series of posts, I'd like to look at what we can do right now, with Angular 1.3 directives, to create re-usable components, and extend HTML to the needs of our application. Effectibvely making HTML into a Domain Specific Language. I've created the following demo to help illustrate things. Its a fictitious system that shows messages for a gived month:

<script src="{{site.root}}/angular/js/angular.js"></script>
 <div ng-app="app">
     <page ng-controller="PageController as ctrl">
         <header>
             <h2>Monthly Message Viewing System</h2>
         </header>
         <sidebar>
             <panel heading="Month picker">
                 <month-picker 
                     multi="[[[ ctrl.multiMode ]]]" 
                     month-selected-expression="ctrl.selectMonth(month)">
                 </month-picker>
             </panel>
             <panel heading='Options'>
                 <checkbox label="multi-mode" model="ctrl.multiMode  "></checkbox>
                 <checkbox class="text-danger" label="| danger" model="ctrl.showDanger"></checkbox>
                 <checkbox class="text-warning" label="| warning" model="ctrl.showWarning"></checkbox>
                 <checkbox class="text-info" label="| info" model="ctrl.showInfo"></checkbox>
                 <hr />
                 <span>
                     filter message: <input type='text' ng-model="ctrl.messageFilter"></input>
                 </span>
             </panel>
         </sidebar>
         <main>
             <panel heading="Alerts">
                 <alert-list
                     months="ctrl.currentMonth"
                     show-danger="ctrl.showDanger"
                     show-warning="ctrl.showWarning"
                     show-info="ctrl.showInfo"
                     filter="ctrl.messageFilter">
                 </alert-list>
             </panel>
         </main>
         <footer>
             <h5>MMVS Copyright 2015</h5>
         </footer>
     </page>
     
     <script src="{{site.root}}/angular/demo2/monthPicker.js"></script>
     <script src="{{site.root}}/angular/demo2/page.js"></script>
     <script src="{{site.root}}/angular/demo2/checkbox.js"></script>
     <script src="{{site.root}}/angular/demo2/panel.js"></script>
     <script src="{{site.root}}/angular/demo2/alertList.js"></script>
     <script src="{{site.root}}/angular/demo2/pageController.js"></script>
     <script src="{{site.root}}/angular/demo2/app.module.js"></script>
 </div>


I'll talk through how we can create higher level components, effectively extending HTML to suit the needs of our application. The example above has the following constituant components:

- month-picker
- alert-list
- checkbox
- panel
- page

Which we can use within our application like this:

{% highlight html linenos %}
<page ng-controller="PageController as ctrl">
	<header>
   	<h2>Monthly Message Viewing System</h2>
	</header>
	<sidebar>
		<panel heading="Month picker">
			<month-picker 
				multi="{{ ctrl.multiMode }}" 
				month-selected-expression="ctrl.selectMonth(month)">
			</month-picker>
		</panel>
		<panel heading='Options'>
			<checkbox label="multi-mode" model="ctrl.multiMode  "></checkbox>
			<checkbox class="text-danger" label="| danger" model="ctrl.showDanger"></checkbox>
			<checkbox class="text-warning" label="| warning" model="ctrl.showWarning"></checkbox>
			<checkbox class="text-info" label="| info" model="ctrl.showInfo"></checkbox>
			<hr />
			<span>filter: <input type='text' ng-model="ctrl.messageFilter"></input></span>
		</panel>
	</sidebar>
	<main>
		<panel heading="Alerts">
			<alert-list
				months="ctrl.currentMonth"
				show-danger="ctrl.showDanger"
				show-warning="ctrl.showWarning"
				show-info="ctrl.showInfo"
				filter="ctrl.messageFilter">
			</alert-list>
		</panel>
	</main>
	<footer>
		<h5>MMVS Copyright 2015</h5>
	</footer>
 </page>
 {% endhighlight %}
 
I'll begin looking at the individual components in [part 2]({{ "/2015/03/29/web-components-using-angular-part-2.html" | prepend: site.baseurl }}), beginning with the month-picker.

