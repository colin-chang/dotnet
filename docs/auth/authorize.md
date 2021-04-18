# 授权

认证旨在确定用户的真实身份，而授权则是通过权限控制使用户只能做其允许做的事。授权的本质就是通过设置一个策略来决定究竟具有何种特性的用户会被授权访问某个资源或者执行某个操作。我们可以采用任何授权策略，如可以根据用户拥有的角色进行授权，也可以根据用户的等级和所在部门进行授权，有的授权甚至可以根据用户的年龄、性别和所在国家来进行。认证后的用户体现为一个`ClaimsPrincipal` 对象，它携带的声明不仅仅用于描述用户的身份，还携带了上述这些构建授权策略的元素，所以授权实际上就是检查认证用户携带的声明是否与授权策略一致的过程。

ASP.NET Core应用的授权是由通过`IAuthorizationService`接口表示的服务提供的。`IAuthorizationService` 服务提供了分别针对 `IAuthorizationRequirement` 和`AuthorizationPolicy`的授权方案

## 1. 基于“要求”的授权
### 1.1 IAuthorizationRequirement
`IAuthorizationRequirement` 接口表示授权访问目标资源或者操作在某个方面需要满足的要求（`Requirement`）。由于“授权要求”具有不同的表现形式，所以`IAuthorizationRequirement` 仅仅是一个不具有任何成员的“标记接口”。

```csharp
public interface IAuthorizationRequirement{}
public interface IAuthorizationHandler
{
    Task HandleAsync(AuthorizationHandlerContext context);
}
```

`IAuthorizationRequirement` 接口体现了授权用户需要满足怎样的要求，也就是体现了如何检验某个用户是否满足对应的要求，所以大部分`IAuthorizationRequirement` 接口的实现类型也实现了 `IAuthorizationHandler` 接口，后者提供的`HandleAsync`方法实现了对应的授权检验。我们将`IAuthorizationHandler`对象称为授权处理器.

授权处理器的`HandleAsync`方法具有一个类型为`AuthorizationHandlerContext` 的参数，代表授权检验的执行上下文。可以从这个上下文对象中得到待检验的用户（`User`）、授权的目标资源（`Resource`），以及应用到授权目标上的所有`IAuthorizationRequirement`对象，上述 3 个属性体现了授权检验的输入。

```csharp
public class AuthorizationHandlerContext
{
    public virtual ClaimsPrincipal User { get; }
    public virtual object? Resource { get; }
    public virtual IEnumerable<IAuthorizationRequirement> Requirements { get; }

    public virtual bool HasFailed { get; }
    public virtual bool HasSucceeded { get; }
    public virtual IEnumerable<IAuthorizationRequirement> PendingRequirements { get; }
}
```

授权成功和失败的标志通过 `HasSucceeded`属性与 `HasFailed`属性来表示，`PendingRequirements`属性则返回尚未经过检验的`IAuthorizationRequirement`对象。上述 3 个属性体现了授权检验的输出。对于一个刚刚被初始化的`AuthorizationHandlerContext`对象来说，`Requirements`和 `PendingRequirements`具有相同的元素。

在针对某个 `IAuthorizationRequirement`对象实施授权检验的时候，如果不满足授权要求，我们可以直接调用 `AuthorizationHandlerContext`上下文的 `Fail`方法，该方法会将 `HasFailed`属性设置为`True`。反之，如果满足授权规则，我们可以将`IAuthorizationRequirement`对象作为参数调用`Succeed` 方法，该对象会从`PendingRequirements` 属性表示的列表中移除。只有在尚未调用 `Fail`方法并且其`PendingRequirements`属性集合为空的情况下，`AuthorizationHandlerContext`上下文的`HasSucceeded` 属性才会返回 `True`。换句话说，授权成功的前提是必须满足所有 `IAuthorizationRequirement`对象的授权要求。

大部分授权处理器只关注某种单一的授权要求，这样的`IAuthorizationHandler`实现类型一般会派生于`AuthorizationHandler＜TRequirement＞`的抽象类，泛型参数`TRequirement`表示对应的`IAuthorizationRequirement`实现类型。
```csharp
public abstract class AuthorizationHandler<TRequirement> : IAuthorizationHandler where TRequirement : IAuthorizationRequirement
{
    public virtual async Task HandleAsync(AuthorizationHandlerContext context)
    {
        foreach (var req in context.Requirements.OfType<TRequirement>())
            await HandleRequirementAsync(context, req);
    }

    protected abstract Task HandleRequirementAsync(AuthorizationHandlerContext context, TRequirement requirement);
}
```

`AuthorizationHandler＜TRequirement＞`是从授权要求的角度对职责进行单一化的，那么抽象类`AuthorizationHandler＜TRequirement，TResource＞`则在此基础上将职责进一步细化到授权目标资源上。
```csharp
public abstract class AuthorizationHandler<TRequirement, TResource> : IAuthorizationHandler where TRequirement : IAuthorizationRequirement
{
    public virtual async Task HandleAsync(AuthorizationHandlerContext context)
    {
        if (context.Resource is TResource)
            foreach (var req in context.Requirements.OfType<TRequirement>())
                await HandleRequirementAsync(context, req, (TResource)context.Resource);
    }

    protected abstract Task HandleRequirementAsync(AuthorizationHandlerContext context, TRequirement requirement, TResource resource);
}
```

### 1.2 预定义IAuthorizationRequirement
Asp.Net Core中预定义了`IAuthorizationRequirement`的常用实现类型，多数也实现了授权处理器接口 `IAuthorizationHandler`。

#### 1.2.1 DenyAnonymousAuthorizationRequirement
`DenyAnonymousAuthorizationRequirement` 体现的授权要求非常简单，那就是拒绝未被验证的匿名用户访问目标资源。它通过表示用户的`ClaimsPrincipal`对象是否具有一个经过认证的身份来确定当前请求是否来源于匿名用户。

```csharp
public class DenyAnonymousAuthorizationRequirement : AuthorizationHandler<DenyAnonymousAuthorizationRequirement>, IAuthorizationRequirement
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, DenyAnonymousAuthorizationRequirement requirement)
    {
        var user = context.User;
        var userIsAnonymous =
            user?.Identity == null ||
            !user.Identities.Any(i => i.IsAuthenticated);
        if (!userIsAnonymous)
            context.Succeed(requirement);
        return Task.CompletedTask;
    }
}
```

#### 1.2.2 ClaimsAuthorizationRequirement
由于用户的权限大都以声明的形式保存在表示认证用户的 `ClaimsPrincipal` 对象上，所以授权检验实际上就是确定 `ClaimsPrincipal` 对象是否携带所需的授权声明，这样的授权检验是通过`ClaimsAuthorizationRequirement` 对象来完成的。

```csharp
public class ClaimsAuthorizationRequirement : AuthorizationHandler<ClaimsAuthorizationRequirement>, IAuthorizationRequirement
{
    public ClaimsAuthorizationRequirement(string claimType, IEnumerable<string>? allowedValues);

    public string ClaimType { get; }
    public IEnumerable<string>? AllowedValues { get; }

    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, ClaimsAuthorizationRequirement requirement)
    {
        if (context.User != null)
        {
            var found = false;
            if (requirement.AllowedValues == null || !requirement.AllowedValues.Any())
                found = context.User.Claims.Any(c => string.Equals(c.Type, requirement.ClaimType, StringComparison.OrdinalIgnoreCase));
            else
                found = context.User.Claims.Any(c => string.Equals(c.Type, requirement.ClaimType, StringComparison.OrdinalIgnoreCase)
                                                    && requirement.AllowedValues.Contains(c.Value, StringComparer.Ordinal));
            if (found)
                context.Succeed(requirement);
        }
        return Task.CompletedTask;
    }
}
```

如果我们创建 `ClaimsAuthorizationRequirement` 对象时只指定了声明类型，而没有指定声明的候选值，那么在进行授权检验的时候只要求表示当前用户的`ClaimsPrincipal` 对象携带任意一个与指定类型一致的声明即可。反之，如果指定了声明的候选值，那么就需要进行声明值的比较。值得注意的是，**针对声明类型的比较是不区分大小写的，但是针对声明值的比较则是区分大小写的**。

#### 1.2.3 NameAuthorizationRequirement
`NameAuthorizationRequirement` 类型旨在实现针对用户名的授权，也就是说，目标资源的访问授权给某个指定的用户。**用户名比较是区分大小写的**。授权用户的用户名体现为`RequiredName`属性。

```csharp
public class NameAuthorizationRequirement : AuthorizationHandler<NameAuthorizationRequirement>, IAuthorizationRequirement
{
    public NameAuthorizationRequirement(string requiredName);
    public string RequiredName { get; }
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, NameAuthorizationRequirement requirement)
    {
        if (context.User != null)
            if (context.User.Identities.Any(i => string.Equals(i.Name, requirement.RequiredName, StringComparison.Ordinal)))
                context.Succeed(requirement);
        return Task.CompletedTask;
    }
}
```

#### 1.2.4 RolesAuthorizationRequirement
针对角色的授权是最常用的授权方式。在这种授权方式下，我们将目标资源与一组角色列表进行关联，如果用户拥有其中任意一个角色，则意味着该用户具有访问目标资源的权限。与目标资源关联的角色列表存储于 `AllowedRoles` 属性表示的集合中。

```csharp
public class RolesAuthorizationRequirement : AuthorizationHandler<RolesAuthorizationRequirement>, IAuthorizationRequirement
{
    public RolesAuthorizationRequirement(IEnumerable<string> allowedRoles);
    public IEnumerable<string> AllowedRoles { get; }
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, RolesAuthorizationRequirement requirement)
    {
        if (context.User != null)
        {
            bool found = false;
            if (requirement.AllowedRoles == null || !requirement.AllowedRoles.Any())
                // Review: What do we want to do here?  No roles requested is auto success?
            else
                found = requirement.AllowedRoles.Any(r => context.User.IsInRole(r));
            if (found)
                context.Succeed(requirement);
        }
        return Task.CompletedTask;
    }
}
```

#### 1.2.5 AssertionRequirement
一个 `IAuthorizationHandler`对象针对授权规则的检验实际上体现为针对 `AuthorizationHandlerContext` 上下文的断言（`Assert`），该断言可以通过一个类型为 `Func＜AuthorizationHandlerContext，Task＜bool＞＞`的委托来表示。

```csharp
public class AssertionRequirement : IAuthorizationHandler, IAuthorizationRequirement
{
    public Func<AuthorizationHandlerContext, Task<bool>> Handler { get; }
    public AssertionRequirement(Func<AuthorizationHandlerContext, bool> handler);
    public AssertionRequirement(Func<AuthorizationHandlerContext, Task<bool>> handler);
    public async Task HandleAsync(AuthorizationHandlerContext context)
    {
        if (await Handler(context))
            context.Succeed(this);
    }
}
```

#### 1.2.6 OperationAuthorizationRequirement
授权旨在限制非法用户针对某个资源的访问或者对某项操作的执行，而 `OperationAuthorizationRequirement`对象的目的在于将授权的目标对象映射到一个预定义的操作上，所以它只包含如下这个表示操作名称的`Name`属性。

```csharp
public class OperationAuthorizationRequirement : IAuthorizationRequirement
{
    public string Name { get; set; }
}
```

#### 1.2.7 PassThroughAuthorizationHandler
`PassThroughAuthorizationHandler` 是一个特殊的授权处理器类型，`AuthorizationHandlerContext`上下文中所有的 `IAuthorizationHandler` 都是通过该对象驱动执行的。它会从 `AuthorizationHandlerContext`的 `Requirements` 属性中提取所有 `IAuthorizationHandler` 对象，并逐个调用它们的`HandleAsync`方法来实施授权检验。

```csharp
public class PassThroughAuthorizationHandler : IAuthorizationHandler
{
    public async Task HandleAsync(AuthorizationHandlerContext context)
    {
        foreach (var handler in context.Requirements.OfType<IAuthorizationHandler>())
            await handler.HandleAsync(context);
    }
}
```
### 1.3 授权服务
#### 1.3.1 IAuthorizationService
应用程序最终针对授权的检验是通过 `IAuthorizationService` 服务来完成的。`IAuthorizationService`接口定义了如下所示的`AuthorizeAsync`方法，该方法会根据提供的`IAuthorizationRequirement`对象列表实施授权检验，该方法用一个`ClaimsPrincipal` 类型的参数（`user`）表示待检验的用户，而参数`resource`则表示授权的目标资源。
```csharp
public interface IAuthorizationService
{
    Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, IEnumerable<IAuthorizationRequirement> requirements);
    //...
}
```
授权检验的结果可以用如下所示的 AuthorizationResult 类型来表示。如果授权成功，它的Succeeded 属性会返回 True；否则，授权失败的信息会保存在 Failure属性返回的AuthorizationFailure 对象中。
```csharp
public class AuthorizationResult
{
    private AuthorizationResult() { }
    public bool Succeeded { get; private set; }
    public AuthorizationFailure? Failure { get; private set; }
    
    public static AuthorizationResult Success();
    public static AuthorizationResult Failed(AuthorizationFailure failure);
    public static AuthorizationResult Failed();
}
```

#### 1.3.2 DefaultAuthorizationService
`DefaultAuthorizationService` 类型是对 `IAuthorizationService` 接口的默认实现

```csharp
public class DefaultAuthorizationService : IAuthorizationService
{
    public virtual async Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, IEnumerable<IAuthorizationRequirement> requirements)
    {
        if (requirements == null)
            throw new ArgumentNullException(nameof(requirements));

        var authContext = _contextFactory.CreateContext(requirements, user, resource);
        var handlers = await _handlers.GetHandlersAsync(authContext);
        foreach (var handler in handlers)
        {
            await handler.HandleAsync(authContext);
            if (!_options.InvokeHandlersAfterFailure && authContext.HasFailed)
                break;
        }

        var result = _evaluator.Evaluate(authContext);
        if (result.Succeeded)
            _logger.UserAuthorizationSucceeded();
        else
            _logger.UserAuthorizationFailed(result.Failure!);
        return result;
    }
        //... 
}
```
在实现的`AuthorizeAsync`方法中，`IAuthorizationHandlerContextFactory`工厂率先被用来创建代表授权上下文的`AuthorizationHandlerContext`对象。然后`IAuthorizationHandlerProvider`服务会从该上下文中提取出所有代表授权处理器的`IAuthorizationHandler` 对象。在将`AuthorizationHandlerContext` 上下文作为参数依次调用这组 `IAuthorizationHandler` 对象的`HandleAsync` 方法的过程中，如果当前授权结果为失败状态，并且 `AuthorizationOptions` 对象的`InvokeHandlersAfterFailure`属性返回`False`，那么整个授权检验过程将立即中止。`AuthorizeAsync`方法最终返回的是`IAuthorizationEvaluator`对象针对授权上下文评估的结果。

#### 1.3.3 服务注册

`DefaultAuthorizationService`及其依赖的服务是通过 `IServiceCollection`接口的`AddAuthorization`扩展方法注册的。注册这些服务采用的生命周期模式都是`Transient`。对于注册的这些服务来说，除了包含注入`DefaultAuthorizationService`构造函数的服务，还有一个针对`IAuthorizationHandler` 的服务注册，具体的实现类型为`PassThroughAuthorization` `Handler`。所以，在`DefaultAuthorizationHandlerProvider`的构造函数中注入的授权处理器集合其实只包含`PassThroughAuthorizationHandler`对象，该对象会从授权上下文中获取真正的`IAuthorizationHandler`对象来做最终的授权检验。

## 2. 基于“策略”的授权
如果在实施授权检验时总是针对授权的目标资源创建相应的`IAuthorizationRequirement`对象，这将是一项非常烦琐的工作，我们更加希望采用的编程模式如下：预先创建一组可复用的授权规则，在授权检验时提取对应的授权规则来确定用户是否具有访问目标资源的权限。

### 2.1 构建授权策略
授权策略在授权模型中体现为一个 `AuthorizationPolicy`对象，该对象采用 `Builder`模式利用对应的`AuthorizationPolicyBuilder`进行构建。

```csharp
public class AuthorizationPolicy
{
    public AuthorizationPolicy(IEnumerable<IAuthorizationRequirement> requirements, IEnumerable<string> authenticationSchemes);

    public IReadOnlyList<IAuthorizationRequirement> Requirements { get; }
    public IReadOnlyList<string> AuthenticationSchemes { get; }
}
```

授权策略与采用的认证方式有关，所以`AuthorizationPolicy`类型利用其`AuthenticationSchemes`属性存储采用的认证方案名称。授权模型总是利用`IAuthorizationRequirement` 对象来表达“授权要求”，授权策略利用它们做出最终的决策。`AuthorizationPolicy`类型的 `Requirements`属性存储了一组`IAuthorizationRequirement`对象。

除了调用构造函数来创建 `AuthorizationPolicy` 对象，我们还可以利用一个`AuthorizationPolicyBuilder` 对象以 `Builder` 模式来创建 `AuthorizationPolicy` 对象。

```csharp
public class AuthorizationPolicyBuilder
{
    public AuthorizationPolicyBuilder(params string[] authenticationSchemes);
    public AuthorizationPolicyBuilder(AuthorizationPolicy policy);

    public IList<IAuthorizationRequirement> Requirements { get; set; }
    public IList<string> AuthenticationSchemes { get; set; }

    public AuthorizationPolicyBuilder AddAuthenticationSchemes(params string[] schemes);
    public AuthorizationPolicyBuilder AddRequirements(params IAuthorizationRequirement[] requirements);

    public AuthorizationPolicyBuilder RequireClaim(string claimType);
    public AuthorizationPolicyBuilder RequireClaim(string claimType, params string[] allowedValues);
    public AuthorizationPolicyBuilder RequireClaim(string claimType, IEnumerable<string> allowedValues);
    public AuthorizationPolicyBuilder RequireRole(params string[] roles);
    public AuthorizationPolicyBuilder RequireRole(IEnumerable<string> roles);
    public AuthorizationPolicyBuilder RequireUserName(string userName);
    public AuthorizationPolicyBuilder RequireAuthenticatedUser();
    public AuthorizationPolicyBuilder RequireAssertion(Func<AuthorizationHandlerContext, bool> handler);
    public AuthorizationPolicyBuilder RequireAssertion(Func<AuthorizationHandlerContext, Task<bool>> handler);

    public AuthorizationPolicyBuilder Combine(AuthorizationPolicy policy);
}
```
一个 `AuthorizationPolicy` 对象的有效内容荷载就是一组认证方案列表和一组`IAuthorization` `Requirement`对象列表。可以使用以上方法将预定义的 `IAuthorizationRequirement` 实现类型添加到 `Requirements` 集合中。

有时我们需要将两个 `AuthorizationPolicy`对象提供的这两组数据进行合并，所以 `AuthorizationPolicyBuilder` 类型提供了如下所示的 `Combine` 方法。除了这个实例方法，`AuthorizationPolicy`类型还提供了两个静态的`Combine`方法，用来实现针对多个`AuthorizationPolicy`对象的合并。

### 2.2 注册授权策略
针对授权策略的注册需要使用配置选项 `AuthorizationOptions`。`AuthorizationOptions` 对象通过一个字典对象维护一组`AuthorizationPolicy`对象和对应名称的映射关系，我们可以调用两个 `AddPolicy`方法来向这个字典中添加新的映射关系，也可以调用 `GetPolicy`方法根据指定策略名称得到对应的`AuthorizationPolicy`对象。

```csharp
public class AuthorizationOptions
{
    private Dictionary<string, AuthorizationPolicy> PolicyMap { get; }
    public AuthorizationPolicy DefaultPolicy { get; set; }
    
    public void AddPolicy(string name, AuthorizationPolicy policy);
    public void AddPolicy(string name, Action<AuthorizationPolicyBuilder> configurePolicy);
    public AuthorizationPolicy? GetPolicy(string name);
    //...
}
```

如果调用`GetPolicy`方法时指定的策略名称不存在，该方法就会返回`Null`。在这种情况下，可以选择使用默认的授权策略，针对默认授权策略的设置可以通过`AuthorizationOptions` 对象的`DefaultPolicy`属性来实现。

### 2.3 授权检验
基于策略的授权在 `DefaultAuthorizationService` 类型中是通过如下所示的方式实现的。在实现的 `AuthorizeAsync` 方法中，`DefaultAuthorizationService` 对象会利用构造函数中注入的`IAuthorizationPolicyProvider` 对象根据指定的策略名称得到对应的授权策略，并从表示授权策略的 `AuthorizationPolicy` 对象中得到所有的`IAuthorizationRequirement` 对象。`DefaultAuthorizationService` 对象将这些`IAuthorizationRequirement` 对象作为参数调用 `AuthorizeAsync` 方法重载来完成授权检验。

```csharp
public class DefaultAuthorizationService : IAuthorizationService
{
    public virtual async Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, string policyName)
    {
        if (policyName == null)
            throw new ArgumentNullException(nameof(policyName));

        var policy = await _policyProvider.GetPolicyAsync(policyName);
        if (policy == null)
            throw new InvalidOperationException($"No policy found: {policyName}.");
        return await this.AuthorizeAsync(user, resource, policy);
    }
}
```

应用程序最终利用 `IAuthorizationService`服务针对目标操作或者资源实施授权检验，`DefaultAuthorizationService` 类型是对该服务接口的默认实现。`IAuthorizationService` 服务具体提供了两种授权检验模式，一种是针对提供的`IAuthorizationRequirement`对象列表实施授权，另一种则是针对注册的某个通过`AuthorizationPolicy` 对象表示的授权策略，后者由注册的`IAuthorizationPolicyProvider`服务提供。

## 3. 授权案例
通过前面章节的讲解我们了解到，ASP.NET Core 应用并没有对如何定义授权策略做硬性规定，所以我们完全根据用户具有的任意特性（如性别、年龄、学历、所在地区、宗教信仰、政治面貌等）来判断其是否具有获取目标资源或者执行目标操作的权限，但是针对角色的授权策略依然是最常用的。角色（或者用户组）实际上就是对一组权限集的描述，将一个用户添加到某个角色之中就是为了将对应的权限赋予该用户。

接下来我们就简单演示基于角色的授权案例，案例内容基于上一节[认证](authentication.md#_3-认证案例)做简单修改，我们约定主页必须具有`Administrator`角色才能访问。

### 3.1 基于“要求”的角色授权

```csharp{7,18,26-40,75-79}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services
                .AddRouting()
                .AddAuthorization()
                .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
                .AddCookie())
            .Configure(app => app
                .UseAuthentication()
                .UseRouting()
                .UseEndpoints(endpoints =>
                {
                    endpoints.Map("/", RenderHomePageAsync);
                    endpoints.Map("Account/Login", SignInAsync);
                    endpoints.Map("Account/Logout", SignOutAsync);
                    endpoints.Map("Account/AccessDenied", DenyAccessAsync);
                }))
        )
        .Build().Run();
}

private static async Task RenderHomePageAsync(HttpContext context)
{
    var authorizationService = context.RequestServices.GetRequiredService<IAuthorizationService>();
    var result = await authorizationService.AuthorizeAsync(context.User, null, new IAuthorizationRequirement[]
    {
        new DenyAnonymousAuthorizationRequirement(),
        new RolesAuthorizationRequirement(new[] {"Administrator"})
    });

    if (!result.Succeeded)
    {
        if (result.Failure?.FailedRequirements.Any(r => r is DenyAnonymousAuthorizationRequirement) == true)
            await context.ChallengeAsync();
        else
            await context.ForbidAsync();
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
                <h3>Welcome {context.User.Identity.Name}, you're authorized</h3>
                <a href='/Account/Logout'>Sign Out</a>    
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
    var user = Users.SingleOrDefault(u =>
        string.Equals(u.Username, username, StringComparison.OrdinalIgnoreCase));
    if (!string.Equals(user?.Password, password, StringComparison.OrdinalIgnoreCase))
    {
        await RenderSignInPageAsync(context, username, password, "invalid username or password");
        return;
    }

    var identity = new GenericIdentity(username, CookieAuthenticationDefaults.AuthenticationScheme);
    foreach (var role in user.Roles)
        identity.AddClaim(new Claim(ClaimTypes.Role, role.Name));
    var principal = new GenericPrincipal(identity, null);
    await context.SignInAsync(principal);
}

private static async Task SignOutAsync(HttpContext context)
{
    await context.SignOutAsync();
    await context.ChallengeAsync(new AuthenticationProperties {RedirectUri = "/"});
}

private static async Task DenyAccessAsync(HttpContext context)
{
    context.Response.ContentType = "text/html";
    await context.Response.WriteAsync(
        @$"
            <!DOCTYPE html>
            <html lang='en'>
            <head><title>Index</title>
            </head>
            <body>
                <h3>Sorry {context.User.Identity.Name}, you're not authorized</h3>
                <a href='/Account/Logout'>Sign Out</a>    
            </body>
            </html>");
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

private static readonly IEnumerable<User> Users = new[]
{
    new User("Colin", "123456", new[] {new Role("Administrator")}),
    new User("Robin", "123456", new[] {new Role("Users")})
};

public class User
{
    public string Username { get; set; }
    public string Password { get; set; }
    public IEnumerable<Role> Roles { get; set; }

    public User(string username, string password, IEnumerable<Role> roles)
    {
        Username = username;
        Password = password;
        Roles = roles;
    }
}

public class Role
{
    public string Name { get; set; }
    public Role(string name) => Name = name;
}
```

### 3.2 基于“策略”的角色授权
我们使用基于“策略”的授权重构以上代码，只需要在注册授权服务时定义授权策略，授权检查时使用策略即可。下面只列出关键代码。

```csharp{7-15,34-43}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services
                .AddRouting()
                .AddAuthorization(options => options
                    .AddPolicy("Admin", policy =>
                    {
                        //policy.AddRequirements(new DenyAnonymousAuthorizationRequirement());
                        //policy.AddRequirements(new RolesAuthorizationRequirement(new[] {"Administrator"}));

                        policy.RequireAuthenticatedUser();
                        policy.RequireRole("Administrator");
                    }))
                .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
                .AddCookie())
            .Configure(app => app
                .UseAuthentication()
                .UseRouting()
                .UseEndpoints(endpoints =>
                {
                    endpoints.Map("/", RenderHomePageAsync);
                    endpoints.Map("Account/Login", SignInAsync);
                    endpoints.Map("Account/Logout", SignOutAsync);
                    endpoints.Map("Account/AccessDenied", DenyAccessAsync);
                }))
        )
        .Build().Run();
}

private static async Task RenderHomePageAsync(HttpContext context)
{
    var authorizationService = context.RequestServices.GetRequiredService<IAuthorizationService>();
    var result = await authorizationService.AuthorizeAsync(context.User, "Admin");
    if (!result.Succeeded)
    {
        if (result.Failure?.FailedRequirements.Any(r => r is DenyAnonymousAuthorizationRequirement) == true)
            await context.ChallengeAsync();
        else
            await context.ForbidAsync();
        return;
    }

    await context.Response.WriteAsync(
        @$"
            <!DOCTYPE html>
            <html lang='en'>
            <head><title>Index</title>
            </head>
            <body>
                <h3>Welcome {context.User.Identity.Name}, you're authorized</h3>
                <a href='/Account/Logout'>Sign Out</a>    
            </body>
            </html>");
}
```

### 3.3 授权中间件与MVC过滤器
授权中间件`AuthorizationMiddleware`通常与MVC框架中`AuthorizeFilter`一起使用，通过查看`AuthorizationMiddleware`源码可以发现其中间件会执行过滤器中的授权检查规则。

下面我们使用授权中间件(`AuthorizationMiddleware`)与 MVC授权过滤器(`AuthorizeFilter`)来重构以上案例。

在`Startup`中注册认证和授权服务和授权策略与中间件，需要注意中间件注入的顺序。
```csharp{6-11,28-29}
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddControllersWithViews();
        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie();
        services.AddAuthorization(options => options.AddPolicy("admin", policy =>
        {
            policy.RequireAuthenticatedUser();
            policy.RequireRole("Administrator");
        }));
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        if (env.IsDevelopment())
            app.UseDeveloperExceptionPage();
        else
        {
            app.UseExceptionHandler("/Home/Error");
            app.UseHsts();
        }

        app.UseHttpsRedirection();
        app.UseStaticFiles();
        app.UseRouting();

        app.UseAuthentication();
        app.UseAuthorization();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllerRoute(
                name: "default",
                pattern: "{controller=Home}/{action=Index}/{id?}");
        });
    }
}
```
在`HomeController`中使用 MVC授权过滤器对多个`Action`方法进行不同的授权检查。

```csharp{3,6,9}
public class HomeController : Controller
{
    [Authorize("admin")]
    public IActionResult Index() => View();

    [Authorize(Roles = "User")]
    public IActionResult Privacy() => View();

    [Authorize]
    public IActionResult Test() => View();

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error() => View(new ErrorViewModel
        {RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier});
}
```

`Authorize`过滤器不提供任何参数时只会进行匿名用户鉴权，也可以传入角色或策略名称进行角色或策略进行鉴权。以逗号分隔角色名来允行多个角色访问操作，其中只要满足其一就可以进行访问。如以下方法`Administrator`或`User`角色均可访问。

```csharp{1}
[Authorize(Roles = "Administrator,User")]
public IActionResult Privacy() => View();
```
下面的方法只有同时具有`Administrator`和`User`角色的用户才可访问

```csharp{1-2}
[Authorize(Roles = "Administrator")]
[Authorize(Roles = "User")]
public IActionResult Privacy() => View();
```
因为使用了基于`Cookie`的认证策略，所以授权检查不通过时会自动重定向到`/Account/Login`，下面是`AccountController`中的认证实现。

```csharp{25-29,33}
public class AccountController : Controller
{
    private static readonly IEnumerable<User> Users = new[]
    {
        new User("Colin", "123123", new[] {new Role("Administrator"), new Role("User")}),
        new User("Robin", "123123", new[] {new Role("User")})
    };

    public IActionResult Login() => View();

    [HttpPost]
    public IActionResult Login(User user)
    {
        if (user == null)
            return Challenge();

        var usr = Users.SingleOrDefault(u =>
            string.Equals(u.Username, user.Username, StringComparison.OrdinalIgnoreCase));
        if (!string.Equals(usr?.Password, user.Password, StringComparison.OrdinalIgnoreCase))
        {
            ViewBag.Message = "invalid username or password";
            return View(user);
        }

        var identity = new GenericIdentity(user.Username, CookieAuthenticationDefaults.AuthenticationScheme);
        foreach (var role in usr.Roles)
            identity.AddClaim(new Claim(ClaimTypes.Role, role.Name));
        var principal = new GenericPrincipal(identity, null);
        return SignIn(principal);
    }

    public IActionResult Logout() =>
        SignOut(new AuthenticationProperties {RedirectUri = "/"});

    public IActionResult AccessDenied() => View();
}
```
为方便使用，认证相关的`SignIn`/`SignOut`等几个核心操作都扩展在了`Controller`类中，使用方式如上。

以上案例的模型类和相关视图不涉及认证授权逻辑，此处不再展示。完整案例代码参见[Github](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.MvcSample)。