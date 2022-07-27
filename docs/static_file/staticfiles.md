# 静态文件

通过 HTTP 请求获取的 Web 资源大部分来源于存储在服务器磁盘上的静态文件。对于ASP.NET Core 应用来说，如果将静态文件存储到约定的目录下，绝大部分文件类型都是可以通过Web的形式对外发布的。基于静态文件的请求由3个中间件负责处理，它们均定义在`Microsoft.AspNetCore.StaticFiles` NuGet包中
## 1. 物理文件
### 1.1 StaticFileMiddleware
在dASP.NET Core应用中，默认作为`WebRoot`的`wwwroot`目录下，可以将JavaScript脚本文件、CSS样式文件和图片文件存放到对应的子目录（js、css和 img）下。`WebRoot`目录下的所有文件将自动发布为Web资源，客户端可以访问相应的URL来读取对应文件的内容。

针对具体某个静态文件的请求是通过一个名为`StaticFileMiddleware`的中间件来处理的。请求采用的URL由目标文件相对于`WebRoot`目录的路径决定。

```csharp{5}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder.Configure(app =>
            app.UseStaticFiles()
        ))
        .Build()
        .Run();
}
```
### 1.2 自定义目录
`StaticFileMiddleware`中间件的内部维护着一个`IFileProvider`对象和请求路径的映射关系。如果调用`UseStaticFiles`方法没有指定任何参数，那么这个映射关系的请求路径就是应用的基地址(`/`)，对应的`IFileProvider`对象自然就是指向`WebRoot`目录的`PhysicalFileProvider`对象。

如果需要访问其它目录的静态文件则需要指定一个类型为`StaticFileOptions`的对象作为参数来定制请求路径与对应`IFileProvider`对象之间的映射关系。

```csharp{5-11}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder.Configure(app => app
            .UseStaticFiles()
            .UseStaticFiles(new StaticFileOptions
            {
                RequestPath = "/docs",
                FileProvider =
                    new PhysicalFileProvider(Path.Combine(Directory.GetCurrentDirectory(), "documents"))
            })
        ))
        .Build()
        .Run();
}
```
配置以上映射后，物理文件`/documents/gem.jpg` 就可以通过 `https://localhost:5001/docs/gem.jpg`来访问。

![示例项目目录](https://i.loli.net/2021/03/26/td9JeYMuGp2UgxA.png)

## 2. 目录结构
默认情况下浏览器发送一个针对目录的请求（如`http://localhost:5000/img/`），得到的将是一个状态为`404 Not Found`的响应。如果希望浏览器呈现出目标目录的结构，就可以注册另一个名为`DirectoryBrowserMiddleware`的中间件。目录浏览中间件默认指向`WebRoot`我们也可以自定义。如果要查看目录列出的文件内容还需要注入`StaticFileMiddleware`。

```csharp{11-16}
public static void Main(string[] args)
{
    var fileProvider = new PhysicalFileProvider(Path.Combine(Directory.GetCurrentDirectory(), "documents"));
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder.Configure(app => app
            .UseStaticFiles()
            .UseStaticFiles(new StaticFileOptions
            {
                RequestPath = "/docs",
                FileProvider = fileProvider
            })
            .UseDirectoryBrowser()
            .UseDirectoryBrowser(new DirectoryBrowserOptions
            {
                RequestPath = "/docs",
                FileProvider = fileProvider
            })
        ))
        .Build()
        .Run();
}
```

从安全的角度来讲，利用注册的`UseDirectoryBrowser`中间件会将整个目标目录的结构和所有文件全部暴露出来，所以这个中间件需要根据自身的安全策略谨慎使用。

![浏览目录](https://i.loli.net/2021/03/26/NKrPfEcSRyu8OQG.png)

## 3. 默认页面

对于针对目录的请求，更加常用的处理策略就是显示一个保存在这个目录下的默认页面。默认页面文件一般采用如下4种命名约定：`default.htm/default.html/index.htm/index.html`。针对默认页面的呈现实现在一个名为`DefaultFilesMiddleware`的中间件中，我们演示的这个应用就可以按照如下方式调用`IApplicationBuilder`接口的`UseDefaultFiles`扩展方法来注册这个中间件。

```csharp{6-11}
public static void Main(string[] args)
{
    var fileProvider = new PhysicalFileProvider(Path.Combine(Directory.GetCurrentDirectory(), "documents"));
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder.Configure(app => app
            .UseDefaultFiles()
            .UseDefaultFiles(new DefaultFilesOptions
            {
                RequestPath = "/docs",
                FileProvider = fileProvider
            })
            .UseStaticFiles()
            .UseStaticFiles(new StaticFileOptions
            {
                RequestPath = "/docs",
                FileProvider = fileProvider
            })
            .UseDirectoryBrowser()
            .UseDirectoryBrowser(new DirectoryBrowserOptions
            {
                RequestPath = "/docs",
                FileProvider = fileProvider
            })
        ))
        .Build()
        .Run();
}
```

必须在注册 `StaticFileMiddleware` 中间件和 `DirectoryBrowserMiddleware` 中间件之前注册`DefaultFilesMiddleware` 中间件，否则它无法发挥作用。这是因为`DirectoryBrowserMiddleware` 中间件和 `DefaultFilesMiddleware` 中间件处理的均是针对目录的请求，如果先注册 `DirectoryBrowser` `Middleware` 中间件，那么显示的总是目录的结构；如果先注册用于显示默认页面的`DefaultFilesMiddleware` 中间件，那么在默认页面不存在的情况下它会将请求分发给后续中间件，而`DirectoryBrowserMiddleware`中间件会接收请求的处理并将当前目录的结构呈现出来。

要先于 `StaticFileMiddleware`中间件之前注册 `DefaultFilesMiddleware`中间件是因为后者是通过采用 URL重写的方式实现的，也就是说，这个中间件会将针对目录的请求改写成针对默认页面的请求，而最终针对默认页面的请求还需要依赖`StaticFileMiddleware`中间件来完成。

```csharp{9,14}
public static void Main(string[] args)
{
    var fileProvider = new PhysicalFileProvider(Path.Combine(Directory.GetCurrentDirectory(), "documents"));
    var defaultFileOption = new DefaultFilesOptions
    {
        RequestPath = "/docs",
        FileProvider = fileProvider
    };
    defaultFileOption.DefaultFileNames.Add("readme.txt");

    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder.Configure(app => app
            .UseDefaultFiles()
            .UseDefaultFiles(defaultFileOption)
            .UseStaticFiles()
            .UseStaticFiles(new StaticFileOptions
            {
                RequestPath = "/docs",
                FileProvider = fileProvider
            })
        ))
        .Build()
        .Run();
}
```
如果不想使用默认的4种命名约定，也可以手动添加默认文件名。

## 4. 媒体类型
文件能够在浏览器上正常显示的前提是响应报文通过`Content-Type`报头携带的媒体类型必须与内容一致。`StaticFileMiddleware` 中间件针对媒体类型的解析是通过一个`IContentTypeProvider` 对象来完成的，默认采用的是该接口的实现类型`FileExtensionContentTypeProvider`，它根据文件的扩展命名来解析媒体类型，内部预定了数百种常用文件扩展名与对应媒体类型之间的映射关系，所以如果发布的静态文件具有标准的扩展名，那么`StaticFileMiddleware`中间件就能为对应的响应赋予正确的媒体类型。

如果某个文件的扩展名没有在预定义的映射之中，或者需要某个预定义的扩展名匹配不同的媒体类型，`StaticFileMiddleware`中间件将无法为针对该文件的请求解析出正确的媒体类型。处理未知文件类型第一种方案就是为`StaticFileMiddleware`中间件不支持的文件类型设置一个默认的媒体类型，但所有未知类型只能设置一种默认媒体类型，如果具有多种需要映射成不同媒体类型的文件类型，采用这种方案就达不到目的。

```csharp{5-10}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder.Configure(app => app
            .UseStaticFiles(new StaticFileOptions
            {
                ServeUnknownFileTypes = true,
                // 所有未知文件类型均采用 image/jpg
                DefaultContentType = "image/jpg"
            })
        ))
        .Build()
        .Run();
}
```

由于`StaticFileMiddleware`中间件使用的`IContentTypeProvider`对象是可以定制的，所以可以按照如下方式显式地为该中间件指定一个 `FileExtensionContentTypeProvider`对象，然后将缺失的映射添加到这个对象上，从根本上解决未知媒体类型的问题。

```csharp{3-5,8}
public static void Main(string[] args)
{
    var contentTypeProvider = new FileExtensionContentTypeProvider();
    // .img 类型文件 采用 image/jpg 媒体类型
    contentTypeProvider.Mappings.Add(".img", "image/jpg");
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder.Configure(app => app
            .UseStaticFiles(new StaticFileOptions {ContentTypeProvider = contentTypeProvider})
        ))
        .Build()
        .Run();
}
```

## 5. 重定向
在前后端分离的情况下，前端项目通常编译为一个`index.html`和一组css和js文件。css和js文件通常会部署在`CDN`服务器上以提升访问速度。前端项目可以部署在Nginx等独立的服务器上， 如果不想为`index.html`设立一个单独的服务器，也可以与Asp.Net Core应用程序一起托管在Kestral服务器中，通过不同路径区分前后端请求，如所有 `/api/*`的请求设为后端请求，其它则都视为前端请求，重定向到`index.html`即可。

```csharp{5-7}
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

使用以上中间件配置，所有`/api/*`请求正常匹配MVC路由，其它请求则全部重定向到`/index.html`。