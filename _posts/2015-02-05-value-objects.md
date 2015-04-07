---
layout: post
title: Mapping DDD Value Objects using JPA - Part 1
tags: [DDD, JPA]
header-img: "img/java3.jpg"
---
In a recent project I drew upon a number of concepts from [Domain Driven Design](http://dddcommunity.org/). Among them Value Objects, which Eric Evans says:

> represent a descriptive aspect of the domain that has no conceptual identity
>- <i>(Evans 2003)</i>

In terms of creating them he offers the following advice:

>When you care only about the attributes of an element of the model, classify it as a VALUE OBJECT. Making it express the meaning of attributes it conveys and give it related functionality. Treat the VALUE OBJECT as immutable. Don’t give it any identity and avoid the design complexities necessary to maintain ENTITIES
>- <i>(ibid.)</i>

I'd like to outline what a Value Object is in this context and show a simple approach to using them in an application that uses JPA with a relational database.

By way of example I'll use a (simplified) Value Object from my last project, `Month` - which denotes a 'specific month in a specific year'. It could be (and at some point was) represented by a `String` with the format 'yyyyMM'. I'll try and show that representing it as a Value Object brings many advantages, including cleaner code, in-situ validation, and serving as a place to put increasing functionality as the project progresses.

###'Good' Value Objects
Re-jigging Evans' quote, to make a good Value Object one must:

1. make it express the meaning of its attribute(s)
2. treat it as immutable
3. don’t give it any identity
4. give it related functionality

###1. Make it express the meaning of its attribute(s)
The Value Object we want to create is used to represent a single attribute -- a 'month in a year'. It wraps a `String` object that holds the month in the format 'yyyyMM'. However, Evans seems to be steering us away from calling it something ending in `Wrapper`, towards "expressing the meaning of the attribute it conveys". To this end, we could choose to express this attribute in a class named something along the lines of `YearMonth`, `MonthInYear` or `Month` <sup>[[1]](#notes)</sup>:

	public class Month {
		private final String value;
	
		public Month(String value) {
			this.value = value;
		}
	}

Now when we work with months the code is more readable, conveying <i>the concept of the attribute being wrapped</i>. 
	
###2. Treat it as immutable
There are no setters in `Month` to mutate the `value`. And we've declared the field itself `final`. This covers most usage scenarios for immutability. Of course, creating a robust immutable object in Java is [a little more involved](http://docs.oracle.com/javase/tutorial/essential/concurrency/imstrat.html) than is shown here. Also, if we use reflection, nothing is immutable.

>Immutability of an attribute or object can be declared in some languages and environments and not in others. These features are helpful for communication of the design decision, but not essential. (Evans 2003)

The important thing is that we <i>treat</i> it as immutable, and try to make that clear to future maintainers of the system through the design on the class.

###3. Don’t give it any identity
Value Objects have no identity apart from the combination of their field values. Thus two Value Objects with the same field values can be considered as the same object from the perspective of the application. 

It is common, then, to see Value Objects use all of their fields in `equals()` and `hashCode()` calculations. This is in opposition to an Entity where these methods usually compare on some form of ID.

`Month` has no database or domain identity, so no ID in the calculations. A combination of the fields are used instead (in this case the single field `value`):


	@Override
	public int hashCode() {
		final int prime = 31;
		int result = 1;
		result = prime * result + ((value == null) ? 0 : value.hashCode());
		return result;
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj) return true;
		if (obj == null) return false;
		if (getClass() != obj.getClass()) return false;
		Month other = (Month) obj;
		if (value == null) {
			if (other.value != null) return false;
		} else if (!value.equals(other.value)) {
			return false;
		}
		return true;
	}

The fact that two different `Month` objects are equal so long as their `value` is the same should alert us to the fact this is indeed a Value Object. We should be able to exchange one Value Object for another without code that uses these objects caring.  

###4. Give it related functionality
Our Value Object now becomes a magnet for any month-related functionality. We'll start with some (over-simplified) validation, using a `static isValid()` method so that calling code can do a pre-creation validity check if it so chooses:

	public class Month {
		private final String value;
	
		public Month(String value) {
			if(!isValid(value)) {
				throw new DomainValidationException("Not a valid month " + value);
			}
			this.value = value;
		}
	
		
		public static boolean isValid(String yearMonth) {
			if(yearMonth == null || !isInteger(yearMonth) || yearMonth.length() != 6) {
				return false;
			}
			return true;
		}
		
		private static boolean isInteger(String s) {
			try {
				Integer.parseInt(s);
			} catch(NumberFormatException e) {
				return false;
			}
			return true;
		}
		
		// ... code omitted for brevity ...
		
	}

The `isValid()` method is where we locate our increasing understanding of what it means for a `Month` object to be valid. Through this process it becomes increasingly difficult to create an invalid `Month`. And it's always clear in our calling code that we are dealing with months:

	String myMonthString = "201501";
	if(Month.isValid(myMonthString)) {
		new Month(myMonthString);
	}
	
	new Month(null); // throws Exception
	
	new Month("20150"); // throws Exception
	
	new Month("abcdef"); // throws Exception

Also, whenever the need for new month-related functionality, there is an obvious place to put it. Here we add some functionality to compare two `Month` objects:

	public class Month implements Comparable<Month> {
		
		// ... code omitted for brevity ...
			
		public boolean isBefore(Month other) {
			return this.compareTo(other) == -1;
		}
		
		public boolean isAfter(Month other) {
			return this.compareTo(other) == 1;
		}
	
		@Override
		public int compareTo(Month other) {
			if(other == null) {
				throw new NullPointerException();
			}
			Integer thisMonth = Integer.valueOf(this.value);
			Integer otherMonth = Integer.valueOf(other.getMonthAsString());
			if(thisMonth < otherMonth) {
				return -1;
			} else if(thisMonth > otherMonth) {
				return 1;
			}
			return 0;
		}
	
		// ... code omitted for brevity ...
		
	}	

Now we have followed Eric's guidelines to identify/create a Value Object, let's look moment at what we have gained.

##What we gain
First, because our concept of 'month in a year' is encapsulated in the `Month` class, it is easily testable. If we had used a `String` to represent it, we would undoubtedly be re-testing the responses to different month `Strings` at various layers of the application, some of which may require a container. Although some of this testing may still be necessary, repetition is greatly reduced.
 
Second, because a `Month` validates itself, there is less validation code elsewhere. This is really a more specific version of the previous point. But given that we no longer need to test for responses to invalid values for the month `String` anywhere else in the application, it deserves a mention. Since we can't construct an invalid `Month`, there is nothing to test for outside the `Month` itself.

Third, code that uses the `Month` class becomes more succinct and more readable. Non-developers are more likely to understand the logic than if we had stuck to the `String` representation.

Forth, tracking the lifecycle of an Entity has a degree of overhead and complexity associated with it, even with modern ORM frameworks. If we utilise Value Objects fully we will have a simpler, more maintainable and performant system.

There's probably more.

Before concluding Part 1 of this 2-part post, its worth mentioning another (perhaps obvious) feature of Value Objects.

##Composite Value Objects

>A VALUE OBJECT can be an assemblage of other objects (Evans 2003)

When you think about it, there is nothing to stop us creating Value Objects from other Value Objects.  Continuing our example with `Month`, imagine a scenario where we wanted to represent a range of months:

	public class MonthRange {
	
		private final Month start;
		
		private final Month end;
		
		public MonthRange(Month start, Month end) {
			if(!isValid(start, end)) {
				throw new DomainException("Not a valid month range");
			}
			this.start = start;
			this.end = end;
		}
		
		public static boolean isValid(Month start, Month end) {
			return start.isBefore(end);
		}
	
		// ... code omitted for brevity ...
		
	}

The `equals()` and `hashCode()` of this new composite Value Object holds no reference to any identity, as we expect from a Value Object, and is instead made up of the objects constituent fields (themselves Value Objects):

		@Override
		public int hashCode() {
			final int prime = 31;
			int result = 1;
			result = prime * result + ((end == null) ? 0 : end.hashCode());
			result = prime * result + ((start == null) ? 0 : start.hashCode());
			return result;
		}
	
		@Override
		public boolean equals(Object obj) {
			if (this == obj) return true;
			if (obj == null) return false;
			if (getClass() != obj.getClass()) return false;
			MonthRange other = (MonthRange) obj;
			if (end == null) {
				if (other.end != null)
					return false;
			} else if (!end.equals(other.end))
				return false;
			if (start == null) {
				if (other.start != null)
					return false;
			} else if (!start.equals(other.start))
				return false;
			return true;
		} 

##Conclusion to Part 1
If you're anything like me, at some point you will have thought "isn't a lot of this just good design practice that applies to any class?" After all, giving classes meaningful names is just good practice. As is co-locating data and the methods that relate to it within a class -- that's just encapsulation! And this is of course true. In this sense a DDD Value Object is rooted in a wider context of Java best practices.

In [Part 2](/value-objects-2) of this post I will look at how `Embeddables` provide a convenient way to represent Value Objects in a JPA environment.

<hr />

###<a name="notes"></a>Notes

1. The project in question was using Java 7. I think `YearMonth` is a good name to use for this concept, but since Java 8 has [a very nice time API](http://docs.oracle.com/javase/8/docs/api/index.html?java/time/package-summary.html) (goodbye Joda-Time!) which, among other things, provides a `YearMonth` class, this is perhaps not so good a choice.

###Resources
- [Domain-Driven Design: Tackling Complexity in the Heart of Software](http://www.domaindrivendesign.org/books/evans_2003) -- Eric Evans seminal 2003 work on Domain Driven Design.

- [Power Use of Value Objects in DDD](http://www.infoq.com/presentations/Value-Objects-Dan-Bergh-Johnsson) -- A great talk from 2009 by Dan Bergh Johnsson. He works through a detailed example of using Value Objects to simplify a program's architecture and make it more readable and testable.

