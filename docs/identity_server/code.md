# Authorization Code

`Authorization Code` 授权方式适用于保密客户端，如服务器端Web应用，此授权过程会分别对用户和客户端进行双重身份认证，安全性较高。尽管可以在SPA等公开客户端中使用`Authorization Code`授权方式，但除了一次性使用的`Authorization code`外，即便需要保密的`Access Token`也只能保存在公开客户端中，安全性较低，所以在公开客户端更推荐使用`Implicit`授权方式简化授权过程。

`Authorization Code/Implicit`两种授权方式都需要借助`IBrowser`对象(通常为浏览器)引导用户到`IdentityServer`进行身份认证，所以多用于交互式客户端，如Web应用(Asp.Net,SPA等)，桌面应用(如，`Fiddler/Skype`等)，移动App等，以上客户端多是借助浏览器引导用户进行身份认证和授权。

## 1. Identity Server
本案例中客户端应用会引导用户到`IdentityServer UI`中进行登录，我们使用`IdentityServer4withIn-MemoryStoresandTestUsers`模板创建一个新的`IdentityServer`项目，该模板项目除了`IdentityServer4Empty`中提供的基础结构外，还提供了一套UI方便我们进行登录和可视化查看数据。本节代码已分享到[Github](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServerWithUI)。

本节我们只针对`Authorization Code`授权方式的内容做简单讲解，`IdentityServer`其它基础内容在之前章节中已做过介绍，不再赘述。

```csharp{8,16-20}
public static IEnumerable<Client> Clients =>
    new[]
    {
        new Client
        {
            ClientId = "AuthorizationCodeMvcClient",
            ClientSecrets = {new Secret("AuthorizationCodeMvcClient".Sha256())},
            AllowedGrantTypes = GrantTypes.Code,
            AllowedScopes =
            {
                "WeatherApi",
                IdentityServerConstants.StandardScopes.OpenId,
                IdentityServerConstants.StandardScopes.Profile
            },

            RedirectUris = {"https://localhost:7000/signin-oidc"},
            FrontChannelLogoutUri = "https://localhost:7000/signout-oidc",
            PostLogoutRedirectUris = {"https://localhost:7000/signout-callback-oidc"},
            AllowOfflineAccess = true // 允许 Refresh Token 
            // AlwaysIncludeUserClaimsInIdToken = true // 在IdToken中包含所有用户身份声明
        }
    };
```
通过以上代码注册客户端，`RedirectUris/FrontChannelLogoutUri/PostLogoutRedirectUris`三个属性分别用户设置登录/前端登出/服务端登出后要重定向的地址，三个地址都是协议标准默认地址，一般只需要将域名部分修改客户端域名即可。`AllowOfflineAccess`属性设置是否允许`Refresh Token`。

## 2. Client
这里[API项目](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServer.Api)依然使用[Client Credentials](./cc.md#_2-api)中的代码，不再赘述。

`Authorization Code`授权方式一般应用于机密客户端，这里我们建立一个Asp.Net MVC程序作为客户端，客户端代码已共享至[Github](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServer.AuthorizationCodeMvcClient)，其客户端配置读取方式[Resource Owner Password Credentials 案例](./ropc.md#_2-client)相同，亦不再赘述。

MVC客户端需要使用`IdentityServer`需要安装`IdentityModel`和`Microsoft.AspNetCore.Authentication.OpenIdConnect`两个`Nuget`包。

```csharp{6-7,16,19-35}
public void ConfigureServices(IServiceCollection services)
{
    services.AddControllersWithViews();

   //关闭JWT Claim类型映射，以便返回WellKnown Claims
    JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();
    // JwtSecurityTokenHandler.DefaultMapInboundClaims = false;

    var is4Configuration = Configuration.GetSection(nameof(IdentityServerOptions));
    services.Configure<IdentityServerOptions>(is4Configuration);
    var is4Options = is4Configuration.Get<IdentityServerOptions>();
    services
        .AddAuthentication(options =>
        {
            options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
        })
        .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme)
        .AddOpenIdConnect(OpenIdConnectDefaults.AuthenticationScheme, options =>
        {
            options.Authority = is4Options.Address;
            options.ClientId = is4Options.ClientId;
            options.ClientSecret = is4Options.ClientSecret;
            options.ResponseType = OidcConstants.ResponseTypes.Code;

            options.SaveTokens = true; //保存token到cookie
            options.RequireHttpsMetadata = false; //关闭https验证

            options.Scope.Clear();
            // options.Scope.Add(OidcConstants.StandardScopes.OpenId);
            foreach (var scope in is4Options.Scopes)
                options.Scope.Add(scope.Name);

            options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        }); 
}
```
通过以上代码注册和配置`IdentityServer`服务。这里在客户端应用中使用基于`Cookie`的认证方案，并将认证过程委托给`IdentityServer`接管。

接下来我们在`Controller`中访问`Identity data`和`API`。`OpenIdConnect`库为`HttpContext`对象扩展了`GetTokenAsync()`方法用于从获取`IdentityServer`获取`AccessToken/IdToken/RefreshToken`等。

```csharp{11-13,23-25}
[Authorize]
public class HomeController : Controller
{
    private readonly IdentityServerOptions _options;

    public HomeController(IOptions<IdentityServerOptions> options) => _options = options.Value;

    public async Task<IActionResult> Index()
    {
        using var client = new HttpClient();
        var accessToken = await HttpContext.GetTokenAsync(OpenIdConnectParameterNames.AccessToken);
        client.SetBearerToken(accessToken);
        var response = await client.GetAsync(_options["WeatherApi"]);
        if (!response.IsSuccessStatusCode)
            return StatusCode((int) response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        return View((object) content);
    }

    public async Task<IActionResult> Privacy()
    {
        ViewBag.AccessToken = await HttpContext.GetTokenAsync(OpenIdConnectParameterNames.AccessToken);
        ViewBag.IdToken = await HttpContext.GetTokenAsync(OpenIdConnectParameterNames.IdToken);
        ViewBag.RefreshToken = await HttpContext.GetTokenAsync(OpenIdConnectParameterNames.RefreshToken);

        return View();
    }
}
```

## 3. 网络请求详解
我们使用[Fiddler](https://www.telerik.com/download/fiddler-everywhere)来监测和分析一个`Authorization Code Flow`的完整网络请求。*建议使用Windows环境，`Fiddler`在其它环境中默认无法捕捉`localhost`和`127.0.0.1`的[本地请求](https://docs.telerik.com/fiddler-everywhere/knowledge-base/capturing-localhost-traffic).*

启动MVC应用访问`https://localhost:7000`，默认路由到 `~/Home/Index`，我们在`HomeController`上启用了`Authorize`，MVC应用会执行鉴权，客户端浏览器没有合法票据，服务器会发起质询(`Challenge`) 并被重定向到`IdentityServer`。*MVC客户端认证过程的`DefaultChallengeScheme`设置成了`OpenIdConnectDefaults.AuthenticationScheme`并在`AddOpenIdConnect`方法配置了`IdentityServer`。*

![MVC主页请求](https://i.loli.net/2021/04/24/VZ54tGvnLqTNIWh.jpg)

如上图所示，MVC主页请求(`https://localhost:7000`)被重定向到`IdentityServer`的授权地址(`https://localhost:5000/connect/authorize`)。

![connect/authorize](https://i.loli.net/2021/04/24/rTQ21vgLXDtwIYn.jpg)

紧接着授权请求被重定向到登录页。

![IdentityServer Login](https://i.loli.net/2021/04/24/6sjKVr9zaMgltW3.jpg)

用户可以在此登录并授权给客户端。

![用户登录](https://i.loli.net/2021/04/24/wdkV7MbsXGPR6cO.jpg)

用户登录成功后会被重定向到(`/connect/authorize/callback`)。

![登录回调](https://i.loli.net/2021/04/24/PUJGE4klx5IqnhM.jpg)

通过上图可以看到登录回调页面加载完成后会自动提交表单到MVC应用(`https://localhost:7000/signin-oidc`)，这个地址在注册客户端时已经设置到`RedirectUris`属性中。

![signin-oidc](https://i.loli.net/2021/04/24/SUJKxyIHLFPwh31.jpg)

如上图所示`IdentityServer`在回调MVC应用的`signin-oidc`时会将`Authorization Code`发送给MVC客户端浏览器。MVC应用服务端处理`signin-oidc`请求，向`IdentityServer`的`Token(/connect/token)`节点发送请求，使用`client_id/client_secret/code`等进行身份认证，认证通过后`IdentityServer`会返回`Id Token/Access Token/Refresh Token`等给MVC服务端，MVC程序将令牌写到`Cookie`并返回`302`给浏览器将地址重定向到最初我们要访问的主页。

![connect/token](https://i.loli.net/2021/04/24/zJgIVYXnsiENqcK.jpg)

客户端浏览器重定向回主页后，携带`Cookie`令牌再次请求`Home/Index`，鉴权通过后`Index`方法会携带`Access Token`请求被保护的API资源。

![请求API](https://i.loli.net/2021/04/24/iEAPFISjC5e1B9G.jpg)

API项目鉴权`Access Token`合法并返回数据给MVC应用，MVC渲染界面如下。

![Weather](https://i.loli.net/2021/04/24/AlRNiYvkDHZqcwF.jpg)

最后在我们访问`/Home/Privacy`并展示`Id Token/Access Token/Refresh Token`，因为以上令牌已保存在MVC应用所以不会请求`IdentityServer`。另外，这些令牌可以使用`HttpContext.GetTokenAsync()`扩展方法方便地获取各令牌内容。

![identity-data](https://i.loli.net/2021/04/24/XVNLjshcDCz4Pig.jpg)

## 4. SignOut
下面我们来简单介绍一下如何在客户端应用和`IdentityServer`中注销登录登录。

在MVC `View`的`_Layout.cshtml`的导航栏中通过以下代码添加注销界面入口。
```html
@if (User.Identity.IsAuthenticated)
{ 
    <li class="nav-item"><a class="nav-link text-dark" asp-area="" asp-controller="Home" asp-action="SignOut">SignOut</a></li>
}
```
通过下面方法分别注销客户端和`IdentityServer`的登录状态。
```csharp{4,6}
public async Task SignOut()
{
    // 注销 客户端
    await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    // 注销 IdentityServer
    await HttpContext.SignOutAsync(OpenIdConnectDefaults.AuthenticationScheme);
}
```
调用以上`SignOut()`注销登录后会页面默认会停留在以下界面。

![Identity Server Signout](https://i.loli.net/2021/04/24/rICnwRs6O1vf9hD.png)

我们可以在`IdentitySever`项目`/Quickstart/Account/AccountOptions.cs`中设置`AccountOptions`的`AutomaticRedirectAfterSignOut`为`true`以实现注销后自动跳转到我们设定的地址。

![Signout oidc](https://i.loli.net/2021/04/24/6a2A9xczof5YnhF.png)

通过`Fiddler`监测请求可以看到，`IdentityServer`注销后请求了我们注册客户端时设定的`FrontChannelLogoutUri(https://localhost:7000/signout-oidc)`和`PostLogoutRedirectUris(https://localhost:7000/signout-callback-oidc)`，`signout-callback-oidc`将浏览器重定向回注销前的主页地址(`/`)，注销后鉴权失败浏览器立即又被引导了`IdentityServer`登录认证界面。

## 5. Refresh token
因为`Access Token`存在有效期，[Refresh Token](https://identityserver4.readthedocs.io/en/latest/topics/refresh_tokens.html)允许才用非用户交互式方式重新获取`Access Token`。

`Refresh Token`仅支持`Authorization code / Hybrid / Resource owner password credential`三种授权方式。

### 5.1 AccessToken 过期检查
`IdentitySever`中`Access Token`默认有效期是一小时。我们可以在注册客户端时修改`Access Token`有效时间。
```csharp{19-20}
public static IEnumerable<Client> Clients =>
    new[]
    {
        new Client
        {
            ClientId = "AuthorizationCodeMvcClient",
            ClientSecrets = {new Secret("AuthorizationCodeMvcClient".Sha256())},
            AllowedGrantTypes = GrantTypes.Code,
            AllowedScopes =
            {
                "WeatherApi",
                IdentityServerConstants.StandardScopes.OpenId,
                IdentityServerConstants.StandardScopes.Profile
            },

            RedirectUris = {"https://localhost:7000/signin-oidc"},
            FrontChannelLogoutUri = "https://localhost:7000/signout-oidc",
            PostLogoutRedirectUris = {"https://localhost:7000/signout-callback-oidc"},
            AllowOfflineAccess = true,//允许Refresh Token
            AccessTokenLifetime=30 // 设置Access Token 超时时间为30s
        }
    };
```
通过以上代码设置MVC客户端超时时间为30s，30s后MVC客户端依然可以使用`Access Token`正常访问API资源，这是因为API项目中未及时验证`Access Token`的过期情况。

```csharp{11-12}
public void ConfigureServices(IServiceCollection services)
{
    // ...
    services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
        {
            options.Authority = identityServerOptions.Address;
            options.TokenValidationParameters.ValidateAudience = false;

            options.TokenValidationParameters.RequireExpirationTime = true;
            options.TokenValidationParameters.ClockSkew = TimeSpan.FromSeconds(25);
        });
    // ...
}
```
在API项目中修改注册认证服务代码如上。`options.TokenValidationParameters.RequireExpirationTime = true`要求客户端`AccessToken`必须有过期时间。`options.TokenValidationParameters.ClockSkew`属性用于设置定期检查`AccessToken`的间隔时间。此处我们设置为25s。

要检查客户端`AccessToken`过期，通常会将API项目检查`AccessToken`的间隔时长设置小于客户端`AccessToken`有效时长，但检查频率过高会消耗更多资源，生产项目中根据实际情况酌情设置即可。

客户端和API是两个完全独立运行的项目，即使按上述规则设置了过期检查时间，仍然会存在令牌过期后仍可以正常使用的情况(时长小于API一个检查周期)。最坏的情况是API刚检查`AcessToken`正常有效后，`AcessToken`立即过期，此时使用`AcessToken`依然可以正常访问API资源，直到API下一次检查`AcessToken`。

API检测到客户端AccessToken过期后会返回`Unauthorized(401)`状态码。

### 5.2 Refresh Token

在`Access Token`过期后通过`Refresh Token`重新获取新的`Access Token`。

```csharp{10-18,23-45,47-55}
private async Task<string> RefreshTokenAsync()
{
    using var client = new HttpClient();
    var disco = await client.GetDiscoveryDocumentAsync(_options.Address);
    if (disco.IsError)
        throw new Exception(disco.Error);
    //获取当前RefreshToken
    var refreshToken = await HttpContext.GetTokenAsync(OpenIdConnectParameterNames.RefreshToken);
    //请求刷新令牌
    var response = await client.RequestRefreshTokenAsync(new RefreshTokenRequest
    {
        Address = disco.TokenEndpoint,
        ClientId = _options.ClientId,
        ClientSecret = _options.ClientSecret,
        Scope = string.Join(" ", _options.Scopes.Select(s => s.Name)), //刷新令牌时可重设Scope按需缩小授权范围
        GrantType = OpenIdConnectGrantTypes.RefreshToken,
        RefreshToken = refreshToken
    });
    if (response.IsError)
        throw new Exception(response.Error);

    //整理更新的令牌
    var tokens = new[]
    {
        new AuthenticationToken
        {
            Name = OpenIdConnectParameterNames.IdToken,
            Value = response.IdentityToken
        },
        new AuthenticationToken
        {
            Name = OpenIdConnectParameterNames.AccessToken,
            Value = response.AccessToken
        },
        new AuthenticationToken
        {
            Name = OpenIdConnectParameterNames.RefreshToken,
            Value = response.RefreshToken
        },
        new AuthenticationToken
        {
            Name = "expires_at",
            Value = DateTime.UtcNow.AddSeconds(response.ExpiresIn).ToString("o", CultureInfo.InvariantCulture)
        }
    };

    //获取 身份认证票据
    var authenticationResult =
        await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    //使用刷新后的令牌更新认证票据
    authenticationResult.Properties.StoreTokens(tokens);
    //重新登录以 重新颁发票据给客户端浏览器
    await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
        authenticationResult.Principal,
        authenticationResult.Properties);
    return response.AccessToken;
}
```
通过以上代码可以看到，我们可以使用客户端认证数据(`ClientId/ClientSecret`等)和`RefreshToken`通过`HttpContext.RequestRefreshTokenAsync()`方法向`IdentityServer`获取新的令牌。得到新的令牌后还需要刷新认证票据并重新颁发给客户端。

了解`RefreshToken`后，我们简单重构一下主页的`Action`方法在令牌过期后重新刷新令牌。

```csharp{12-13}
public async Task<IActionResult> Index()
{
    using var client = new HttpClient();
    var accessToken = await HttpContext.GetTokenAsync(OpenIdConnectParameterNames.AccessToken);
    client.SetBearerToken(accessToken);
    var response = await client.GetAsync(_options["WeatherApi"]);
    if (!response.IsSuccessStatusCode)
    {
        if (response.StatusCode != HttpStatusCode.Unauthorized)
            return StatusCode((int) response.StatusCode);
        
        await RefreshTokenAsync();
        return RedirectToAction();
    }
    
    var content = await response.Content.ReadAsStringAsync();
    return View((object) content);
}
```
