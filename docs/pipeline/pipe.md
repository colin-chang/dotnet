# 管道式请求处理
 
Asp.Net Core不仅是一个开发框架，而是一个Web开发平台。这是因为它有一个极具扩展能力的请求处理管道，我们可以通过对这个管道的定制满足各种场景下的HTTP处理需求。Asp.Net Core应用的很多特性（如路由、会话、缓存、认证、授权等）都是通过对管道的定制来实现的。开发者也可以通过管道定制创建自己的Web框架。

HTTP协议自身的特性决定了任何一个Web应用的工作模式都是监听、接收并处理HTTP请求，并且最终对请求予以响应。HTTP请求处理是管道式设计典型的应用场景：可以根据具体的需求构建一个管道，接收的HTTP请求像水一样流入这个管道，组成这个管道的各个环节依次对其做相应的处理。

## 1. 承载体系
ASP.NET Core 框架目前存在两个承载（`Hosting`）系统。ASP.NET Core 最初提供了一个以`IWebHostBuilder/IWebHost`为核心的承载系统，用于承载以服务器和中间件管道构建的Web应用。ASP.NETCore 3依然支持这样的应用承载方式，此“过时”的承载方式我们不做过多介绍。

![IWebHostBuilder/IWebHost](https://i.loli.net/2021/03/25/GHofVzwhRcsxUu4.jpg)

除了承载Web应用本身，我们还有针对后台服务的承载需求，为此微软推出了以`IHostBuilder/IHost`为核心的承载系统。因为Web应用本身就是一个长时间运行的后台服务，我们完全可以定义一个承载服务，从而将 Web应用承载于这个系统中。这个用来承载 ASP.NET Core 应用的承载服务类型为`GenericWebHostService`，这是一个实现了`IHostedService`接口的内部类型。

![IHotBuilder/IHost](https://i.loli.net/2021/03/25/NiTJDv4aFSbcBx7.jpg)

即使采用基于`IHostBuilder/IHost`的承载系统，我们依然会使用`IWebHostBuilder`接口。虽然我们不再使用`IWebHostBuilder`的宿主构建功能，但是定义在`IWebHostBuilder`上的其他 API都是可以使用的。对`IWebHostBuilder`接口的复用导致很多功能都具有两种编程方式，虽然这样可以最大限度地复用和兼容定义在`IWebHostBuilder`接口上众多的应用编程接口,但代价是使类型变得混乱。

## 2. 请求处理管道
Asp.Net Core Web应用使用的SDK是`Microsoft.NET.Sdk.Web`,它会自动将常用的依赖或者引用添加进来，所以不需要在项目文件中显式添加针对`Microsoft.AspNetCore.App`的框架引用。

```csharp
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder =>
            builder.Configure(app =>
                app.Run(context =>
                    context.Response.WriteAsync("Hello world"))))
        .Build()
        .Run();
}
```
在调用`Host`类型的静态方法`CreateDefaultBuilder`创建了一个`IHostBuilder`对象之后，我们调用它的`ConfigureWebHostDefaults`方法对ASP.NET Core应用的请求处理管道进行定制。**HTTP请求处理流程始于对请求的监听与接收，终于对请求的响应，这两项工作均由同一个对象来完成，我们称之为服务器（`Server`）。ASP.NET Core请求处理管道必须有一个服务器，它是整个管道的“龙头”**。在演示程序中，我们调用`IWebHostBuilder`接口的`UseKestrel`扩展方法(框架调用)为后续构建的管道注册了一个名为`KestrelServer`的服务器。

当承载服务`GenericWebHostService`被启动之后，定制的请求处理管道会被构建出来，管道的服务器随后会绑定到一个预设的端口（如`KestrelServer`默认采用5000作为监听端口）开始监听请求。HTTP 请求一旦抵达，服务器会将其标准化，并分发给管道后续的节点，我们将位于服务器之后的节点称为中间件（`Middleware`）。

每个中间件都具有各自独立的功能，如专门实现路由功能的中间件、专门实施用户认证和授权的中间件。所谓的管道定制主要体现在根据具体需求选择对应的中间件来构建最终的管道。在演示程序中，我们调用 `IWebHostBuilder`接口的`Configure`方法注册了一个中间件，用于响应“Hello World”字符串。

![请求管道](https://i.loli.net/2021/03/25/xtojq65BC2hvypN.jpg)

开发框架本身就是通过某一个或者多个中间件构建起来的。以ASP.NET Core MVC开发框架为例，它借助“路由”中间件实现了请求与`Action`之间的映射，并在此基础之上实现了激活（`Controller`）、执行（`Action`）及呈现（`View`）等一系列功能。

## 3. 中间件

ASP.NET Core 的请求处理管道由一个服务器和一组中间件组成，位于“龙头”的服务器负责请求的监听、接收、分发和最终的响应，而针对该请求的处理则由后续的中间件来完成。

中间件是一种装配到应用管道以处理请求和响应的软件。中间件具有以下作用：
* 可在管道中的下一个组件前后执行工作
* 选择是否将请求传递到管道中的下一个组件

### 3.1 基础类型
#### 3.1.1 RequestDelegate
从概念上可以将请求处理管道理解为“请求消息”和“响应消息”流通的管道，服务器将接收的请求消息从一端流入管道并由相应的中间件进行处理，生成的响应消息反向流入管道，经过相应中间件处理后由服务器分发给请求者。但从实现的角度来讲，管道中流通的并不是所谓的请求消息与响应消息，而是一个针对当前请求创建的上下文。这个上下文被抽象成如下这个`HttpContext`类型，我们利用`HttpContext`不仅可以获取针对当前请求的所有信息，还可以直接完成针对当前请求的所有响应工作。

```csharp
public abstract class HttpContext
{
    public abstract HttpRequest Request { get; }
    public abstract HttpResponse Response { get; }
}
```

既然流入管道的只有一个共享的`HttpContext`上下文，那么一个`Func`＜HttpContext，Task＞`对象就可以表示处理`HttpContext`的操作，或者用于处理HTTP请求的处理器。由于这个委托对象非常重要，所以ASP.NET Core专门定义了如下这个名为RequestDelegate的委托类型。

```csharp
public delegate Task RequestDelegate(HttpContext context);
```

#### 3.1.2 Func＜RequestDelegate,RequestDelegate＞
实际上，组成请求处理管道的中间件可以表示为一个类型为`Func＜RequestDelegate，Request Delegate＞`的委托对象。表示中间件的`Func＜RequestDelegate，RequestDelegate＞`对象的输出依然是一个`RequestDelegate`对象，该对象表示将当前中间件与后续管道进行“对接”之后构成的新管道。

既然原始的中间件是通过一个`Func＜RequestDelegate，RequestDelegate＞`对象表示的，就可以直接注册这样一个对象作为中间件。中间件的注册可以通过调用`IWebHostBuilder`接口的`Configure`扩展方法来完成，该方法的参数是一个`Action＜IApplicationBuilder＞`类型的委托对象，可以通过调用`IApplicationBuilder`接口的`Use`方法将表示中间件的 `Func＜RequestDelegate，RequestDelegate＞`对象添加到当前中间件链条上。

```csharp{3-7,9-10,13-16}
public static void Main(string[] args)
{
    Func<RequestDelegate, RequestDelegate> middleware1 = next => async context =>
    {
        await context.Response.WriteAsync("Hello ");
        await next(context);
    };

    RequestDelegate middleware2 = async context =>
        await context.Response.WriteAsync("World");

    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder =>
            builder.Configure(app => app
                .Use(middleware1)
                .Run(middleware2)))
        .Build()
        .Run();
}
```

请求管道中的每个中间件组件负责调用管道中的下一个组件，或使管道短路。当中间件短路时，它被称为“终端中间件”。ASP.NET Core 请求管道包含一系列请求委托，依次调用。下图演示了这一概念。沿黑色箭头执行。

![中间件管道](https://i.loli.net/2020/08/25/61lCiIjHZOXLEpF.jpg)

#### 3.1.3 注册中间件
我们通常使用`IApplicationBuilder`接口的`Run/Map/Use`等扩展方法来注册中间件。

#### Use
用`Use`将多个请求委托链接在一起。`next`参数表示管道中的下一个委托。 可通过不调用`next`参数使管道短路，短路可以避免不必要的工作，节省系统开支。例如，静态文件中间件可以处理对静态文件的请求，并让管道的其余部分短路，从而起到终端中间件的作用。

```csharp {3-8}
public void Configure(IApplicationBuilder app)
{
    app.Use(async (context, next) =>
    {
        // Do work that doesn't write to the Response.
        await next.Invoke();
        // Do logging or other work that doesn't write to the Response.
    });
}
```

**需要特别注意的是，在向客户端发送响应(`Response`)后请勿继续调用`next.Invoke`，响应启动后，针对`HttpResponse`的更改将引发异常。可以通过`Response.HasStarted`判断是否已发送标头或已写入正文。**

#### Run
**`Run`委托不会收到`next`参数,第一个`Run`委托即为终端中间件，用于终止管道**。
```csharp {3-6}
public void Configure(IApplicationBuilder app)
{
    app.Run(async context =>
    {
        await context.Response.WriteAsync("Hello from 2nd delegate.");
    });
}
```

中间件执行顺序是很重要的，每个委托均可在下一个委托执行前后执行操作处理单词请求共享的`HttpContext`对象，应尽早在管道中调用异常处理委托，这样它们就能捕获在管道的后期阶段发生的异常。

下图显示了Asp.Net Core MVC应用的完整请求处理管道，了解现有中间件的顺序，以及在哪里添加自定义中间件就可以完全控制如何重新排列现有中间件，或根据场景需要注入新的自定义中间件。
![中间件管道](https://i.loli.net/2020/08/25/DzoOs1HynUFhVYq.jpg)

向`Startup.Configure`方法添加中间件组件的顺序定义了针对请求调用这些组件的顺序，以及响应的相反顺序。 此顺序对于安全性、性能和功能至关重要。

#### Map
**`Map`扩展用作约定来创建管道分支，`Map`基于给定请求路径的匹配项来创建请求管道分支。 如果请求路径以给定路径开头，则执行分支**。
```csharp{3-4,7-8}
public void Configure(IApplicationBuilder app)
{
    app.Map("/map1", builder => builder.Run(async context => await context.Response.WriteAsync("Map Test 1")));
    app.Map("/map2", builder => builder.Run(async context => await context.Response.WriteAsync("Map Test 2")));

    // 当请求表单中存在 bigfile 字段时，启用自定义Form
    app.MapWhen(context => context.Request.Form.ContainsKey("bigfile"),
                builder => builder.Use(async (con, next) => con.Request.Form = new FormCollection(null, null)));

    app.Run(async context =>
    {
        await context.Response.WriteAsync("Hello from non-Map delegate. <p>");
    });
}
```

### 3.2 自定义中间件
虽然可以直接采用原始的`Func＜RequestDelegate，RequestDelegate＞`对象来定义中间件，但是在大部分情况下，我们依然倾向于将自定义的中间件定义成一个具体的类型。至于中间件类型的定义，ASP.NET Core提供了如下两种不同的形式可供选择。

* 强类型定义：自定义的中间件类型显式实现预定义的`IMiddleware`接口，并在实现的方法中完成针对请求的处理。
* 基于约定的定义：不需要实现任何接口或者继承某个基类，只需要按照预定义的约定来定义中间件类型。

**强类型方式定义的中间件可以注册为任意生命周期模式的服务，但是按照约定定义的中间件则总是一个Singleton服务。**
  
#### 3.2.1 强类型中间件
```csharp
 public interface IMiddleware
{
    Task InvokeAsync(HttpContext context, RequestDelegate next);
}
```
采用强类型的中间件类型定义方式，只需要实现如下这个`IMiddleware`接口，该接口定义了唯一的`InvokeAsync`方法，用于实现中间件针对请求的处理。

```csharp{4,6,10-14}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureServices(services => services.AddSingleton(new HelloMiddleware()))
        .ConfigureWebHostDefaults(builder =>
            builder.Configure(app => app.UseMiddleware<HelloMiddleware>()))
        .Build()
        .Run();
}
public sealed class HelloMiddleware : IMiddleware
{
    public Task InvokeAsync(HttpContext context, RequestDelegate next) =>
        context.Response.WriteAsync("Hello world");
}
```

#### 3.2.2 约定中间件
可能我们已经习惯了通过实现某个接口或者继承某个抽象类的扩展方式，但是这种方式有时显得约束过重，不够灵活，所以可以采用另一种基于约定的中间件类型定义方式。这种定义方式比较自由，因为它并不需要实现某个预定义的接口或者继承某个基类，而只需要遵循一些约定即可。自定义中间件类型的约定主要体现在如下几个方面。

* 中间件类型需要有一个有效的公共实例构造函数，该构造函数要求必须包含一个`RequestDelegate` 类型的参数，当前中间件利用这个委托对象实现针对后续中间件的请求分发。构造函数不仅可以包含任意其他参数，对于`RequestDelegate`参数出现的位置也不做任何约束。
* 针对请求的处理实现在返回类型为 `Task`的 `InvokeAsync`方法或者 `Invoke`方法中，它们的**第一个参数表示当前请求上下文的 `HttpContext` 对象**。对于后续的参数，虽然约定并未对此做限制，但是由于这些参数最终由依赖注入框架提供，所以相应的服务注册必须存在。

```csharp{5,10-26}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder =>
            builder.Configure(app => app.UseMiddleware<HelloMiddleware>(false)))
        .Build()
        .Run();
}

public sealed class HelloMiddleware
{
    private readonly RequestDelegate _next;
    private readonly bool _foreward2Next;

    public HelloMiddleware(RequestDelegate next, bool foreward2Next = true)
    {
        _next = next;
        _foreward2Next = foreward2Next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        await context.Response.WriteAsync("Hello world");
        if (_foreward2Next) await _next(context);
    }
}
```