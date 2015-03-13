---
title: Users, Roles and Permissions (unobtrusively) with Spring Security 3.2 using JPA and Java config
layout: post
---
Spring Security 3 (documentation and standard schemas) doesn't seem to allow for the common configuration of User -> Role -> Permission, and instead leans towards hard-coding roles into the security configuration. It encourages us to do this:

	@PreAuthorize("hasRole('ROLE_USER')")
	boolean readFoo();

... rather than this:

	@PreAuthorize("hasPermission('PERM_READ_FOO')")
	boolean readFoo();

I want to show how we can use Spring Security 3 for unobtrusively implementing authorisation, where:

1. Authorisation is based on Permissions, not Roles
2. The core domain model has no knowledge of the security model
3. The security model has no knowledge of how it is implemented (ie. Spring Security)

Source code and tests can be found on [GitHub](https://github.com/tony-waters/example-spring-security). Best understanding can be obtained by running the tests there, but here's the walk-through:

##The core domain
To begin, we will create an entity for our core domain which represents a `Member` -- basically a registered user in the system:

	@Entity
	@Table(name="MEMBER")
	public class Member {
	
		@Id
		@GeneratedValue(strategy = GenerationType.AUTO)
		@Column(name = "ID")
		private Long entityId;
	
		@Version
		@Column(name = "VERSION")
		private Integer version;
	
		@Column(name = "USERNAME")
		private String username;
	
		@Column(name = "FIRST_NAME")
		private String firstName;
	
		@Column(name = "LAST_NAME")
		private String lastName;
	
		public String getUsername() {
			return username;
		}
	}

Here is the SQL:

    create table MEMBER (
        ID bigint generated by default as identity,
        FIRST_NAME varchar(255),
        LAST_NAME varchar(255),
        USERNAME varchar(255),
        VERSION integer,
        primary key (ID)
    )

I have only included this class to represent the core domain, and show how it is not aware of either the security domain nor the security implementation. The only connection between a member and the security domain is the username.

The `Member` knows nothing of security concerns.

##The security domain
We define a separate security domain where we describe the security needs of our application. A user of our system (a `Member`) has a related `Credentials` in the security domain (containing a username and password):

	@Entity
	@Table(name="CREDENTIALS")
	public class Credentials {
	
		@Id
		@Column(name = "USERNAME")
		private String username;
		
		@Column(name = "PASSWORD")
		private String password;
		
		@Column(name = "ENABLED")
		private Boolean enabled;
		
		@Version
		@Column(name = "VERSION")
		private Integer version;
		
		@ManyToMany
		@JoinTable(
			name = "CREDENTIALS_ROLE", 
			joinColumns = {@JoinColumn(name = "USERNAME", referencedColumnName = "USERNAME")}, 
			inverseJoinColumns = {@JoinColumn(name = "ROLE_ID", referencedColumnName = "ID")}
		)
		private Collection<Role> roles = new HashSet<Role>();
		
		// ... code omitted for brevity ...
	}

Specific `Credentials` are associated with one or more `Roles`:

	@Entity
	@Table(name="ROLE")
	public class Role {
		
		@Id
		@GeneratedValue(strategy = GenerationType.AUTO)
		@Column(name = "ID")
		private Long entityId;
	
		@Version
		@Column(name = "VERSION")
		private Integer version;
		
		@Column(name="NAME")
		private String name;
		
		@ManyToMany
		@JoinTable(
			name = "ROLE_PERMISSION", 
			joinColumns = {@JoinColumn(name = "ROLE_ID", referencedColumnName = "ID")}, 
			inverseJoinColumns = {@JoinColumn(name = "PERMISSION_ID", referencedColumnName = "ID")}
		)
		private Collection<Permission> permissions = new HashSet<Permission>();
		
		// ... code omitted for brevity ...
	
	}

And a `Role` is associated with one or more `Permissions`:

	@Entity
	@Table(name="PERMISSION")
	public class Permission {
	
		@Id
		@GeneratedValue(strategy = GenerationType.AUTO)
		@Column(name = "ID")
		private Long entityId;
	
		@Version
		@Column(name = "VERSION")
		private Integer version;
		
		@Column(name="NAME")
		private String name;
	
		// ... code omitted for brevity ...
		
	}

Although representing security concerns, these three classes know nothing of how those concerns are implemented. There is no reference to Spring Security anywhere in the [source code](https://github.com/tony-waters/example-spring-security/tree/master/src/main/java/com/example/model/security). 

Their JPA mappings produce the following five tables:

    create table CREDENTIALS (
        USERNAME varchar(255) not null,
        ENABLED boolean,
        PASSWORD varchar(255),
        VERSION integer,
        primary key (USERNAME)
    )

    create table ROLE (
        ID bigint generated by default as identity,
        NAME varchar(255),
        VERSION integer,
        primary key (ID)
    )
    
    create table PERMISSION (
        ID bigint generated by default as identity,
        NAME varchar(255),
        VERSION integer,
        primary key (ID)
    )
    
    create table CREDENTIALS_ROLE (
        USERNAME varchar(255) not null,
        ROLE_ID bigint not null
    )

    create table ROLE_PERMISSION (
        ROLE_ID bigint not null,
        PERMISSION_ID bigint not null
    )

Having created our security domain classes, lets look at how we would implement this using 'out-of-the-box' Spring Security.

##Spring Security -- UserDetailsService, UserDetails, and GrantedAuthority 
In order to slot into the Spring Security infrastructure we will be working with three Spring interfaces from the `org.springframework.security.core` package.

First, `UserDetailsService`, which is the entry point in this code for Spring Security. It will load the `UserDetails` associated with the provided username:

	public interface UserDetailsService {
	    UserDetails loadUserByUsername(String username) throws UsernameNotFoundException;
	}

`UserDetails` contains security-related information about the user, including what they are allowed to do (`GrantedAuthority`):

	public interface UserDetails extends Serializable {
	    Collection<? extends GrantedAuthority> getAuthorities();
	    String getPassword();
	    String getUsername();
	    boolean isAccountNonExpired();
	    boolean isAccountNonLocked();
	    boolean isCredentialsNonExpired();
	    boolean isEnabled();
	}

A `GrantedAuthority` is a string representation of a permission the user has, such as `PERM_READ_FOO` or `PERM_DELETE_FOO`:

	public interface GrantedAuthority extends Serializable {
	    String getAuthority();
	}

To use Spring Security we will implement a version of `UserDetails` and `UserDetailsService` that works with our security domain classes.

##Implementing the security domain classes using Spring Security
`CredentialsAdapter` is used to integrate our security domain with Spring Security. It adapts a `Credentials` object so it may be treated as a `UserDetails` object:

	public class CredentialsAdapter implements UserDetails {
		
		private Credentials credentials;
		
		public CredentialsAdapter(Credentials credentials) {
			this.credentials = credentials;
		}
		
		@Override
		public Collection<GrantedAuthority> getAuthorities() {
			Set<GrantedAuthority> authorities = new HashSet<GrantedAuthority>();
			for(Role role : credentials.getRoles()) {
				for(Permission permission : role.getPermissions()) {
					authorities.add(new SimpleGrantedAuthority(permission.getName()));
				}
			}
			return authorities;
		}
	
		@Override
		public String getPassword() {
			return credentials.getPassword();
		}
	
		@Override
		public String getUsername() {
			return credentials.getUsername();
		}
	
		// ... code omitted for brevity ...
	}

Notice that `getAuthorities()` now returns a collection of `Credentials` -> `Roles` -> `Permissions`, rather than `Credentials` -> `Roles`.

We use the `CredentialsAdapter` in our implementation of `UserDetailsService`:

	@Service("authService")
	@Transactional
	public class CredentialsService implements UserDetailsService {
		
		@Autowired
		private CredentialsRepository credentialsRepository;
		
		@Override
		public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
			Credentials credentials = credentialsRepository.findOne(username);
			if(credentials == null) {
				throw new UsernameNotFoundException(username);
			}
			return new CredentialsAdapter(credentials);
		}
	}

So we can now write this:

	@PreAuthorize("hasRole('PERM_READ_FOO')")
	boolean readFoo();

And avoid hard-coding roles into our system. Though it would be nicer to have something more descriptive than `hasRole`.

Fortunately, the root class for dealing with Spring Security expression evaluation (`org.springframework.security.access.expression.SecurityExpressionRoot`) provides an `hasAuthority()` method which simply calls the `hasRole()` method. So we can write:

	@PreAuthorize("hasAuthority('PERM_READ_FOO')")
	boolean readFoo();


###Conclusion
While Spring Security doesn't appear to support it 'out-of-the-box', it is easily adapted to work in an environment where:

1. Authorisation is based on Permissions, not Roles
2. The core domain model has no knowledge of the security model
3. The security model has no knowledge of how it is implemented (ie. Spring Security)

Source code and tests can be found on [GitHub](https://github.com/tony-waters/example-spring-security).
