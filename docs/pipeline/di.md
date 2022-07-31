# 依赖注入

基于`IHostBuilder/IHost`的服务承载系统建立在依赖注入框架之上，依赖注入是.Net的基础编程框架，在前面章节我们详细介绍了[依赖注入](../di/di.md)，接下来我们来探讨一下依赖注入在管道中的工作过程。

## 1. 服务注册
ASP.Net 应用提供了两种服务注册方式，一种是调用`IWebHostBuilder`接口的`ConfigureServices`方法，另一种则是利用注册的`Startup`类型来完成服务的注册。

ASP.Net 应用针对请求的处理能力与方式完全取决于注册的中间件，所以针对应用程序的初始化主要体现在针对中间件的注册上。对于注册的中间件来说，它往往具有针对其它服务的依赖。中间件依赖的这些服务自然需要被预先注册，所以中间件和服务注册成为`Startup`对象的两个核心功能。

```csharp
public class Startup
{
    public void ConfigureService(IServiceCollection services);
    public void Configure(IApplicationBuilder app);
}
```
与中间件类型类似，我们在大部分情况下会采用约定的形式来定义`Startup`类型。中间件和服务的注册分别实现在`Configure`方法和`ConfigureServices`方法中。由于并不是在任何情况下都有服务注册的需求，所以`ConfigureServices`方法并不是必需的。**`Startup`对象的 `ConfigureServices`方法的调用发生在整个服务注册的最后阶段，在此之后，ASP.Net应用就会利用所有的服务注册来创建作为依赖注入容器的`IServiceProvider`对象。**

ASP.Net 框架本身在构建请求处理管道之前也会注册一些服务，这些公共服务除了供框架自身消费，也可以供应用程序使用。如`IHostEnvironment/IConfiguration/IApplicationLifeTime/IOptions<TOptions>/ILogger<TCategoryName>`等。

## 2. 服务消费
### 2.1 Startup
`Startup`除了支持支持构造函数注入，还可以在其`Configure`方法中使用方法注入。

```csharp{4,12,18}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureServices(services => services.AddSingleton<IFoo, Foo>())
        .ConfigureWebHostDefaults(builder => builder.UseStartup<Startup>())
        .Build()
        .Run();
}

public class Startup
{
    public Startup(IFoo foo) =>
        Debug.Assert(foo != null);

    public void ConfigureServices(IServiceCollection services) =>
        services.AddSingleton<IBar, Bar>();

    public void Config(IApplicationBuilder app, IBar bar) =>
        Debug.Assert(bar != null);
}
```
### 2.2 中间件
ASP.Net 在创建中间件对象并利用它们构建整个请求处理管道时，所有的服务都已经注册完毕，所以注册的任何一个服务都可以注入中间件类型的构造函数中。中间件的`InvokeAsync`也支持方法注入。

对于基于约定的中间件，构造函数注入与方法注入存在一个本质区别。**基于约定的中间件会被注册为一个`Singleton`对象，所以我们不应该在它的构造函数中注入`Scoped`服务。`Scoped`服务只能注入中间件类型的`InvokeAsync`方法中，因为依赖服务是在针对当前请求的服务范围中提供的，所以能够确保`Scoped`服务在当前请求处理结束之后被释放。**

```csharp{5,6,18-19,26-27}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureServices(services => services
            .AddSingleton<IFoo, Foo>()
            .AddScoped<IBar, Bar>())
        .ConfigureWebHostDefaults(builder =>
            builder.Configure(app => app.UseMiddleware<HelloMiddleware>(false)))
        .Build()
        .Run();
}

public sealed class HelloMiddleware
{
    private readonly RequestDelegate _next;
    private readonly bool _foreward2Next;

    // 基于约定的中间件 构造函数只能注入 单例服务
    public HelloMiddleware(RequestDelegate next, IFoo foo, bool foreward2Next = true)
    {
        Debug.Assert(foo != null);
        _next = next;
        _foreward2Next = foreward2Next;
    }

    // Scoped服务要在InvokeAsync中做方法注入
    public async Task InvokeAsync(HttpContext context, IBar bar)
    {
        Debug.Assert(bar != null);
        await context.Response.WriteAsync("Hello world");
        if (_foreward2Next) await _next(context);
    }
}
```

### 2.3 MVC应用
#### 2.3.1 Controller/PageModel
```csharp
private IHostEnvironment _env;
public AccountController(IHostEnvironment env) => _env = env;
```
如果仅在个别`Action`方法使用消费服务，也可以通过`[FromService]`方式注入对象。
```csharp
public async Task Post([FromServices] IHostEnvironment env){}
```
#### 2.3.2 View
在`View`中需要用`@inject`再声明一下，起一个别名。
```html
@inject IHostEnvironment env
<!DOCTYPE html>
<html>
<head></head>
<body>
  @env.EnvironmentName
</body>
</html>
```

## 3. 生命周期
在[服务声明周期](../di/lifetime.md)中我们对依赖注入服务的生命周期做了深入的探讨。

### 3.1 IServiceProvider
ASP.Net 在应用程序正常启动后，它会利用注册的服务创建一个作为根容器的`IServiceProvider` 对象，我们可以将它称为 **ApplicationServices** 。如果应用在处理某个请求的过程中需要采用依赖注入的方式激活某个服务实例，那么它会利用这个`IServiceProvider`对象创建一个代表服务范围的`ServiceScope`对象，后者会指定一个`IServiceProvider`对象作为子容器，请求处理过程中所需的服务实例均由它来提供，我们可以将它称为 **RequestServices**。

### 3.2 Scoped
**`Scoped`服务既不应该由作为根容器的`ApplicationServices`来提供，也不能注入一个 `Singleton`服务中，否则它将无法在请求结束之后释放。如果忽视了这个问题，就容易造成内存泄漏**。

我们可以通过启用针对服务范围的验证来避免采用作为根容器的`IServiceProvider`对象来提供 `Scoped`服务实例。此选项默认是开启的。

```csharp{5-6,10-12,14-16}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureServices(services => services
            .AddScoped<IFoo, Foo>())
        .UseDefaultServiceProvider(configure => configure.ValidateScopes = true)
        .ConfigureWebHostDefaults(builder => builder.Configure(app =>
            app.Run(async context =>
            {
                // 错误示范
                // var foo = app.ApplicationServices.GetService<IFoo>();
                // Debug.Assert(foo != null);

                // 正确做法
                var foo = context.RequestServices.GetService<IFoo>();
                Debug.Assert(foo != null);
                
                await context.Response.WriteAsync("Hello world");
            })
        ))
        .Build()
        .Run();
}
```

以上手动关闭了验证并使用根容器获取`Scoped`服务是错误的做法，此处仅做学习探讨示范，切勿在开发中使用。

如果需要在中间件中注入`Scoped`服务，可以采用强类型（实现`IMiddleware`接口）的中间件定义方式，并将中间件以`Scoped`服务进行注册即可。如果采用基于约定的中间件定义方式，我们有两种方案来解决这个问题：第一种解决方案就是在 `InvokeAsync`方法中利用 `HttpContext`的 `RequestServices`属性得到基于当前请求的 `IServiceProvider`对象，并利用它来提供依赖的服务。第二种解决方案则是按照如下所示的方式直接在`InvokeAsync`方法中注入依赖的服务。用法参见[2.2 中间件](#_2-2-中间件)。

### 3.3 第三方DI框架
通过调用`IHostBuilder`接口的`UseServiceProviderFactory＜TContainerBuilder＞`方法注册`IServiceProviderFactory＜TContainerBuilder＞`工厂的方式可以实现与第三方依赖注入框架的整合。使用案例参考[Autofac](../di/aspnet.md#_4-autofac)。
