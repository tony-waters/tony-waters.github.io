---
layout: post
title: AngularJS Directives as Web Components
tags: [DDD, JPA]
header-img: "img/angular2.jpg"
---
>... judging from mailing list, IRC questions, and so on, there's a lot of confusion about directives ... its probably my fault. I should have done a better job documenting.
>
> ~ <i>Misko Hevery (Angular creator)</i>

AngularJs is a powerful and flexible framework, but not so well documented in some areas. This is especially true of directives, which at first may seem like some higher level design function (which is true) reserved for 'edge case' development tasks (which is false). Consequently, coding directives as a fundamental, day-to-day development activity is seemingly not encouraged.

To add to the confusion, things are moving at a fast pace in the Angular world. Some of the features discussed here were first introduced in version 1.2 (released Nov 2013) or the current version 1.3 (released Oct 2014). Also, new features in 1.4 are set to slightly change how we do/did things in 1.3. And Angular 2 is on the horizon, which promises to work with emerging [Web Component](http://webcomponents.org/) technologies like [Polymer](https://www.polymer-project.org/).

In a series of posts, I'd like to look at what we can do right now, with Angular 1.3 directives, to create re-usable encapsulated web page components, and extend HTML to the needs of our application. I've created the following demo to help illustrate things. Its a fictitious system that shows message alerts for a given month (I'll leave you to make up a use for it):

<!--[if (gt IE 8)|!(IE)]><!-->
<script src="{{site.root}}/angular/js/angular.js"></script>
 <div ng-app="app" class="demo">
     <page ng-controller="PageController as ctrl">
         <header>
             <h2>Monthly Message System</h2>
         </header>
         <sidebar>
             <panel heading="Month picker">
                 <month-picker 
                     multi="[[[ ctrl.multiMode ]]]" 
                     selected-months="ctrl.setSelectedMonths(months)"
                     last-selected-month="ctrl.setLastSelectedMonth(month)">
                 </month-picker>
             </panel>
             <panel heading="Add Alert">
                 <alert-add current-month="[[[ctrl.lastSelectedMonth]]]"></alert-add>
             </panel>
         </sidebar>
         <main>
             <panel heading="Alerts">
                 <alert-list
                     months="ctrl.selectedMonths">
                 </alert-list>
             </panel>
         </main>
         <footer>
             <h5>MMVS Copyright 2015</h5>
         </footer>
     </page>
     
     <script src="{{site.root}}/angular/demo2/monthPicker.js"></script>
     <script src="{{site.root}}/angular/demo2/page.js"></script>
     <script src="{{site.root}}/angular/demo2/panel.js"></script>
     <script src="{{site.root}}/angular/demo2/alertList.js"></script>
     <script src="{{site.root}}/angular/demo2/alertAdd.js"></script>
     <script src="{{site.root}}/angular/demo2/alertService.js"></script>
     <script src="{{site.root}}/angular/demo2/pageController.js"></script>
     <script src="{{site.root}}/angular/demo2/app.module.js"></script>
 </div>
 <!--<![endif]-->

<!--[if lt IE 9]>
<div class="alert alert-danger" role="alert">
Angular 1.3 is not supported in IE8 and below. To see this demo you need to use at least Internet Explorer 9.
</div>
<![endif]-->

It has the following constituant components:

- month-picker
- alert-list
- panel
- page

Which we can use on a web page like this:

{% highlight html linenos %}
<page ng-controller="PageController as ctrl">

  <header>
    <h2>Monthly Message System</h2>
  </header>

  <sidebar>
    <panel heading="Month picker">
      <month-picker 
	     multi="[[[ ctrl.multiMode ]]]" 
	     selected-months="ctrl.setSelectedMonths(months)"
	     last-selected-month="ctrl.setLastSelectedMonth(month)">
      </month-picker>
    </panel>
    <panel heading="Add Alert">
      <alert-add current-month="[[[ctrl.lastSelectedMonth]]]"></alert-add>
     </panel>
   </sidebar>

   <main>
     <panel heading="Alerts">
       <alert-list
         months="ctrl.selectedMonths">
       </alert-list>
     </panel>
   </main>

   <footer>
     <h5>MMVS Copyright 2015</h5>
   </footer>

 </page>
 {% endhighlight %}
 
I'll use this as a base to look at how we code components as directives, then move on to cover transclusion, multi-transclusion, directive communication and testing. 
 
I'll start looking at the individual components in [part 2]({{ "/2015/03/29/web-components-using-angular-part-2.html" | prepend: site.baseurl }}), beginning with the month-picker.


