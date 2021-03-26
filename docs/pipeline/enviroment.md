# 承载环境

基于`IHostBuilder/IHost`的承载系统通过`IHostEnvironment`接口表示承载环境，我们利用它不仅可以得到当前部署环境的名称，还可以获知当前应用的名称和存放内容文件的根目录路径。对于一个 Web 应用来说，我们需要更多的承载环境信息，额外的信息定义在`IWebHost Environment`接口中。

## 1. IWebHostEnvironment
`EnvironmentName` 表示当前应用所处部署环境的名称，其中开发（`Development`）、预发（`Staging`）和产品（`Production`）是 3种典型的部署环境。根据不同的目的可以将同一个应用部署到不同的环境中，在不同环境中部署的应用往往具有不同的设置。在默认情况下，环境的名称为`Production`。

`ApplicationName`代表当前应用的名称，它的默认值取决于注册的`IStartup`服务。`IStartup`服务旨在完成中间件的注册，不论是调用`IWebHostBuilder`接口的`Configure`方法，还是调用它的`UseStartup/UseStartup＜TStartup＞`方法，最终都是为了注册`IStartup`服务，所以这两个方法是不能被重复调用的。如果多次调用这两个方法，最后一次调用针对`IStartup`的服务注册会覆盖前面的注册。

```csharp
public interface IHostEnvironment
{
    string EnvironmentName { get; set; }
    string ApplicationName { get; set; }
    string ContentRootPath { get; set; }
    IFileProvider ContentRootFileProvider { get; set; }
}

public interface IWebHostEnvironment : IHostEnvironment
{
    string WebRootPath { get; set; }
    IFileProvider WebRootFileProvider { get; set; }
}
```

编译发布一个ASP.NET Core项目时，项目的源代码文件会被编译成二进制并打包到相应的程序集中，而另外一些文件（如 JavaScript、CSS和表示 View的.cshtml文件等）会复制到目标目录中，我们将这些文件称为内容文件（`ContentFile`）。ASP.NET Core 应用会将所有的内容文件存储在同一个目录下，这个目录的绝对路径通过`IWebHostEnvironment`接口的`ContentRootPath`属性来表示，而`ContentRootFileProvider`属性则返回针对这个目录的`PhysicalFileProvider`对象。部分内容文件可以直接作为 Web资源（如 JavaScript、CSS和图片等）供客户端以HTTP请求的方式获取，存放此种类型内容文件的绝对目录通过`IWebHostEnvironment`接口的`WebRootPath`属性来表示，而针对该目录的`PhysicalFileProvider`自然可以通过对应的`WebRootFileProvider`属性来获取。

在默认情况下，**由`ContentRootPath`属性表示的内容文件的根目录就是当前应用程序域的基础目录，如果该目录下存在一个名为`wwwroot`的子目录，那么它将用来存放 Web 资源，`WebRootPath`属性将返回这个目录；如果这样的子目录不存在，那么`WebRootPath`属性会返回`Null`。**

## 2. 配置承载环境
通过[读取和修改键值对配置]中的讲解我们了解到可以定制配置项，那么承载环境也是如此，其中除了`ApplicationName`外`EnvironmentName/ContentRootPath/WebRootPath`的修改都提供了扩展方法。

```csharp{5-8}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .UseEnvironment(Environments.Staging)
            .UseContentRoot(Directory.GetCurrentDirectory())
            .UseWebRoot("wwwroot")
            .UseSetting(HostDefaults.ApplicationKey,"TestApp")
            .UseStartup<Startup>())
        .Build()
        .Run();
}
```

## 3. 针对环境的编程
对于同一个ASP.NET Core应用来说，我们添加的服务注册、提供的配置和注册的中间件可能会因部署环境的不同而有所差异。有了这个可以随意注入的`IWebHostEnvironment`服务，我们可以很方便地知道当前的部署环境并进行有针对性的差异化编程。
### 3.1 注册服务
```csharp{5-11}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices((context, services) =>
            {
                if (context.HostingEnvironment.IsDevelopment())
                    services.AddSingleton<IFooBar, Foo>();
                else
                    services.AddSingleton<IFooBar, Bar>();
            })
            .UseStartup<Startup>())
        .Build()
        .Run();
}
```
如果利用`Startup`类型来添加服务注册，我们可以通过构造函数注入的方式得到所需的`IWebHostEnvironment`服务。

除了在注册`Startup`类型中的`ConfigureServices`方法完成针对承载环境的服务注册，我们还可以将针对某种环境的服务注册实现在对应的`Configure{EnvironmentName}Services`方法中。

```csharp{11-12,14-15}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .UseStartup<Startup>())
        .Build()
        .Run();
}
public class Startup
{
    public void ConfigureDevelopmentService(IServiceCollection services)=>
        services.AddSingleton<IFooBar, Foo>();
    
    public void ConfigureService(IServiceCollection services)=>
        services.AddSingleton<IFooBar, Bar>();

    public void Configure(IApplicationBuilder app) { }
}
```
### 3.2 注册中间件
我们知道中间件都是借助`IApplicationBuilder`对象来注册的，我们可以通过其`ApplicationServices`属性获得获取根容器，进而从容器中获取环境变量即可。

```csharp{7-11}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .Configure(app =>
            {
                var env= app.ApplicationServices.GetRequiredService<IWebHostEnvironment>();
                if (env.IsDevelopment())
                    app.UseMiddleware<FooMiddleware>();
                else
                    app.UseMiddleware<BarMiddleware>();
            })
            )
        .Build()
        .Run();
}
```

如果通过`Startup`注册中间件，则可以直接在`Configure`方法中注入环境服务。除了以上方式，我们也可以通过`UseWhen`实现针对具体环境注册对应的中间件。
```csharp{3,5-6}
public class Startup
{
    public void Configure(IApplicationBuilder app, IHostEnvironment env)
    {
        app.UseWhen(_ => env.IsDevelopment(), 
            bd => bd.UseMiddleware<FooMiddleware>());
        app.UseWhen(_ => !env.IsDevelopment(), 
            bd => bd.UseMiddleware<BarMiddleware>());
    }
}
```
与服务注册类似，针对环境的中间件注册同样可以定义在对应的`Configure{Environment Name}`方法中。
```csharp{3,6}
public class Startup
{
    public void ConfigureDevelopment(IApplicationBuilder app, IHostEnvironment env) =>
        app.UseMiddleware<FooMiddleware>();

    public void Configure(IApplicationBuilder app, IHostEnvironment env) =>
        app.UseMiddleware<BarMiddleware>();
}
```

### 3.3 配置
通过前面的介绍可知，`IWebHostBuilder`接口提供了一个名为`ConfigureAppConfiguration`的方法，我们可以调用这个方法来注册相应的`IConfigureSource`对象，可以通过提供的这个`WebHostBuilderContext`上下文得到提供环境信息的IWebHostEnvironment对象，进而加载不同的配置。如果采用配置文件，我们可以将配置内容分配到多个文件中，根据环境变量加载不同文件即可。一般承载系统的用法参见[承载环境](../hosting/hosted_service.md#_3-2-承载环境)。

Asp.Net Core除了使用`IHostBuilder`还可以使用`IWebHostService`，用法基本一致。
```csharp{5-7}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureAppConfiguration((context, builder) => builder
                .AddJsonFile("appsettings.json", false)
                .AddJsonFile($"appsettings.{context.HostingEnvironment.EnvironmentName}.json"))
            .UseStartup<Startup>())
        .Build()
        .Run();
}
```
