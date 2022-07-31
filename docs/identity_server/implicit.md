# Implicit

`Implicit`授权方式适用于公开客户端，如Web SPA等，`Implicit`授权省略了`Authorization code`授权方式的授权码环节，当用户在`IdentityServer`认证完成后直接返回`Access Token`给客户端应用，省略了客户端注册过程。

## 1. Identity Server
本节我们继续使用[Authorization Code](code.md)章节中的[IdentityServer](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServerWithUI)服务。下面我们简单来演示如何进行客户端注册。

```csharp{7-8,15-25}
public static IEnumerable<Client> Clients =>
    new[]
    {
        new Client
        {
            ClientId = "ImplicitJavaScriptClient",
            RequireClientSecret = false, //不需要客户端认证，所以不需要ClientSecret
            AllowedGrantTypes = GrantTypes.Implicit,
            AllowedScopes =
            {
                "WeatherApi",
                IdentityServerConstants.StandardScopes.OpenId,
                IdentityServerConstants.StandardScopes.Profile
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
            RequireConsent = true, //是否需要用户点击同意
            AccessTokenLifetime = 5 * 60, //Implicit模式下Token有效时间一般设置较短
        }
    };
```
* 因为不需要进行客户端认证所以我们将`RequireClientSecret`设为`false`，不再提供`Client Secret`。
* 因为客户端应用没有服务端，`Access Token`将会直接通过浏览器返回给客户端，所以需要设置`AllowAccessTokensViaBrowser`为`true`。
* 如果客户端是Web应用，可以通过`ClientUri`设置其地址。
* `RedirectUris`和`PostLogoutRedirectUris`分别设置登录和注销成功后要跳转的路径，与`Authorization Code`授权方式中用法相同。
* 客户端是Web应用时，请求API一般会跨域，设置`AllowedCorsOrigins`属性允许客户端跨域即可。
* `RequireConsent`表示是否需要用户手动点击同意授权。
* `Implicit`模式下`Access Token`会直接暴露在公开客户端，出于安全考虑，一般会设置较短的有效期。

## 2. API
这里[API项目](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServer.Api)依然使用[Client Credentials](./cc.md#_2-api)中的代码，不再赘述。

`Implicit`客户端多为Web应用，此时就需要在API项目中开发客户端应用的[跨域请求](../cors/introduction.md)。

```csharp{4,11-17}
public void ConfigureServices(IServiceCollection services)
{
    // ...
    services.AddCors();
    // ...
}

public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    //...
    app.UseCors(policy =>
    {
        policy.WithOrigins("https://localhost:8000");
        policy.AllowAnyHeader();
        policy.AllowAnyMethod();
        policy.WithExposedHeaders("WWW-Authenticate");
    });
    //...
}
```

## 3. Client
考虑到有些读者对`Angular/Vue/React`等前端框架不了解，这里客户端应用我们就以最简单的原生`JavaScript`来演示。这里我们建立一个空的Asp.Net项目并注册[DefaultFilesMiddleware](../static_file/staticfiles.md#_3-默认页面)和[StaticFileMiddleware](../static_file/staticfiles.md#_1-1-staticfilemiddleware)两个中间件，在`wwwroot`目录中建立静态文件即可。当然也可以不使用Asp.Net项目模板，直接建立一个纯前端项目也可。客户端代码已共享至[Github](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServer.ImplicitJavaScriptClient)。

```csharp{4}
public class Startup
{
    public void Configure(IApplicationBuilder app) =>
        app.UseDefaultFiles().UseStaticFiles();
}
```

我们简单的使用`Bootstrap 4.x`来构建JS客户端，界面内容如下图所示。

![js-oidc-client.png](https://i.loli.net/2021/04/28/raTV586uf3dNIs7.png)

`IdentityServer`提供了JavaScript SDK —— [oidc-client](https://github.com/IdentityModel/oidc-client-js/wiki)

```bash
npm install oidc-client
npm install bootstrap
```

### 3.1 UserManager
`oidc-client`库用于管理管理OIDC客户端会话和令牌等，其中最常用的类型是`UserManager`,它提供了登录/注销/令牌管理等一系列API，下面简单演示如何通过`UserManager`来创建`Implicit`客户端。

```js{2-12,26}
(function () {
    let mgr = new Oidc.UserManager({
        authority: "https://localhost:5000",
        client_id: "ImplicitJavaScriptClient",
        redirect_uri: window.location.origin + "/signin-oidc.html",
        post_logout_redirect_uri: window.location.origin + "/signout-oidc.html",
        silent_redirect_uri: window.location.origin + "/silent-oidc.html",
        automaticSilentRenew: true,
        response_type: "id_token token",
        scope: "WeatherApi openid profile",
        revokeAccessTokenOnSignout: true,
    });

    mgr.events.addUserSignedIn(function (e) {
        log("user logged in to the token server");
    });
    mgr.events.addUserSignedOut(function () {
        log("User signed out of OP");
    });
    mgr.events.addAccessTokenExpiring(function () {
        log("Access token expiring...");
        renewToken();
    });

    function showTokens() {
        mgr.getUser()
            .then(function (user) {
                if (!!user)
                    display("#identityData", user);
                else
                    log("Not logged in");
            });
    }
    showTokens();
})();
```

* 构建`UserManager`对象时提供`IdentityServer`客户端基础配置。
* 可以在客户端注册用户登录/注销/令牌过期的事件
* `UserManager.getUser()`方法可以获取登录用户`Identity Data`等信息 

### 3.2 SignIn
用户点击登录按钮时执行以下函数调用`UserManager.signinRedirect()`，浏览器会跳转到`IdentiyServer`引导用户进行身份认证。
```js{2}
function signIn() {
    mgr.signinRedirect();
}
```
用户认证并点击同意授权后，`IdentityServer`会重定向到我们设定的`signin-oidc.html`并将`Id Token`和`Access Token`体现为URL中参数。

```html{1,3,4}
<script src="js/oidc-client.js"></script>
<script>
    new Oidc.UserManager()
        .signinRedirectCallback().then(function (user) {
        console.log(user);
        location.href = "/index.html"
    }).catch(function (e) {
        console.error(e);
    });
</script>
```
在`signin-oidc.html`中引入以上代码，通过`UserManager.signinRedirectCallback()`函数完成登录回调。此函数会自动解析URL参数中的`Id Token`和`Access Token`并将其保存在浏览器本地`Session Storage`中。登录过程完成后返回主页即可，主页中我们将用户信息显示在`Identity data Card`界面中。

### 3.3 SignOut
注销过程与登录类似。用户点击注销按钮时执行以下函数调用`UserManager.signoutRedirect()`，浏览器会跳转到`IdentiyServer`注销用户。
```js{2}
function signIn() {
    mgr.signinRedirect();
}
```
用户注销后，`IdentityServer`会重定向到我们设定的`signout-oidc.html`。

```html{1,3,4}
<script src="js/oidc-client.js"></script>
<script>
    new Oidc.UserManager()
        .signoutRedirectCallback().then(function () {
        location.href = "/index.html"
    }).catch(function (e) {
        console.error(e);
    });
</script>
```
在`signout-oidc.html`中引入以上代码，通过`UserManager.signoutRedirectCallback()`函数完成注销回调。此函数会自动清理浏览器本地`Session Storage`中的`Id Token`和`Access Token`。注销过程完成后返回主页即可。

### 3.4 Call API
用户登录后使用其`Access Token`请求API即可。需要注意请求API前，要做好`API/IdentityServer`的跨域配置。另外还需注意，API端口最好不要使用`Well Known Ports`，否则可能会被浏览器拦截。

```js{21,22}
function callApi() {
    mgr.getUser().then(function (user) {
        if (!user)
            signIn();
        
        let xhr = new XMLHttpRequest();
        xhr.onload = function () {
            if (xhr.status < 400) {
                display("#api", JSON.parse(xhr.response));
                return;
            }
            if (xhr.status == 401)
                signIn();
            
            log({
                status: xhr.status,
                statusText: xhr.statusText,
                wwwAuthenticate: xhr.getResponseHeader("WWW-Authenticate")
            });
        }
        xhr.open("GET", "https://localhost:10000/WeatherForecast", true);
        xhr.setRequestHeader("Authorization", "Bearer " + user.access_token);
        xhr.send();
    });
}
```

### 3.5 Renew Token
`Implicit`授权方式不允许使用`Refresh Token`，但`oidc-client`提供了`SilentRenew`方式来静默更新`Token`,设置`automaticSilentRenew`为`true`，令牌过期会自动静默更新，该方式所有流程都保持静默执行，并不会跳转页面。调用`UserManager.signinSilent()`来静默登录更新Token。

```js{2}
function renewToken() {
    mgr.signinSilent()
        .then(function () {
            log("silent renew success");
            showTokens();
        }).catch(function (err) {
        log("silent renew error", err);
    });
}
```
静默登录后浏览器会执行`silent_redirect_uri`设定的`silent-oidc.html`。
```html{1-2}
<script src="js/oidc-client.js"></script>
<script>new Oidc.UserManager().signinSilentCallback();</script>
```
在`silent-oidc.html`中引入以上代码，通过`UserManager.signinSilentCallback()`函数完成静默登录回调。此函数会静默更新浏览器本地`Session Storage`中的`Id Token`和`Access Token`。