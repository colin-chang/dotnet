# 第三方登录

除了自定义身份认证之外，`Identity Server`也支持使用第三方登录。很多知名平台都提供了第三方登录，如 Google，Github，Microsoft，微信，微博等。下面我们以 Google 和 Github 为例简单演示第三方登录集成，其它第三方认证各平台申请方式略有差异，但集成方式基本相同。

## 1. Google

### 1.1 申请Google认证

使用第三方授权首先需要到对应平台下申请认证信息。Google 认证信息需要到[Google Cloud Platform 控制台](https://console.developers.google.com)申请。

我们首先创建一个项目。

![创建GCP项目](https://i.loli.net/2021/05/20/Snip6uYOj8tLacP.png)

![填写GCP项目信息](https://i.loli.net/2021/05/20/FDnMyRl79aYgCzG.png)

项目创建完成后，进入 API 和服务。

![GCP API和服务](https://i.loli.net/2021/05/20/qIukeGUx3avRCQf.png)

第一次使用时需要创建一个 OAuth 同意屏幕。

![创建OAuth同意屏幕](https://i.loli.net/2021/05/20/52t9QVCRzYmFJhn.png)

OAuth 同意屏幕创建过程不再逐步讲解，下图是其摘要信息。

![OAuth同意屏幕摘要](https://i.loli.net/2021/05/20/kzTFPaO8VuqSLDM.png)

接下来开始正式创建凭据。

![创建凭据](https://i.loli.net/2021/05/20/axts7kA8YB4yp3Q.png)

`Identity Server` 是Web应用，所以下面我们选择创建 Web应用。

![创建Web应用](https://i.loli.net/2021/05/20/etLrnxiwN4zAGE7.png)

下面根据`Identity Server`信息填写Web应用客户端信息。

![完善客户端信息](https://i.loli.net/2021/05/20/FIctldn13jhy5pO.png)

客户端创建完成后得到下图的凭据。

![GCP客户端凭据](https://i.loli.net/2021/05/20/4SxcJUyuBZTm3C2.png)

### 1.2 集成Google认证

集成 Google 认证需要借助[Microsoft.AspNetCore.Authentication.Google](https://www.nuget.org/packages/Microsoft.AspNetCore.Authentication.Google) Nuget 包。

`Identity Server`默认项目模板中已经集成了 Google 认证，我们只需要替换为刚申请的凭证信息即可。

```csharp{5-14}
public void ConfigureServices(IServiceCollection services)
{
   //...
    services.AddAuthentication()
        .AddGoogle(options =>
        {
            options.SignInScheme = IdentityServerConstants.ExternalCookieAuthenticationScheme;

            // register your IdentityServer with Google at https://console.developers.google.com
            // enable the Google+ API
            // set the redirect URI to https://localhost:5000/signin-google
            options.ClientId = "778213714307-cjpuh2td8uml33lke0n818t7ft37kfvb.apps.googleusercontent.com";
            options.ClientSecret = "Eiv41aO7KHdq2BNSpXx5Vkzr";
        });
}
```

### 1.3 客户端Google登录

这里我们使用 [Implicit](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServer.ImplicitJavaScriptClient) 中的客户端为例来演示 Google 认证过程。

在客户端登录被重定向到`Identity Server`后我们可以看到 Google 认证的入口。

![Google登录](https://i.loli.net/2021/05/20/JlkFs3LVa7cNQW6.png)

点击 Google 认证按钮被重定向到 Google 认证授权页面

![Google认证](https://i.loli.net/2021/05/20/mhPoRQDBCKF7GZ5.png)

认证通过后可以在客户端拿到 Google 的 `Identity` 数据如下图。

![Google Identity](https://i.loli.net/2021/05/20/MzrSWDZcv73sCiF.png)

## 2. Github

### 2.1 申请Github认证

Github 认证信息需要到[Settings / Developer settings](https://github.com/settings/profile)申请。

![Github Settings](https://i.loli.net/2021/05/20/kvAdzFpIa7qenCU.png)

在`Developer settings`中创建 OAuth 应用。

![Github创建应用](https://i.loli.net/2021/05/20/ldsrFbeyUNQJ2gR.png)
![注册OAuth App](https://i.loli.net/2021/05/20/4N8LUyJhelgbrjH.png)

应用创建完毕后可以得到凭证如下图。

![github-client-credential.png](https://i.loli.net/2021/05/20/micGbH4z5guEP1N.png)

### 2.2 集成Github认证

集成 Github 认证需要借助[AspNet.Security.OAuth.GitHub](https://www.nuget.org/packages/AspNet.Security.OAuth.GitHub/) Nuget 包。

Github 认证集成方式与 Google 基本一致，更多内容可以参考[官方案例](https://github.com/aspnet-contrib/AspNet.Security.OAuth.Providers/blob/dev/samples/Mvc.Client/Startup.cs)。

```csharp{5-11}
public void ConfigureServices(IServiceCollection services)
{
   //...
    services.AddAuthentication()
        .AddGitHub(options =>
        {
            options.SignInScheme = IdentityServerConstants.ExternalCookieAuthenticationScheme;
            options.ClientId = "49e302895d8b09ea5656";
            options.ClientSecret = "98f1bf028608901e9df91d64ee61536fe562064b";
            options.Scope.Add("user:email");
        });
}
```

### 2.3 客户端Github登录

这里我们继续使用 [Implicit](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServer.ImplicitJavaScriptClient) 中的客户端为例来演示 Github 认证过程。

在客户端登录被重定向到`Identity Server`后我们可以看到Google认证的入口。

![Github登录](https://i.loli.net/2021/05/20/2WsfLzwX3jDgSaA.png)

点击 Github 认证按钮被重定向到 Github 认证授权页面。

![Github认证](https://i.loli.net/2021/05/20/NRyxhcLIQM4DvZo.png)
![同意授权页面](https://i.loli.net/2021/05/20/mtofyqj1RFxPpvI.png)

认证通过后可以在客户端拿到 Github 的`Identity`数据如下图。

![Github Identity](https://i.loli.net/2021/05/20/VosGHXdal9AbCuN.png)
