---
title: Page layout using Angular directives and multi-transclusion 
layout: post
---
Part 2 looked at creating a component.

In this third installment I want to jump to the opposite extreme of a web page and look at how we can use directives to structure a web page and the components in it and so provide a consistent look and feel to users.

This can be particularly useful when developiong a large site, as it enforces a ...

Returning to the Monthly Message System example, note that each of the parts are included in a *panel* -- a bordered area with a title.

###Creating a panel component using transclusion
The best way to understand the panel component is by looking at its requirements. They are pretty simple. We will be testing with Jasmine, so here they are in a Jasmine-style BDD format:

<pre>
Given a Panel directive
	it should have a heading part that displays a heading
	it should have a content part that includes whatever HTML is between the &lt;panel&gt; tags
	it should allow the heading section to be separately styled
	it should allow the component to be separately styled
</pre>

Here is what it looks like:

<script src="{{site.root}}/angular/js/angular.js"></script>
<div ng-app="panelModule" class="demo row">
	 <panel heading="Some heading here">
		<p>Some content here</p>
	 </panel>
	<script src="{{site.root}}/angular/demo2/panel.js"></script>
</div>

And here is how we want to include it in a page:

{% highlight html linenos %}
<panel heading="Some heading here">
	<!-- content here  -->
</panel>
{% endhighlight %}



