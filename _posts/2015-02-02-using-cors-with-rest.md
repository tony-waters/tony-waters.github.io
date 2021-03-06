---
layout: post
title: Using CORS to simplify development of distributed Server and Client applications
tags: [CORS, Spring, AngularJs, Eclipse, NetBeans]
header-img: "img/java4.jpg"
---
In these post-JSP days it can sometimes be convenient to develop your clent and server code completely separate, even though they may be co-located in production. This is particularly the case when client and server code is being worked on by different teams, but is not limited to this scenario. Separate development of client and server code can mean that the client has to make calls to a service on a different server (maybe in a different country, or just a different port on localhost), which may not be allowed because of the [Same-Origin Policy](http://en.wikipedia.org/wiki/Same-origin_policy) implemented by modern browsers.

I found myself in such a situation last year when developing a Spring REST service feeding an AngularJs client. My IDE, Eclipse, was great when developing the server code, but when I began coding the client I was bedazzled by [the great support provided in NetBeans 8](https://blogs.oracle.com/geertjan/entry/integrated_angularjs_development). Consequently I found myself switching between Eclipse and NetBeans depending upon whether I was writing server or client code. No real problem there. It seemed like the best of both worlds. That is until I began to use Angulars Ajax caperbilities to make calls to the REST server. Though they were both running on localhost, they were using different ports. Spring REST on the predictable `8080`,  and NetBeans on `8383`. Which from a Same Origin Policy perspective, is not allowed.

Now, there's obviously more than one way to solve this problem. I could co-locate the client and server source and configure the different IDEs to only act on particular sections of it, or perform a little source copying during the build process to make sure everything was in one place. In both of these solutions the Same Origin Policy goes away because the client and server are co-located when running, and we can forget we ever heard of it.

An alternative is to <i>allow</i> the client and server to be distributed (if only a port away) in the development environment(s). If we take this route, we have to tell the server to accept requests from locations other than its own using [Cross-Origin Resource Sharing](http://www.w3.org/TR/cors/) or CORS.

In JEE we can do this using a `Filter`. Add Spring to the mix and we can annotate the filter as a `@Component` so it is included without any further work. Here's the finished class:

{% highlight java linenos %}
import java.io.IOException;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Component;

@Component
public class CorsFilter implements Filter {

	public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
		HttpServletResponse response = (HttpServletResponse) res;
		response.setHeader("Access-Control-Allow-Origin", "*");
		response.setHeader("Access-Control-Allow-Methods", "POST, GET, PUT, OPTIONS, DELETE");
		response.setHeader("Access-Control-Max-Age", "3600");
		response.setHeader("Access-Control-Allow-Headers", "x-http-method-override, x-requested-with, content-Type, origin, authorization, accept, client-security-token");
		chain.doFilter(req, res);
	}

	public void init(FilterConfig filterConfig) {
		// do stuff when filter created
	}

	public void destroy() {
		// do stuff when filter destroyed
	}
}
{% endhighlight %}
