# 静态文件中间件

通过`UseStaticFiles()`启用静态文件中间件，它默认将应用程序根目录下`wwwroot`目录映射为网站静态文件根目录。

## 1. 默认文档和目录浏览
网站默认文件为`wwwroot/index.html`，非根目录无默认文件，需要使用`UseDefaultFiles()`中间件设置，默认为该目录下`index.html`文件，也可以通过其重载设定其它默认文件名。 

处于安全考虑，默认情况下系统禁止直接访问静态文件所在目录，如果需要启动静态目录浏览，需要注入目录流浪服务并启用目录浏览中间件。
```csharp {4,9-11}
public void ConfigureServices(IServiceCollection services)
{
    services.AddControllers();
    services.AddDirectoryBrowser();
}

public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    app.UseDirectoryBrowser();
    app.UseDefaultFiles();
    app.UseStaticFiles();
    
    app.UseRouting();
    app.UseEndpoints(endpoints => { endpoints.MapControllers(); });
}
```

## 2. 自定义目录映射
除了使用默认的`wwwroot`目录，我们也可以配置任意目录映射为任意URL。
```csharp
app.UseStaticFiles(new StaticFileOptions
{
    RequestPath = "/a",
    FileProvider = new PhysicalFileProvider(Path.Combine(Directory.GetCurrentDirectory(), "files"))
});
```
以上代码可以将`/files`目录映射为`/a`路径。`/files/index.html`可通过`/a/index.html`访问，`RequestPath`不指定或指定为`/`时会将目录映射到网站根目录，系统会根据中间件注册顺序搜索文件目录或者匹配路由。

## 3. 重定向
在前后端分离的情况下，前端项目通常编译为一个`index.html`和一组css和js文件。css和js文件通常会部署在`CDN`服务器上以提升访问速度。前端项目可以部署在Nginx等独立的服务器上， 如果不想为`index.html`设立一个单独的服务器，也可以与Asp.Net Core应用程序一起托管在Kestral服务器中，通过不同路径区分前后端请求，如所有 `/api/*`的请求设为后端请求，其它则都视为前端请求，重定向到`index.html`即可。

```csharp
public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    app.MapWhen(context => !context.Request.Path.Value.StartsWith("/api"), builder =>
    {
        var options=new RewriteOptions();
        options.AddRewrite(".*", "/index.html", true);
        builder.UseRewriter(options);

        builder.UseStaticFiles();
    });

    app.UseRouting();
    app.UseEndpoints(endpoints => { endpoints.MapControllers(); });
}
```

使用以上中间件配置，所有`/api/*`请求正常匹配MVC路由，其它请求则全部重定向到`/index.html`