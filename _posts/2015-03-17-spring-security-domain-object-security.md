---
title: Domain Object Security without ACLs using Spring Security 3.2
layout: post
header-img: "img/spring5.jpg"
---
In my [previous post]({{ "/2015/03/11/spring-security-users-roles-permissions" | prepend: site.baseurl }}) I looked at adapting Spring Security to work with Permissions to avoid hard-coding Roles into the security configuration. In this post I want to move past generic roles and permissions to look at how we can grant or deny access to specific objects within our application.

One solution is to use an ACL, but this can be overkill in some scenarios. So I want to show two methods of introducing domain object security that do not rely on ACLs.

[Source code](https://github.com/tony-waters/example-spring-security/tree/2-domain-object-authorisation) is available on GitHub.

###Domain object security using a Custom PermissionEvaluator

One approach in Spring Security is to provide a custom `PermissionEvaluator`, which:

>... is intended to bridge between the expression system and Spring Security’s ACL system, allowing you to specify authorization constraints on domain objects, based on abstract permissions. It has no explicit dependencies on the ACL module, **so you could swap that out for an alternative implementation if required**.
>
> ~ <i>[Spring 3.2.6 Docs](http://docs.spring.io/spring-security/site/docs/3.2.6.RELEASE/reference/htmlsingle/) - my emphasis</i>

The `PermissionEvaluator` has the following interface:

{% highlight java linenos %}
public interface PermissionEvaluator extends AopInfrastructureBean {
    boolean hasPermission(Authentication authentication, 
    		Object targetDomainObject, Object permission);
    boolean hasPermission(Authentication authentication, 
    		Serializable targetId, String targetType, Object permission);
}
{% endhighlight %}

The idea is that you use the first method if you have the object itself, and the second method if you just have the ID. The methods correspond to the following expressions within our service methods (the `Authentication` parameter is automatically added by Spring):

{% highlight java linenos %}
@PreAuthorize("hasPermission(#member, 'isOwner')")
void createMember(Member member);

@PreAuthorize("hasPermission(#id, 'Member', 'isOwner')")
void deleteMember(Long id);	
{% endhighlight %}

By default, Spring uses a `DenyAllPermissionEvaluator`, which simply denies all requests from `hasPermission`. We will replace this with our own implementation. 

Consider the common scenario where we want to restrict operations on a `Member` object to just the owner of that object. Here is a simple implementation of `PermissionEvaluator` that does this:

{% highlight java linenos %}
public class MemberPermissionEvaluator implements PermissionEvaluator {
	
	@Autowired
	private MemberRepository memberRepository;

	@Override
	public boolean hasPermission(Authentication authentication, 
			Object targetDomainObject, Object permission) {
		boolean hasPermission = false;
		if(targetDomainObject != null && targetDomainObject instanceof Member) {
			Member member = (Member)targetDomainObject;
			UserDetails userDetails = (UserDetails)authentication.getPrincipal();
			hasPermission = userDetails.getUsername().equals(member.getUsername());
		}
		return hasPermission;
	}

	@Override
	public boolean hasPermission(Authentication authentication, Serializable targetId, String targetType, Object permission) {
		boolean hasPermission = false;
		if(targetId != null && targetId instanceof Long && "Member".equals(targetType)) {
			Long id = (Long)targetId;
			Member member = memberRepository.findOne(id);
			if(member != null) {
				UserDetails userDetails = (UserDetails)authentication.getPrincipal();
				hasPermission = userDetails.getUsername().equals(member.getUsername());
			}
		}
		return hasPermission;
	}
}
{% endhighlight %}

Now when we run our tests, a logged in user can only perform operations on its own associated `Member`.

Since Spring Security uses a single `PermissionEvaluator`, should we require similar restrictions placed on other objects (which is likely), then we would have to write a better `PermissionEvaluator` that delegated to other `PermissionEvaluators`<sup>[[1]](#notes)</sup>. So while this approach provides a flexible hook into Spring Security, there is some boilerplate code to write if we want to deal with anything except the simplest requirements. At the other extreme, the flexibility of the `PermissionEvaluator` interface can sometimes make it appear over-general for simple domain object needs -- like the example given here -- leaving us having to work with unecessarily complex signitures and generic `Objects`.

An alternative is to use Spring's Expression Language.

###Domain Object security using Spring Expression Language
Because the string passed into `@PreAuthorize` and `@PostAuthorize` annotations is parsed as a Spring Expression Langauge (SpEL) expression, we can write something like this:

{% highlight java linenos %}
@PreAuthorize("#member.username == principal.username")
void updateMember(Member member);
{% endhighlight %}

Where `#member` references an argument in the method signature. That is to say, it refers to the object that is passed in to the method when the security check is performed. And `principal` is the currently logged-in user. The available variables are derived from `SecurityExpressionRoot`, with others added depending on the context. In our example we also have access to the public fields and methods from `MethodSecurityExpressionRoot`. This latter class provides a `getReturnObject()` method, which allows us to write:

{% highlight java linenos %}
@PostAuthorize("returnObject!=null and returnObject.username.equals(principal.username)")
Member readMember();
{% endhighlight %}

This is an extremely powerful feature. We can use it to construct increasingly detailed security constraints for our application.

Since our security expressions could get complex, we won't do that. Instead, lets encapsulate this into a component:

{% highlight java linenos %}
@Component("memberPermissions")
public class MemberPermissions {

	public boolean isOwner(Member targetDomainObject) {
		boolean hasPermission = false;
		if(targetDomainObject != null) {
			Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
			UserDetails userDetails = (UserDetails)authentication.getPrincipal();
			hasPermission = userDetails.getUsername().equals(targetDomainObject.getUsername());
		}
		return hasPermission;
	}
}
{% endhighlight %}

The Explression Language allows accessing any registered bean by preceding it with an `@` symbol<sup>[[2]](#notes)</sup>. Since `MemberPermissions` is a `Component` we can access it from our method security annotations using its name, `memberPermissions`. From there we can call one of its methods, passing a `Member` object as a parameter: 

{% highlight java linenos %}
@PreAuthorize("@memberPermissions.isOwner(#member)")
void updateMember(Member member);
{% endhighlight %}

Similarly, we can use the `getReturnObject()` method from `MethodSecurityExpressionRoot` to authorise based on a methods return value:

{% highlight java linenos %}
@PostAuthorize("@memberPermissions.isOwner(returnObject)")
Member readMember();
{% endhighlight %}

If we want to add more permissions, we just add other methods:

{% highlight java linenos %}
@Component("memberPermissions")
public class MemberPermissions {

	public boolean isOwner(Member targetDomainObject) {
		boolean hasPermission = false;
		if(targetDomainObject != null) {
			Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
			UserDetails userDetails = (UserDetails)authentication.getPrincipal();
			hasPermission = userDetails.getUsername().equals(targetDomainObject.getUsername());
		}
		return hasPermission;
	}
	
	public boolean isCollaborator(Member targetDomainObject) {
	
		// ... code here ...
		
	}
}
{% endhighlight %}

And if we want to work with other domain objects we can give that type its own `***Permissions` class.

Its hard not to like this approach. Apart from the `@Component` annotation, there is no other configuration necessary. We can use `MemberPermissions` within our security annotations straight away. This makes adding new domain object security rules straightforward. We can also easily add other methods (like `isEditor()`, `isReviewer()`) just by adding another method to `MemberPermissions`.

There is a great deal of flexibility here too. For example, if we so choose we can pass in in a value for the current `principal`in the authorisation annotations:

{% highlight java linenos %}
@PreAuthorize("@memberPermissions.isOwner(#member, principal)")
void updateMember(Member member);
{% endhighlight %}

And so simplify our `MemberPermissions` code (note the automatic casting to `UserDetails`):

{% highlight java linenos %} 
public boolean isOwner(Member targetDomainObject, UserDetails principal) {
	boolean hasPermission = false;
	if(targetDomainObject != null) {
		hasPermission = principal.getUsername().equals(targetDomainObject.getUsername());
	}
	return hasPermission;
}
{% endhighlight %}

Other nice things about this approach when compared to using a custom `PermissionEvaluator` include the lack of superfluous code, the cleaner design (we can choose to implement it as we wish), the use of `Member` explicitly rather than generic `Objects` and the corresponding automatic casting.

###And finally ...
Be aware that these expressions have changed a little over time, for example in earlier versions of Spring Security you would write the expression without the `@` symbol (see Note 2 below).

The source is available on [GitHub](https://github.com/tony-waters/example-spring-security/tree/2-domain-object-authorisation). It contains all the examples here including some basic tests. 
<hr />
##<a name="notes"></a>Notes
1. Examples of how to do this can be seen [here](http://blog.solidcraft.eu/2011/03/spring-security-by-example-securing.html), [here](http://www.disasterarea.co.uk/blog/protecting-service-methods-with-spring-security-annotations/), and [here](http://www.borislam.com/2012/08/writing-your-spring-security-expression.html).

2. This feature is not available in Spring Security 3.0. It is available 3.1 but you must leave out the `@` symbol. It works as shown in 3.2. See [here](http://forum.spring.io/forum/spring-projects/security/100708-spel-and-spring-security-3-accessing-bean-reference-in-preauthorize) for discussion and a workaround for Spring Security 3.0.

<hr />
##Resources
- [Spring Expression Language Reference](http://docs.spring.io/spring/docs/current/spring-framework-reference/html/expressions.html)
