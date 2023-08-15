# Asp.Net 依赖注入使用

## 1. 依赖注入在管道构建过程中的使用

在ASP.Net管道的构架过程中主要涉及三个对象/类型，作为宿主的`WebHost`和它的创建者`WebHostBuilder`，以及注册到`WebHostBuilder`的`Startup`类型。 如下的代码片段体现了启动ASP.Net应用采用的典型编程模式：我们首先创建一个`IWebHostBuilder`对象，并将`Startup`类型注册到它之上。在调用`Build`方法创建`WebHost`之前，我们还可以调用相应的方式做其它所需的注册工作。当我们调用`WebHost`的`Run`方法之后，后者会利用注册的`Startup`类型来构建完整的管道。那么在管道的构建过程中，`DI`是如何被应用的呢？

```csharp
WebHost.CreateDefaultBuilder(args)
    .UseStartup<Startup>()
    .Xxx
    .Build()
    .Run();
```

`DI`在ASP.Net管道构建过程中的应用基本体现在下面这个序列图中。当我们调用`WebHostBuilder`的`Build`方法创建对应的`WebHost`的时候，前者会创建一个`ServiceCollection`对象，并将一系列预定义的服务注册在它之上。接下来`WebHostBuilder`会利用这个`ServiceCollection`对象创建出对应的`ServiceProvider`，这个`ServiceProvider`和`ServiceCollection`对象会一并传递给最终创建`WebHost`对象。当我们调用`WebHost`的`Run`方法启动它的时候，如果注册的`Startup`是一个实例类型，则会以构造器注入的方式创建对应的`Startup`对象。我们注册的`Startup`类型的构造函数是允许定义参数的，但是参数类型必须是预先注册到`ServiceCollection`中的服务类型。

![DI在ASP.Net管道构建过程中的应用](https://i.loli.net/2020/02/26/Ugw9JOZxdmRMr7h.png)

注册的`Startup`方法可以包含一个可选的`ConfigureServices`方法，这个方法具有一个类型为`IServiceCollection`接口的参数。`WebHost`会将`WebHostBuilder`传递给它的`ServiceCollection`作为参数调用这个`ConfigureServices`方法，而我们则利用这个方法将注册的中间件和应用所需的服务注册到这个`ServiceCollection`对象上。在这之后，所有需要的服务（包括框架和应用注册的服务）都注册到这个`ServiceCollection`上面，`WebHost`会利用它创建一个新的`ServiceProvider`。`WebHost`会利用这个`ServiceProvider`对象以方法注入的方式调用`Startup`对象/类型的`Configure`方法，最终完成你对整个管道的建立。换句话会说，定义在`Startup`类型中旨在用于注册`Middleware`的`Configure`方法除了采用`IApplicationBuilder`作为第一个参数之外，它依然可以采用注册的任何一个服务类型作为后续参数的类型。

服务的注册除了现在注册的`Startup`类型的`ConfigureServices`方法之外，实际上还具有另一个实现方式，那就是调用`IWebHostBuilder`定义的`ConfigureServices`方法。当`WebHostBuilder`创建出`ServiceCollection`对象并完成了默认服务的注册后，我们通过调用这个方法所传入的所有`Action<IServiceCollection>`对象将最终应用到这个`ServiceCollection`对象上。

```csharp
public interface IWebHostBuilder
{
    IWebHostBuilder ConfigureServiecs(Action<IServiceCollection> configureServices);
}
```

值得一提的是，`Startup`类型的`ConfigureServices`方法是允许具有一个`IServiceProvider`类型的返回值，如果这个方法返回一个具体的`ServiceProrivder`，那么`WebHost`将不会利用`ServiceCollection`来创建`ServiceProvider`，而是直接使用这个返回的`ServiceProvider`来调用`Startup`对象/类型的`Configure`方法。这实际上是一个很有用的扩展点，使用它可以实现针对第三方`DI`框架（如`Unity`、`Castle`、`Ninject`和`AutoFac`等）的集成。

这里我们只是简单的介绍了Asp.Net程序启动的简单过程，具体实现细节属于Asp.Net框架的内容，我们将在后续[Asp.Net 程序启动源码和DI源码分析](src.md)中做详细介绍

## 2. 依赖服务注册

接下来我们通过一个实例来演示如何利用`Startup`类型的`ConfigureServices`来注册服务，以及在`Startup`类型上的两种依赖注入形式。如下面的代码片段所示，我们定义了两个服务接口（`IFoo`和`IBar`）和对应的实现类型（`Foo`和`Bar`）。其中服务`Foo`是通过调用`WebHostBuilder`的`ConfigureServices`方法进行注册的，而另一个服务Bar的注册则发生在`Startup`的`ConfigureServices`方法上。对于`Startup`来说，它具有一个类型为`IFoo`的只读属性，该属性在构造函数利用传入的参数进行初始化，不用说这体现了针对`Startup`的构造器注入。`Startup`的`Configure`方法除了`ApplicationBuilder`作为第一个参数之外，还具有另一个类型为`IBar`的参数，我们利用它来演示方法注入。

```csharp
public interface IFoo { }
public interface IBar { }
public class Foo : IFoo { }
public class Bar : IBar { }
 
public class Program
{
    public static void Main(string[] args)
    {
        WebHost.CreateDefaultBuilder(args)
            .ConfigureServices(services => services.AddSingleton<IFoo, Foo>())
            .UseStartup<Startup>()
            .Build()
            .Run();
    }
}
public class Startup
{
    public IFoo Foo { get; private set; }
    public Startup(IFoo foo)
    {
        this.Foo = foo;
    }    
    public void ConfigureServices(IServiceCollection services)
    {
        // 最常用的服务注册方式
        services.AddTransient<IBar, Bar>();
    }
    
    public void Configure(IApplicationBuilder app, IBar bar)
    {
        app.Run(async context =>
        {
            context.Response.ContentType = "text/html";
            await context.Response.WriteAsync($"IFoo=>{this.Foo}<br/>");
            await context.Response.WriteAsync($"IBar=>{bar}");
        });
    }
}
```

在`Startup`的`Configure`方法中，我们调用`IApplicationBulder`的`Run`方法注册了一个`Middleware`，后者将两个注入的服务的类型作为响应的内容输出。

![依赖服务的注册与注入](https://i.loli.net/2020/02/26/ZFNTHnvIwQJgKuA.jpg)

另外，`WebHostBuilder`在创建`ServiceCollection`之后，会注册一些默认的服务（如`IHostingEnvironment`，`ILoggerFactory`等）。这些服务和我们自行注册的服务并没有任何区别，只要我们知道对应的服务类型，就可以通过注入的方式获取并使用它们。

ASP.Net的一些组件已经提供了一些实例的绑定，像`AddMvc`就是`Mvc Middleware`在 `IServiceCollection`上添加的扩展方法。

```csharp
public static IMvcBuilder AddMvc(this IServiceCollection services)
{
    if (services == null)
    {
        throw new ArgumentNullException(nameof(services));
    }
 
    var builder = services.AddMvcCore();
 
    builder.AddApiExplorer();
    builder.AddAuthorization();
    AddDefaultFrameworkParts(builder.PartManager);
    ...
}
```

## 3. 依赖服务消费

依赖服务之后就可以在需要的位置消费服务了。`DI`的[三种注入方式](di.md#_2-依赖注入方式)，Asp.Net默认仅支持构造器注入方式和面向约定的方法注入(框架级别使用，如`Starup`的`Config`方法)。上面案例中在`Startup`的构造函数和`Config`方法分别体现了两种注入方式。

下面我们来演示在Asp.Net项目中`Startup`之外的位置如何消费`DI`服务。

### 3.1 Controller/PageModel

```csharp
private ILoginService<ApplicationUser> _loginService;
public AccountController(
  ILoginService<ApplicationUser> loginService)
{
  _loginService = loginService;
}
```

我们只要在控制器的构造函数里面声明这个参数，`ServiceProvider`就会把对象注入进来。如果仅在个别`Action`方法使用注入对象，也可以通过`[FromService]`方式注入对象。

```csharp
public async Task Post([FromServices] ILoginService<ApplicationUser> loginService,User user)
{
    loginService.LoginAsync(user);
    // do something
}
```

### 3.2 View

在View中需要用`@inject` 再声明一下，起一个别名。

```html
@using MilkStone.Services;
@model MilkStone.Models.AccountViewModel.LoginViewModel
@inject ILoginService<ApplicationUser>  loginService
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head></head>
<body>
  @loginService.GetUserName()
</body>
</html>
```

### 3.3 HttpContext获取实例

`HttpContext`下有一个`RequestedService`同样可以用来获取实例对象，不过这种方法一般不推荐。同时要注意`GetService<>`这是个范型方法，默认如果没有添加`Microsoft.Extension.DependencyInjection`的`using`，是不用调用这个方法的。

```csharp
HttpContext.RequestServices.GetService<ILoginService<ApplicationUser>>();
```

> 参考文献

* <https://www.cnblogs.com/artech/p/dependency-injection-in-asp-net-core.html>
* <https://www.cnblogs.com/jesse2013/p/di-in-aspnetcore.html>

## 4. Autofac

Asp.Net框架的依赖注入基本可以满足一般的日常使用需求，但如果需要使用依赖注入的以下特性则需要借助更为强大的第三方依赖注入框架，其中最流行也最具代表性的当属[Autofac](https://autofac.org/).

* 基于名称的注入
* 属性注入
* 子容器
* 基于动态代理的AOP

Asp.Net框架的依赖注入核心扩展点是`IServiceProviderFactory<TContainerBuilder>`,第三方依赖注入框架都以此为扩展点。下面我们来快速演示一下Autofac的使用。

程序启动过程中使用Autofac接管依赖注入。

```csharp {3}
public static IHostBuilder CreateHostBuilder(string[] args) =>
    Host.CreateDefaultBuilder(args)
        .UseServiceProviderFactory(new AutofacServiceProviderFactory())
        .ConfigureWebHostDefaults(webBuilder => { webBuilder.UseStartup<Startup>(); })
```

在`Startup`中声明`ConfigureContainer`方法并在此注入所需对象,此方法会在`ConfigureServices`方法执行之后被调用。

```csharp {11,13,14,18,23,25}
public void ConfigureContainer(ContainerBuilder builder)
{
    builder.RegisterInstance(new RedisHelper(Configuration["RedisConnectionString"])).AsSelf();
    builder.Register(c => new DapperHelper<MySqlConnection>(Configuration["MySqlConnectionString"]))
        .AsSelf();
    builder.RegisterType<MapperConfig>().As<IMapperConfiguration>();
    
    // 程序集扫描注入
    builder.RegisterAssemblyTypes(Assembly.Load(Configuration["DataAccessImplementAssembly"]))
        // 仅注入公有类型
        .PublicOnly()
        // 仅注入 未标记 ExcludeAutofacInjectionAttribute 的类型
        .Where(t => !t.IsDefined(typeof(ExcludeAutofacInjectionAttribute)))
        .AsImplementedInterfaces();

    // 基于Key注入
    builder.RegisterType<Dog>().Keyed<IPet>("Dog");
    builder.RegisterType<Cat>().Keyed<IPet>("Cat");

    // 属性注入
    builder.RegisterType<PetStore>().As<IPetStore>()
        // 启用 Attribute 过滤
        .WithAttributeFiltering()
        // 启用属性将被注入
        .PropertiesAutowired();
}

[AttributeUsage(AttributeTargets.Class)]
public class ExcludeAutofacInjectionAttribute : Attribute
{
}
```

基于名称注入的对象可以通过`Autofac.Features.Indexed.IIndex<K,V>`获取。

```csharp {3-7}
public class PetStore : IPetStore
{
  public PetStore(IIndex<string, IPet> pets) 
  { 
      var dog = pets["Dog"];
      var cat = pets["Cat"];
  }
}
```

在`Configure`方法中获取Autofac注入对象。

```csharp {3-6}
public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    var autofacContainer = app.ApplicationServices.GetAutofacRoot();
    var redis = autofacContainer.Resolve<RedisHelper>();
    // 获取命名注入对象
    var dog = autofacContainer.ResolveNamed<IPet>("Dog");

    app.UseRouting();
    app.UseEndpoints(endpoints => { endpoints.MapControllers(); });
}
```

在.Net Worker Service中可以通过如下方式使用`Autofac`接管`DI`和注册服务。

```csharp{3,5}
public static IHostBuilder CreateHostBuilder(string[] args) =>
    Host.CreateDefaultBuilder(args)
        .UseServiceProviderFactory(new AutofacServiceProviderFactory())
        .ConfigureServices((hostContext, services) =>services.AddHostedService<Worker>())
        .ConfigureContainer<ContainerBuilder>((context, builder) => builder.RegisterType<Dog>().As<IPet>());
```
