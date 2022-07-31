# Identity Server 授权

## 1. RBAC
基于角色的授权方式(`Role-based Access Control(RBAC)`)是一种常见的授权方式。Asp.Net中基于角色授权的使用在[基于-策略-的角色授权](../auth/authorize.md#_3-2-基于-策略-的角色授权)章节中有所讲解。下面我们来简单演示如何在`Identity Server中`使用`RBAC`。

目前市场前后端分离的项目结构较为流行，故而下面我们以[Implicit flow](implicit.md)授权方式为例，使用纯`JavaScript`客户端访问被保护的API资源。本节示例代码采用[Implicit flow](implicit.md)章节案例只稍作扩展修改。

### 1.1 Identity Server
本节我们继续使用[Authorization Code](code.md)章节中的[IdentityServer](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServerWithUI)服务。本节代码已分享到[Github](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServerWithUI)。


因为要使用角色进行鉴权，我们需要在`TestUsers.Users`中为`alice/bob`两个模拟用户分别设置不同的角色。

```csharp{30-31,49}
public static List<TestUser> Users
{
    get
    {
        var address = new
        {
            street_address = "One Hacker Way",
            locality = "Heidelberg",
            postal_code = 69118,
            country = "Germany"
        };

        return new List<TestUser>
        {
            new TestUser
            {
                SubjectId = "818727",
                Username = "alice",
                Password = "alice",
                Claims =
                {
                    new Claim(JwtClaimTypes.Name, "Alice Smith"),
                    new Claim(JwtClaimTypes.GivenName, "Alice"),
                    new Claim(JwtClaimTypes.FamilyName, "Smith"),
                    new Claim(JwtClaimTypes.Email, "AliceSmith@email.com"),
                    new Claim(JwtClaimTypes.EmailVerified, "true", ClaimValueTypes.Boolean),
                    new Claim(JwtClaimTypes.WebSite, "http://alice.com"),
                    new Claim(JwtClaimTypes.Address, JsonSerializer.Serialize(address),
                        IdentityServerConstants.ClaimValueTypes.Json),
                    new Claim(JwtClaimTypes.Role, "Administrator"),
                    new Claim(JwtClaimTypes.Role, "User")
                }
            },
            new TestUser
            {
                SubjectId = "88421113",
                Username = "bob",
                Password = "bob",
                Claims =
                {
                    new Claim(JwtClaimTypes.Name, "Bob Smith"),
                    new Claim(JwtClaimTypes.GivenName, "Bob"),
                    new Claim(JwtClaimTypes.FamilyName, "Smith"),
                    new Claim(JwtClaimTypes.Email, "BobSmith@email.com"),
                    new Claim(JwtClaimTypes.EmailVerified, "true", ClaimValueTypes.Boolean),
                    new Claim(JwtClaimTypes.WebSite, "http://bob.com"),
                    new Claim(JwtClaimTypes.Address, JsonSerializer.Serialize(address),
                        IdentityServerConstants.ClaimValueTypes.Json),
                    new Claim(JwtClaimTypes.Role, "User")
                }
            }
        };
    }
}
```
接下来需要在`IdentityResources`中添加角色数据。角色并非标准化的资源，需要我们手动创建。
```csharp{6}
public static IEnumerable<IdentityResource> IdentityResources =>
    new[]
    {
        new IdentityResources.OpenId(),
        new IdentityResources.Profile(),
        new IdentityResource("roles", "角色", new[] {JwtClaimTypes.Role})
    };
```

要在API中使用自定义`Claims`，需要在`ApiScopes`中进行如下配置。
```csharp{4}
public static IEnumerable<ApiScope> ApiScopes =>
    new[]
    {
        new ApiScope("WeatherApi", "天气预报", new[] {JwtClaimTypes.Role})
    };
```

最后我们需要在注册客户端时开放角色的`Scope`。
```csharp{14}
public static IEnumerable<Client> Clients =>
    new[]
    {
        new Client
        {
            ClientId = "ImplicitJavaScriptClient",
            RequireClientSecret = false,
            AllowedGrantTypes = GrantTypes.Implicit,
            AllowedScopes =
            {
                "WeatherApi",
                IdentityServerConstants.StandardScopes.OpenId,
                IdentityServerConstants.StandardScopes.Profile,
                "roles"
            },
            AllowAccessTokensViaBrowser = true,
            ClientUri = "https://localhost:8000",
            RedirectUris =
            {
                "https://localhost:8000/signin-oidc.html",
                "https://localhost:8000/silent.html"
            },
            PostLogoutRedirectUris = {"https://localhost:8000/signout-oidc.html"},
            AllowedCorsOrigins = {"https://localhost:8000"},
            RequireConsent = true,
            AccessTokenLifetime = 5 * 60,
            AlwaysIncludeUserClaimsInIdToken = true
        }
    };
```

### 1.2 API
这里[API项目](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServer.Api)基于[Implicit](./implicit.md#_2-api)中的代码略作扩展。

我们添加以下两个API来演示角色授权。
```csharp
[ApiController]
[Route("[controller]")]
public class AuthorizationController : ControllerBase
{
    [Authorize(Roles = "User")]
    [HttpGet]
    public string Get() => "you successfully called API with role User";

    [Authorize(Roles = "Administrator")]
    [HttpPost]
    public string Post() => "you successfully called API with role Administrator";
}
```

`AuthorizeAttribute`可以过滤Asp.Net的角色，通过以下代码将自定义角色`Claims`映射为Asp.Net的角色。

```csharp{15-16}
public void ConfigureServices(IServiceCollection services)
{
    // ...
    services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
        {
            options.Authority = identityServerOptions.Address;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateAudience = false,
                RequireExpirationTime = true,
                ClockSkew = TimeSpan.FromSeconds(25),

                NameClaimType = JwtClaimTypes.Name,
                RoleClaimType = JwtClaimTypes.Role
            };
        });
}
```

本节代码已分享到[Github](https://github.com/colin-chang/AuthSamples/blob/main/ColinChang.IdentityServer.Api/)。


### 1.3 Client
这里[Client项目](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServer.ImplicitJavaScriptClient)基于[Implicit](./implicit.md#_2-api)中的代码略作修改。

#### 1.3.1 UserManager
在`UserManager`中添加角色`Scope`。
```js{9}
let mgr = new Oidc.UserManager({
    authority: "https://localhost:5000",
    client_id: "ImplicitJavaScriptClient",
    redirect_uri: window.location.origin + "/signin-oidc.html",
    post_logout_redirect_uri: window.location.origin + "/signout-oidc.html",
    silent_redirect_uri: window.location.origin + "/silent-oidc.html",
    automaticSilentRenew: true,
    response_type: "id_token token",
    scope: "WeatherApi openid profile roles",
    revokeAccessTokenOnSignout: true,
});
```

#### 1.3.2 CallAPI
使用以下代码调用测试条用API。
```js
//RBAC
(function () {
    function callUserRoleApi() {
        request("https://localhost:10000/Authorization", "GET", function (response) {
            alert(response)
        });
    }

    function callAdministratorRoleApi() {
        request("https://localhost:10000/Authorization", "POST", function (response) {
            alert(response)
        });
    }

    document.querySelector("#callUserRoleApi").addEventListener("click", callUserRoleApi);
    document.querySelector("#callAdministratorRoleApi").addEventListener("click", callAdministratorRoleApi);
})();
```
无权访问时得到`403 Forbidden`响应，效果如下图所示。
![RBAC](https://i.loli.net/2021/05/17/hWLu7EHYsRxgZyw.png)

## 2. PBAC
相较于`RBAC`简单且单一的角色权限控制，基于策略的授权方式(`Policy-based Access Control(PBAC)`)更为灵活多变。它可以将任意`Claims`组合使用，允许进行复杂的自定义鉴权规则。

`RBAC`只使用了`Role Claim`，而`PCAC`则可以随意组合任意`Claims`，两者用法也几近相同，下面我们做简单演示。

### 2.1 Identity Server
我们在`TestUsers.Users`中为`alice`用户设置一个`Nationality Claim`,用于组合策略。

```csharp{32}
public static List<TestUser> Users
{
    get
    {
        var address = new
        {
            street_address = "One Hacker Way",
            locality = "Heidelberg",
            postal_code = 69118,
            country = "Germany"
        };

        return new List<TestUser>
        {
            new TestUser
            {
                SubjectId = "818727",
                Username = "alice",
                Password = "alice",
                Claims =
                {
                    new Claim(JwtClaimTypes.Name, "Alice Smith"),
                    new Claim(JwtClaimTypes.GivenName, "Alice"),
                    new Claim(JwtClaimTypes.FamilyName, "Smith"),
                    new Claim(JwtClaimTypes.Email, "AliceSmith@email.com"),
                    new Claim(JwtClaimTypes.EmailVerified, "true", ClaimValueTypes.Boolean),
                    new Claim(JwtClaimTypes.WebSite, "http://alice.com"),
                    new Claim(JwtClaimTypes.Address, JsonSerializer.Serialize(address),
                        IdentityServerConstants.ClaimValueTypes.Json),
                    new Claim(JwtClaimTypes.Role, "Administrator"),
                    new Claim(JwtClaimTypes.Role, "User"),
                    new Claim("nationality","China")
                }
            }
        };
    }
}
```

接下来我们需要将国籍信息分别配置到`IdentityResources/ApiScopes/Clients`中。

```csharp{7,13,30}
public static IEnumerable<IdentityResource> IdentityResources =>
    new[]
    {
        new IdentityResources.OpenId(),
        new IdentityResources.Profile(),
        new IdentityResource("roles", "角色", new[] {JwtClaimTypes.Role}),
        new IdentityResource("nationalities", "国籍", new[] {"nationality"}),
    };

public static IEnumerable<ApiScope> ApiScopes =>
    new[]
    {
        new ApiScope("WeatherApi", "天气预报", new[] {JwtClaimTypes.Role,"nationality"})
    };

public static IEnumerable<Client> Clients =>
    new[]
    {
        new Client
        {
            ClientId = "ImplicitJavaScriptClient",
            RequireClientSecret = false,
            AllowedGrantTypes = GrantTypes.Implicit,
            AllowedScopes =
            {
                "WeatherApi",
                IdentityServerConstants.StandardScopes.OpenId,
                IdentityServerConstants.StandardScopes.Profile,
                "roles",
                "nationalities"
            },
            AllowAccessTokensViaBrowser = true,
            ClientUri = "https://localhost:8000",
            RedirectUris =
            {
                "https://localhost:8000/signin-oidc.html",
                "https://localhost:8000/silent.html"
            },
            PostLogoutRedirectUris = {"https://localhost:8000/signout-oidc.html"},
            AllowedCorsOrigins = {"https://localhost:8000"},
            RequireConsent = true,
            AccessTokenLifetime = 5 * 60,
            AlwaysIncludeUserClaimsInIdToken = true
        }
    };
```

### 2.2 API
声明`Policy`如下，策略要求认证用户是中国籍且是管理员角色。

```csharp{6-11}
public void ConfigureServices(IServiceCollection services)
{
    //...
    services.AddAuthorization(options =>
    {
        options.AddPolicy("ChineseAdministrator", policy =>
        {
            policy.RequireAuthenticatedUser();
            policy.RequireClaim("nationality", "China");
            policy.RequireRole("Administrator");
        });
    });
}
```
添加如下API用于测试`ChineseAdministrator`策略。
```csharp{1}
[Authorize("ChinaAdministrator")]
[HttpPut]
public string Put() => "you successfully called API with ChinaAdministrator Policy";
```

### 2.3 Client

在`UserManager`中添加角色`Scope`。
```js{9}
let mgr = new Oidc.UserManager({
    authority: "https://localhost:5000",
    client_id: "ImplicitJavaScriptClient",
    redirect_uri: window.location.origin + "/signin-oidc.html",
    post_logout_redirect_uri: window.location.origin + "/signout-oidc.html",
    silent_redirect_uri: window.location.origin + "/silent-oidc.html",
    automaticSilentRenew: true,
    response_type: "id_token token",
    scope: "WeatherApi openid profile roles nationalities",
    revokeAccessTokenOnSignout: true,
});
```

使用以下代码调用测试条用API。

```js
(function () {
    function callPolicyApi() {
        request("https://localhost:10000/Authorization", "PUT", function (response) {
            alert(response)
        });
    }

    document.querySelector("#callPolicyApi").addEventListener("click", callPolicyApi);
})();
```
使用`alice`用户登录后可以正常访问`Policy API`，否则会得到`403 Forbidden`响应。

## 3. PBAC 扩展
以上`PBAC`案例中我们直接在`ConfigureServices`中是引用了预定义`IAuthorizationRequirement`组合了自定义`Policy`，当自定义`Policy`逻辑较为复杂或独立时，我们也可以将其封装为一个 [IAuthorizationRequirement](../auth/authorize.md#_1-1-iauthorizationrequirement) 对象并实现`IAuthorizationHandler`作为授权处理器。

```csharp
public class ChineseAdministratorRequirement
    : IAuthorizationRequirement,
        IAuthorizationHandler
{
    public Task HandleAsync(AuthorizationHandlerContext context)
    {
        if (context.User.Identity is {IsAuthenticated: true} &&
            context.User.Claims.FirstOrDefault(c => c.Type == "nationality")?.Value == "China" &&
            context.User.IsInRole("Administrator"))
        {
            context.Succeed(this);
            return Task.CompletedTask;
        }

        context.Fail();
        return Task.CompletedTask;
    }
}
```

一般生产环境下`Policy`是使用动态数据源(DB等)加载，加载一般在`IHostApplicationLifetime.ApplicationStarted`声明周期事件中进行。