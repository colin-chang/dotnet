# Hybrid

`Hybrid`是`OpenID Connect`协议中定义授权方式，它结合了`Authorization code`和`implicit`两种授权方式。`Hybrid`授权方式可以通过客户端配置`ResponseType`属性来选择`Code/Id Token`, `Code/Token`或`Code/Id Token/Token`令牌组合方式，用户在`Identity Server`认证通过后会返回`Authorization code`给客户端浏览器，接下来根据客户端配置的`ResponseType`不同，授权过程也略有区别。`Hybrid flow`的三种令牌组合都需要`Authorization code`，因此常用于保护机密客户端。[oidc-client](https://github.com/IdentityModel/oidc-client-js/wiki)不支持`Hybrid flow`。

## 1. Identity Server
本节我们继续使用[Authorization Code](code.md)章节中的[IdentityServer](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServerWithUI)服务。下面我们简单来演示如何进行客户端注册。本节代码已分享到[Github](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServerWithUI)。

```csharp{8,20-21}
public static IEnumerable<Client> Clients =>
    new[]
    {
        new Client
        {
            ClientId = "HybridMvcClient",
            ClientSecrets = {new Secret("HybridMvcClient".Sha256())},
            AllowedGrantTypes = GrantTypes.Hybrid,
            AllowedScopes =
            {
                "WeatherApi",
                IdentityServerConstants.StandardScopes.OpenId,
                IdentityServerConstants.StandardScopes.Profile
            },
            
            RedirectUris = {"https://localhost:9000/signin-oidc"},
            FrontChannelLogoutUri = "https://localhost:9000/signout-oidc",
            PostLogoutRedirectUris = {"https://localhost:9000/signout-callback-oidc"},
            AllowOfflineAccess = true,
            RequirePkce = false, // 关闭 authorization code请求过程验证proof key
            AlwaysIncludeUserClaimsInIdToken = true // 在IdToken中包含所有用户身份声明
        }
    };
```

## 2. Client
这里[API项目](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServer.Api)依然使用[Client Credentials](./cc.md#_2-api)中的代码，不再赘述。

这里我们建立一个Asp.Net MVC程序作为客户端，客户端代码已共享至[Github](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServer.HybridMvcClient)。

```csharp{22,33-38}
public void ConfigureServices(IServiceCollection services)
{
    services.AddControllersWithViews();
    
    JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

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
            options.ResponseType = OidcConstants.ResponseTypes.CodeIdToken;

            options.SaveTokens = true;
            options.RequireHttpsMetadata = false;

            options.Scope.Clear();
            foreach (var scope in is4Options.Scopes)
                options.Scope.Add(scope.Name);

            options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;

            // 添加 claims 从忽略列表中移除等同于添加 
            options.ClaimActions.Remove("nbf");
            options.ClaimActions.Remove("exp");
            // 移除 claims
            options.ClaimActions.DeleteClaim("sid");
            options.ClaimActions.DeleteClaim("sub");
        });
}
```
`Hybrid`客户端配置除了`ResponseType`属性其它配置与`Authorization code`完全一致，不再赘述。

`Hybrid`访问`Identity data`和`API`资源，刷新令牌，注销登录等行为方式也与`Authorization code`完全一致，亦不再赘述。

## 3. Claims
`Identity Server`在用户认证后返回的`Token/Id Token`中包含的了认证的`Claims`。默认情况直接访问`User.Claims`只能拿到部分`Claims`，那是因为框架默认选择了部分`Claims`映射到`User.Claims`对象。

如有需要，开发者也可以手动添加或移除特定`Claims`，具体参见客户端`33-38`行代码。

如果要将用户`Claims`包含在Id Token中返回，可以在`Identity Server`注册客户端时设置
`AlwaysIncludeUserClaimsInIdToken = true`。