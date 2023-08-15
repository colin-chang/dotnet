# 认证

在安全领域，认证和授权是两个重要的主题。认证是安全体系的第一道屏障，是守护整个应用或者服务的第一道大门。当访问者请求进入的时候，认证体系通过验证对方的提供凭证确定其真实身份。认证体系只有在证实了访问者的真实身份的情况下才会允许其进入。

## 1. 身份与用户

认证是一个确定访问者真实身份的过程。ASP.NET 应用的认证系统通过`IPrincipal` 接口表示接受认证的用户。一个用户可以具有一个或者多个身份，身份通过 `IIdentity` 接口来描述。ASP.NET应用完全采用基于声明的认证与授权方式，声明对应一个`Claim`对象，我们可以利用它来描述用户的身份、权限和其它与用户相关的信息。

### 1.1 身份

#### 1.1.1 IIdentity

用户总是以某个声称的身份向目标应用发起请求，认证的目的在于确定请求者是否与其声称的这个身份相符。身份通过 `IIdentity` 接口来描述。

```csharp
public interface IIdentity
{
    string? Name { get; }
    string? AuthenticationType { get; }
    bool IsAuthenticated { get; }
}
```

用户身份总是具有一个确定的名称，该名称体现为`IIdentity`接口的`Name`属性。另一个布尔类型的 `IsAuthenticated` 属性表示身份是否经过认证，只有身份经过认证的用户才是值得信任的。`AuthenticationType`属性则表示采用的认证类型。

#### 1.1.2 Claim

由于ASP.NET应用完全采用基于声明的认证与授权方式，这种方式对`IIdentity`对象的具体体现就是我们可以将任意与身份、权限及其它用户相关的信息以声明的形式附加到`IIdentity` 对象之上。

声明是用户在某个方面的一种陈述，一般来说，声明应该是身份得到确认之后由认证方赋予的，声明可以携带任何与认证用户相关的信息，它们可以描述用户的身份（如Email、电话号码或者指纹），也可以描述用户的权限（如拥有的角色或者所在的用户组）或者其它描述当前用户的基本信息（如性别、年龄和国籍等）。声明通过`Claim` 类型来表示，声明最终会作为认证票据（`Authentication Ticket`）的一部分在网络中传递，它的`Subject`属性返回作为声明陈述主体的`ClaimsIdentity`对象。

```csharp
public class Claim
{
    public ClaimsIdentity? Subject { get; }
    public string Type { get; }
    public string Value { get; }
    public string ValueType { get; }
    public IDictionary<string, string> Properties { get; }
    public string Issuer { get; }
    public string OriginalIssuer { get; }
}
```

`Claim`的`Type`属性和`Value`属性分别表示声明陈述的类型与对应的值。如果利用一个`Claim`对象来承载用户的Email地址，那么`Type`属性的值就是`EmailAddress`，`Value`属性的值就是具体的 Email地址（如 `zhangcheng5468@gmail.com`）。除了单纯采用键值对（`Type`相当于 `Key`）陈述声明，原则上，我们可以采用任何字符串来表示声明的类型，但对于一些常用的声明，微软定义了标准的类型，它们以常量的形式定义在静态类型 `ClaimTypes` 中。

```csharp
public static class ClaimTypes
{
    internal const string ClaimType2005Namespace = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims";
    
    public const string Name = ClaimType2005Namespace + "/name";
    public const string Surname = ClaimType2005Namespace + "/surname";
    public const string GivenName = ClaimType2005Namespace + "/givenname";
    public const string Gender = ClaimType2005Namespace + "/gender";
    public const string DateOfBirth = ClaimType2005Namespace + "/dateofbirth";
    public const string Email = ClaimType2005Namespace + "/emailaddress";
    public const string MobilePhone = ClaimType2005Namespace + "/mobilephone";
    public const string Country = ClaimType2005Namespace + "/country";
    public const string PostalCode = ClaimType2005Namespace + "/postalcode";
    public const string Webpage = ClaimType2005Namespace + "/webpage";
    //...
}
```

如果需要附加一些额外信息，我们还可以将它们添加到由`Properties`属性表示的数据字典中。声明可以用来陈述任意主题，所以声明的“值”针对不同的主题会具有不同的表现形式，或者具有不同的数据类型，`ValueType`属性则用于记录原本的类型。声明是否能够信任取决于它由谁颁发。`Claim` 对象的`Issuer` 属性和 `OriginalIssuer` 属性代表声明的颁发者，前者代表当前颁发者，后者代表最初颁发者。在一般情况下，这两个属性会返回相同的值。

#### 1.1.3 ClaimsIdentity

`ClaimsIdentity` 对象就是一个携带声明的 `IIdentity` 对象。`ClaimsIdentity`类型除了实现定义在 `IIdentity`接口中的 3个只读属性（`Name`、`IsAuthenticated`和`AuthenticationType`），还具有一个集合类型的`Claims`属性，用来存放携带的所有声明。

```csharp
public class ClaimsIdentity : IIdentity
{
    string? Name { get; }
    string? AuthenticationType { get; }
    bool IsAuthenticated { get; }

    public virtual IEnumerable<Claim> Claims{ get; }
}
```

一个 ClaimsIdentity对象从本质上来说就是对一组 Claim对象的封装，所以它提供了如下这些操作声明的方法。

```csharp
public class ClaimsIdentity : IIdentity
{
    public virtual void AddClaim(Claim claim);
    public virtual void AddClaims(IEnumerable<Claim?> claims);
    public virtual void RemoveClaim(Claim? claim);
    public virtual bool TryRemoveClaim(Claim? claim);
    public virtual IEnumerable<Claim> FindAll(Predicate<Claim> match);
    public virtual IEnumerable<Claim> FindAll(string type);
    public virtual Claim? FindFirst(Predicate<Claim> match);
    public virtual Claim? FindFirst(string type);
    public virtual bool HasClaim(Predicate<Claim> match);
    public virtual bool HasClaim(string type, string value);
}
```

一个 `ClaimsIdentity` 对象往往携带与权限相关的声明，权限控制系统会利用这些声明确定是否允许当前用户访问目标资源或者执行目标操作。由于基于角色的授权方式是最常用的，为了方便获取当前用户的角色集合，`ClaimsIdentity`对象会提供角色对应的声明类型。表示身份是否经过认证的 `IsAuthenticated` 属性的值取决于`ClaimsIdentity` 对象是否具有一个确定的认证类型。

```csharp
public class ClaimsIdentity : IIdentity
{
    public const string DefaultNameClaimType = ClaimTypes.Name;
    public const string DefaultRoleClaimType = ClaimTypes.Role;
    public const string DefaultIssuer = @"LOCAL AUTHORITY";

    public string NameClaimType { get; }
    public string RoleClaimType { get; }
    public virtual bool IsAuthenticated => !string.IsNullOrEmpty(_authenticationType);
}
```

#### 1.1.4 GnericIdentity

`GnericIdentity`是`ClaimsIdentity`的一个常用子类，`GenericIdentity`表示一个泛化的身份，所以它是一个我们经常使用的 `IIdentity`实现类型。

```csharp
public class GenericIdentity : ClaimsIdentity
{
    public GenericIdentity(string name);
    public GenericIdentity(string name, string type);
}
```

对于一个 `ClaimsIdentity`对象来说，表示是否经过认证的 `IsAuthenticated`属性的值取决于它是否被设置了一个确定的认证类型。但是`GenericIdentity`重写的`IsAuthenticated`方法改变了这个默认逻辑，它的 `IsAuthenticated` 属性的值取决于它是否具有一个确定的用户名，如果表示用户名的 `Name` 属性是一个空字符串（由于构造函数做了验证，所以用户名不能为 `Null`），该属性就返回`False`。

### 1.2 用户

#### 1.2.1 IPrincipal

对于ASP.NET应用的认证系统来说，接受认证的那个对象可能对应一个人，也可能对应一个应用、一个进程或者一个服务。不管这个对象是何种类型，我们统一采用一个具有如下定义的 `IPrincipal` 接口来表示。

```csharp
public interface IPrincipal
{
    IIdentity? Identity { get; }
    bool IsInRole(string role);
}
```

一个表示认证用户的 `IPrincipal` 对象必须具有一个身份，该身份通过只读属性`Identity` 来表示。`IPrincipal` 接口还有一个名为 `IsInRole` 的方法，用来确定当前用户是否被添加到指定的角色之中。

#### 1.2.2 ClaimsPrincipal

基于声明的认证与授权场景下的用户体现为一个 `ClaimsPrincipal` 对象，它使用 `ClaimsIdentity` 来表示其身份。一个`ClaimsPrincipal` 对象代表一个用户，一个用户可以具有多个身份，所以一个`ClaimsPrincipal`对象是对多个 `ClaimsIdentity`对象的封装。`ClaimsPrincipal` 的`Identities` 属性用于返回这组 `ClaimsIdentity` 对象，我们可以调用`AddIdentity` 方法或者 `AddIdentities` 方法为其添加任意的身份。虽然一个 `ClaimsPrincipal` 对象具有多个身份，但是它需要从中选择一个作为主身份（`Primary Identity`），它的`Identity`属性返回的就是作为主身份的`ClaimsIdentity`对象。对于实现的 `IsInRole` 方法来说，如果包含的任何一个 `ClaimsPrincipal` 具有基于角色的声明，并且该声明的值与指定的角色一致，该方法就会返回`True`。

```csharp
public class ClaimsPrincipal : IPrincipal
{
    public virtual IIdentity? Identity { get; }
    public virtual IEnumerable<ClaimsIdentity> Identities { get; }

    public virtual void AddIdentity(ClaimsIdentity identity);
    public virtual void AddIdentities(IEnumerable<ClaimsIdentity> identities)
}
```

`ClaimsPrincipal`具有如下一个`Claims`属性，用于返回`ClaimsIdentity`携带的所有声明，我们可以调用 `FindAll` 方法或者 `FindFirst` 方法获取满足指定条件的所有或者第一个声明，也可以调用 `HasClaim` 方法判断是否有一个或者多个 `ClaimsIdentity`携带了某个指定条件的声明。

```csharp
public class ClaimsPrincipal : IPrincipal
{
    public virtual IEnumerable<Claim> Claims { get;}

    public virtual IEnumerable<Claim> FindAll(Predicate<Claim> match);
    public virtual IEnumerable<Claim> FindAll(string type);
    public virtual Claim? FindFirst(Predicate<Claim> match);
    public virtual Claim? FindFirst(string type);
    public virtual bool HasClaim(Predicate<Claim> match);
    public virtual bool HasClaim(string type, string value);
}
```

#### 1.2.3 GenericPrincipal

GenericPrincipal是ClaimsPrincipal的一个常用子类，`GenericIdentity`表示一个泛化的用户，所以它是一个我们经常使用的 `IPrincipal`实现类型。

```csharp
public class GenericPrincipal : ClaimsPrincipal
{
    public GenericPrincipal(IIdentity identity, string[]? roles)

    public override IIdentity Identity { get; }
}
```

`GenericPrincipal`的构造函数对此做了针对性处理，如果我们指定的不是一个 `ClaimsIdentity`对象，它就会被转换成 `ClaimsIdentity`类型。

## 2. 认证模型

### 2.1 认证票据

#### 2.1.1 票据模型

ASP.NET用的认证通过`AuthenticationMiddleware`实现，该中间件在处理分发给它的请求时会按照指定的认证方案（`AuthenticationScheme`）从请求中提取能够验证用户真实身份的数据，我们一般将该数据称为安全令牌（`Security Token`）。ASP.NET 应用下的安全令牌被称为认证票据（`AuthenticationTicket`），所以 ASP.NET 应用采用基于票据的认证方式。

整个认证流程主要涉及下图所示3种针对认证票据的操作，即认证票据的颁发、检验和撤销。我们将这 3 个操作所涉及的 3种角色称为票据颁发者（`Ticket Issuer`）、验证者（`Authenticator`）和撤销者（`Ticket Revoker`），在大部分场景下这 3种角色由同一个主体来扮演。

![基于票据的认证](https://i.loli.net/2021/04/04/8AQuaDGbIySOvKB.png)

颁发认证票据的过程就是登录（`Sign In`）操作。一般来说，用户试图通过登录应用以获取认证票据的时候需要提供可用来证明自身身份的用户凭证（`UserCredential`），最常见的用户凭证类型是“用户名+密码”。认证方在确定对方真实身份之后，会颁发一个认证票据，该票据携带着与该用户有关的身份、权限及其它相关的信息。

一旦拥有了由认证方颁发的认证票据，我们就可以按照双方协商的方式（如通过`Cookie`或者报头）在请求中携带该认证票据，并以此票据声明的身份执行目标操作或者访问目标资源。认证票据一般都具有时效性，一旦过期将变得无效。我们有的时候甚至希望在过期之前就让认证票据无效，以免别人使用它冒用自己的身份与应用进行交互，这就是注销（`Sign Out`）操作。

ASP.NET 的认证系统旨在构建一个标准的模型，用来完成针对请求的认证以及与之相关的登录和注销操作。

#### 2.1.2 AuthenticationTicket

ASP.NET采用的是基于票据的认证，认证票据通过一个 `AuthenticationTicket` 对象表示。一个`AuthenticationTicket` 对象实际上是对一个 `ClaimsPrincipal` 对象的封装。票据还有一个必需的`AuthenticationScheme`属性，该属性表示采用的认证方案名称。

```csharp
public class AuthenticationTicket
{
    public AuthenticationTicket(ClaimsPrincipal principal, string authenticationScheme);
    public AuthenticationTicket(ClaimsPrincipal principal, AuthenticationProperties? properties, string authenticationScheme);
    
    public string AuthenticationScheme { get; }
    public ClaimsPrincipal Principal { get; }
    public AuthenticationProperties Properties { get; }
}
```

`AuthenticationTicket`的只读属性`Properties`返回一个`AuthenticationProperties`对象，它包含很多与当前认证上下文（`AuthenticationContext`）或者认证会话（`AuthenticationSession`）相关的信息，其中大部分属性是对认证票据的描述。

```csharp
public class AuthenticationProperties
{
    public DateTimeOffset? IssuedUtc { get; set; }
    public DateTimeOffset? ExpiresUtc { get; set; }
    public bool? AllowRefresh { get; set; }
    public bool IsPersistent { get; set; }
    public string? RedirectUri { get; set; }
    
    public IDictionary<string, string?> Items { get; }
}
```

出于安全性的考虑，我们不能让认证票据永久有效，而应该将其有效性限制在一个时间范围内。如果超出规定的限期，认证票据的持有人就必须利用其自身的凭证重新获取一张新的票据。认证票据的颁发时间和过期时间通过`AuthenticationProperties` 对象的 `IssuedUtc` 属性与`ExpiresUtc`属性表示

`AuthenticationProperties`的 `IsPersistent`属性表示认证票据是否希望被客户端以持久化的形式保存起来。以浏览器作为客户端为例，如果认证票据被持久化存储，只要它尚未过期，即使多次重新启动浏览器也可以使用它，反之我们将不得不重新登录以获取新的认证票据。

`AuthenticationProperties`的 `RedirectUri`属性携带着一个重定向地址，在不同情况下设置这个属性可以实现针对不同页面的重定向。例如，在登录成功后重定向到初始访问的页面，在注销之后重定向到登录页面，在访问受限的情况下重定向到我们定制的“访问拒绝”页面等。

认证票据是一种私密性数据，请求携带的认证票据不仅是对 `AuthenticationTicket`对象进行简单序列化之后的结果，中间还涉及对数据的加密，我们将这个过程称为对认证票据的格式化。认证票据的格式化通过一个 `TicketDataFormat`对象表示的格式化器来完成。

### 2.2 认证处理器

得益于ASP.NET提供的这个极具扩展性的认证模型，我们可以为ASP.NETCore应用选择不同的认证方案。认证方案在认证模型中通过`AuthenticationScheme` 类型标识，一个`AuthenticationScheme` 对象的最终目的在于提供该方案对应的认证处理器类型。

认证处理器在认证模型中通过`IAuthenticationHandler` 接口表示，每种认证方案都对应针对该接口的实现类型，该类型承载了认证方案所需的所有操作。

#### 2.2.1 质询/响应模式

质询/响应模式体现了这样一种消息交换模型：如果服务端（认证方）判断客户端（被认证方）没有提供有效的认证票据，它会向对方发送一个质询消息。客户端在接收到该消息后会重新提供一个合法的认证票据对质询予以响应。

质询/响应式认证在Web应用中的实现比较有意思，因为质询体现为响应（`Response`），而响应体现为请求，但这两个响应代表完全不同的含义。前者代表一般意义上对认证方质询的响应，后者则表示认证方通过 HTTP 响应向对方发送质询。服务端通常会发送一个状态码为`401 Unauthorized`的响应作为质询消息。服务端除了通过发送质询消息促使客户端提供一个有效的认证票据，如果通过认证的请求无权执行目标操作或者获取目标资源，它也会以质询消息的形式来通知客户端。一般来说，这样的质询消息体现为一个状态码为`403 Forbidden`的响应。`IAuthenticationHandler` 接口只是将前一种质询方法命名为 `ChallengeAsync`，后一种质询方法命名为 `ForbidAsync`。

#### 2.2.2 IAuthenticationHandler

`IAuthenticationHandler` 接口定义了 4 个方法，其中`AuthenticateAsync` 方法最为核心，因为认证中间件最终会调用它来对每个请求实施认证，而 `ChallengeAsync`方法和 `ForbidAsync` 方法旨在实现前面介绍的两种类型的质询，这两个方法都利用一个类型为`AuthenticationProperties`的参数来传递当前上下文的信息。当某个`IAuthenticationHandler`对象被用来对请求实施认证之前，它的 `InitializeAsync` 方法会率先被调用以完成一些初始化的工作，该方法的两个参数分别是描述当前认证方案的`AuthenticationScheme`对象和当前`HttpContext`上下文。

```csharp
public interface IAuthenticationHandler
{
    Task InitializeAsync(AuthenticationScheme scheme, HttpContext context);
    Task<AuthenticateResult> AuthenticateAsync();
    Task ChallengeAsync(AuthenticationProperties? properties);
    Task ForbidAsync(AuthenticationProperties? properties);
}
```

`AuthenticateAsync` 方法在完成对请求的认证之后，会将认证结果封装成一个`AuthenticateResult`对象。如下面的代码片段所示，认证结果具有成功、失败和`None`这3种状态。

```csharp
public class AuthenticateResult
{
    public bool Succeeded { get; }
    public Exception? Failure { get; protected set; }
    public bool None { get; protected set; }

    public ClaimsPrincipal? Principal { get; }
    public AuthenticationTicket? Ticket { get; protected set; }
    public AuthenticationProperties? Properties { get; protected set; }
}
```

一般来说，一个完成的认证方案需要实现请求认证、登录和注销 3 个核心操作。`IAuthenticationHandler`只定义了用来认证请求的方法（`AuthenticateAsync`）和两种基于质询的方法（`ChallengeAsync` 和`ForbidAsync`）。用于注销的`SignOutAsync` 方法定义在了`IAuthenticationSignOutHandler`接口中，用于登录的 `SignInAsync` 方法则定义在`IAuthenticationSignInHandler`接口中。认证处理器类型一般会实现 `IAuthenticationSignInHandler` 接口。

```csharp
public interface IAuthenticationSignOutHandler : IAuthenticationHandler
{
    Task SignOutAsync(AuthenticationProperties? properties);
}
public interface IAuthenticationSignInHandler : IAuthenticationSignOutHandler
{
    Task SignInAsync(ClaimsPrincipal user, AuthenticationProperties? properties);
}
```

认证处理器对象是通过 `IAuthenticationHandlerProvider` 对象提供的。`IAuthenticationHandlerProvider`接口定义了唯一的`GetHandlerAsync`方法，调用 `GetHandlerAsync`方法会提供当前 `HttpContext`上下文，进而获取当前请求的 `IServiceProvider` 对象，然后利用依赖注入容器（`IServiceProvider`）对象,根据认证处理器类型构建提供的`IAuthenticationHandler`对象。认证处理器的类型是由表示认证方案的`IAuthenticationScheme`对象提供的，那么现在的问题就变成如何根据认证方案名称得到对应的 `IAuthenticationScheme` 对象，这个问题需要借助 `IAuthenticationSchemeProvider` 对象来解决。`IAuthenticationScheme`对象。`IAuthenticationSchemeProvider` 对象不仅能够帮助我们提供所需的认证方案，应用采用的认证方案也是通过它来注册的。`AuthenticationSchemeProvider`是`IAuthenticationSchemeProvider`接口的默认实现类型，它利用一个字典对象维护注册认证方案的名称与对应 `AuthenticationScheme` 对象之间的映射关系，而这个映射字段最初的内容由 `AuthenticationOptions` 对象来提供。换句话说，认证方案最初其实是注册到配置选项`AuthenticationOptions`上的。真正注册到 `AuthenticationOptions` 对象上的其实是一个`AuthenticationSchemeBuilder` 对象。当我们通过调用 `AddScheme` 注册一个认证方案时，该方法会创建一个`AuthenticationSchemeBuilder`对象并将其添加到映射字典中。

### 2.3 认证服务

一般情况下进行身份认证的5项核心操作（请求认证、登录、注销和两种类型的质询）在默认情况下都是先通过调用 `IAuthenticationService`服务相应的方法予以执行的（应用程序一般会直接调用`HttpContext` 上下文相应的扩展方法，而这些方法调用还会转移到 `AuthenticationService` 对象上），而作为认证服务的`IAuthenticationService`对象可以根据指定或者注册的认证方案获取作为认证处理器的 `IAuthenticationHandler` 对象并最终执行认证相关方法。

```csharp
public interface IAuthenticationService
{
    Task<AuthenticateResult> AuthenticateAsync(HttpContext context, string? scheme);
    Task ChallengeAsync(HttpContext context, string? scheme, AuthenticationProperties? properties);
    Task ForbidAsync(HttpContext context, string? scheme, AuthenticationProperties? properties);
    Task SignInAsync(HttpContext context, string? scheme, ClaimsPrincipal principal, AuthenticationProperties? properties);
    Task SignOutAsync(HttpContext context, string? scheme, AuthenticationProperties? properties);
}
```

`IAuthenticationService` 能够利用表示认证处理器的 `IAuthenticationHandler` 对象就要求认证处理器类型的所有依赖服务都预先注册在依赖注入框架中，我们通过利用 `IServiceCollection` 接口的`AddAuthentication` 方法进行注册。

已注册的身份验证处理程序及其配置选项被称为“认证方案”。认证方案注册一般方式是调用`IServiceCollection`的`AddAuthentication`方法后调用方案特定的扩展方法（例如 `AddJwtBearer` 或 `AddCookie`）。 这些扩展方法使用 `AuthenticationBuilder`.`AddScheme` 向适当的设置注册方案。

### 2.4 认证中间件

ASP.NET应用的认证实现在一个名为`AuthenticationMiddleware`的中间件中，该中间件在处理分发给它的请求时会按照指定的认证方案（`AuthenticationScheme`）从请求中提取能够验证用户真实身份的数据(`AuthenticationTicket`)并进行安全认证。具体认证实现已经分散到前面介绍的若干服务类型上，这里不再赘述。对于认证通过的请求，认证结果承载的 `ClaimsPrincipal`对象将赋值给 `HttpContext` 上下文的 `User` 属性用来表示当前的认证用户。我们可以调用针对`IApplicationBuilder`接口的`UseAuthentication`方法来注册`AuthenticationMiddleware`中间件。

请在要进行身份验证的所有中间件之前调用 `UseAuthentication`。 如果使用终结点路由，则必须按以下顺序调用 `UseAuthentication`：

* 在 `UseRouting`之后调用，以便路由信息可用于身份验证决策。
* 在 `UseEndpoints` 之前调用，以便用户在经过身份验证后才能访问终结点。

## 3. 认证案例

### 3.1 认证示例

下面我们通过一个简单案例来演示Asp.Net认证过程。我们会采用基于`Cookie`的认证方案，该认证方案采用`Cookie`来携带认证票据。

我们即将创建的这个ASP.NET应用主要处理3种类型的请求。应用的主页需要在登录之后才能访问，所以针对主页的匿名请求会被重定向到登录页面。在登录页面输入正确的用户名和密码之后，应用会自动重定向到应用主页，该页面会显示当前认证用户名并提供注销的链接。

```csharp{7-8,11,14-16,24,26,62-64,69-70}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services
                .AddRouting()
                .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
                .AddCookie()
            .Configure(app => app
                .UseRouting()
                .UseAuthentication()
                .UseEndpoints(endpoints =>
                {
                    endpoints.Map("/", RenderHomePageAsync);
                    endpoints.Map("Account/Login", SignInAsync);
                    endpoints.Map("Account/Logout", SignOutAsync);
                }))
        )
        .Build().Run();
}

private static async Task RenderHomePageAsync(HttpContext context)
{
    if (context?.User?.Identity?.IsAuthenticated != true)
    {
        await context.ChallengeAsync();
        return;
    }

    context.Response.ContentType = "text/html";
    await context.Response.WriteAsync(
        @$"
            <!DOCTYPE html>
            <html lang='en'>
            <head><title>Index</title>
            </head>
            <body>
                <h3>Welcome {context.User.Identity.Name}</h3>
                <a href='Account/Logout'>Sign Out</a>    
            </body>
            </html>");
}

private static async Task SignInAsync(HttpContext context)
{
    if (string.Equals(HttpMethods.Get, context.Request.Method))
    {
        await RenderSignInPageAsync(context);
        return;
    }

    string username, password;
    username = context.Request.Form[nameof(username)];
    password = context.Request.Form[nameof(password)];
    if (!string.Equals("Colin", username, StringComparison.OrdinalIgnoreCase) ||
        !string.Equals("123456", password, StringComparison.OrdinalIgnoreCase))
    {
        await RenderSignInPageAsync(context, username, password, "invalid username or password");
        return;
    }

    var identity = new GenericIdentity(username, "Password");
    var principal = new GenericPrincipal(identity, null);
    await context.SignInAsync(principal);
}

private static async Task SignOutAsync(HttpContext context)
{
    await context.SignOutAsync();
    await context.ChallengeAsync(new AuthenticationProperties {RedirectUri = "/"});
}

private static async Task RenderSignInPageAsync(HttpContext context, string username = null,
    string password = null,
    string message = null)
{
    context.Response.ContentType = "text/html";
    await context.Response.WriteAsync(
        @$"
            <!DOCTYPE html>
            <html lang='en'>
            <head><title>Sign In</title>
            </head>
            <body>
                <form method='post'>
                    <input type='text' name='username' placeholder='Username' value='{username}' />
                    <input type='password' name='password' placeholder='Password' value='{password}' />
                    <input type='submit' value='Sign In' />
                </form>
                <p style='color:red'>{message}</p>
            </body>
            </html>");
}
```

我们调用AddAuthentication扩展方法注册了认证服务，同时设置了默认采用的认证方案。静态类型CookieAuthenticationDefaults的 AuthenticationScheme属性返回的就是Cookie认证方案的默认方案名称。AddAuthentication方法返回的一个AuthenticationBuilder对象，利用其AddCookie扩展方法完成了针对Cookie认证方案的注册。

以上案例中我们使用`Account/Login`和`Account/Logout`是Cookie认证方案的默认登录注销路径，这些默认配置定义在CookieAuthenticationDefaults类中。基于Cookie的认证的配置可以通过以下方式修改。

```csharp{6-11}
public void ConfigureServices(IServicesCollection services)
{
    services
        .AddRouting()
        .AddAuthentication(options => options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme)
        .AddCookie(options =>
        {
            options.LoginPath = "/Account/SignIn";
            options.LogoutPath = "/Account/SignOut";
            options.Cookie.HttpOnly = true;
        });
}
```

由于我们要求浏览主页必须是经过认证的用户，所以我们利用 `HttpContext` 上下文的 `User` 属性返回的`ClaimsPrincipal`对象判断当前请求是否经过认证(匿名用户验证操作实际是授权验证过程，实现在[`DenyAnonymousAuthorizationRequirement`](authorize#_1-2-1-denyanonymousauthorizationrequirement)，将在下节讲解)。对于匿名请求，我们希望应用能够自动重定向到登录路径。从如上所示的代码片段可以看出，我们仅仅调用当前`HttpContext`上下文的`ChallengeAsync`扩展方法就完成了针对登录路径的重定向。前面提及，注册的登录和注销路径是基于 `Cookie`的认证方案采用的默认路径，所以调用 `ChallengeAsync`方法时根本不需要指定重定向路径。

登录与注销分别实现在 `SignInAsync`方法和 `SignOutAsync`方法中，我们采用的是针对“用户名+密码”的登录方式，如果提供的用户名与密码合法，我们会根据用户名创建一个代表身份的`GenericIdentity`对象，并利用它创建一个代表登录用户的`GenericPrincipal`对象，主页也正是利用它检验当前用户是否是经过认证。我们将`GenericPrincipal`作为参数调用 `HttpContext`上下文的 `SignInAsync`扩展方法即可完成登录。

如果用户提供的用户名与密码不匹配，我们还是会调用 `RenderLoginPageAsync`方法来呈现登录页面，该页面会保留用户的输入并显示错误消息。调用 `HttpContext`上下文的 `ChallengeAsync`方法会将当前路径（主页路径`/`，经过编码后为`%2F`）存储在一个名为 `ReturnUrl`的查询字符串中，`SignInAsync`方法正是利用它实现对初始路径的重定向的。调用当前 `HttpContext`上下文的 `SignInAsync`扩展方法完成注销。

### 3.2 框架解析

通过本节的讲解和以上案例演示，读者应该会对Asp.Net的认证机制有一个比较全面的认知。我们来简单回顾一下认证相关的几个核心操作。

首先是登录操作，开发者自己负责完成用户登录信息的校验(案例中采用 用户名+密码)，确认登录信息合法后，将所有需要保存的用户信息包装成身份(`IIdentity`)对象进而包装成用户对象(`IPrincipal`)，然后以用户对象作为参数调用`HttpContext`的`SignIn`方法，认证框架负责使用注册的认证方案所提供的方法将用户对象加密并包装为认证票据并颁发给客户端，以上案例通过`Cookie`发送票据。

客户端获得票据之后每次请求服务端都需要带着票据，以上案例使用`Cookie`携带票据，服务端根据客户端票据声明进行身份验证(实际是授权验证过程)，如果合法则允许其访问目标资源，否则通过`ChallengeAsync`发起质询,如果未获得资源访问权限则发起`ForbidAsync`质询。使用认证框架的`SignOutAsync`方法可以撤回票据。

ASP.NET 的认证系统构建了一个标准的认证模型，用来完成针对请求的认证以及与之相关的登录和注销操作。开发者可以基于此标准模型实现自己的认证方案，如基于`Cookie`的认证模型，基于`JWT`的认证模型等。不同认证方案都基于Asp.NET的认证框架实现，所以使用体验基本一致。

Asp.Net认证模型中只是将部分必要的认证信息以票据的方式保存在客户端，票据虽然经过安全加密但仍不建议存储太多敏感信息。

不难发现Asp.Net基于`Cookie`的认证方案与传统Asp.NET基于`Cookie`的会话(`Session`)机制完全不同。基于`Cookie`的认证方案将用户信息(票据)存储在客户端，服务端负责验证票据，而`Sesion`机制则是把用户信息是记录在服务端，仅在`Cookie`中记录`session_id`。

另外，如果ASP.NET站点使用了负载均衡部署了多个实例，就要做[ASP.NET Data Protection`](https://docs.microsoft.com/zh-cn/aspnet/core/security/data-protection/configuration/overview?view=aspnetcore-5.0)的配置，否则ASP.NET跨多个实例进行`Cookie`身份认证会失败。
