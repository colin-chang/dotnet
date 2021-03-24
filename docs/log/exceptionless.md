# Exceptionless

## 1. 简介
Exceptionless 是一个免费开源分布式系统日志收集框架，它可以应用在基于 ASP.NET，ASP.NET Core，Web Api，Web Forms，WPF，Console，MVC 等技术栈的应用程序中，并且提供了Rest接口可以应用在 Javascript，Node.js 中。它将日志收集变得简单易用并且不需要了解太多的相关技术细节及配置。

在以前，我们做日志收集大多使用 Log4net，Nlog 等框架，在应用程序变得复杂并且集群的时候，可能传统的方式已经不是很好的适用了，因为收集各个日志并且分析他们将变得麻烦而且浪费时间。

现在Exceptionless团队给我们提供了一个更好的框架来做这件事情，我认为这是非常伟大并且有意义的，感谢他们。

官网：http://exceptionless.com/
GitHub：https://github.com/exceptionless/Exceptionless

两种使用方式 :
1. 官网创建帐号，并新建应用程序以及项目，然后生成apikey（数据存储在Exceptionless）
2. 自己搭建Exceptionless的环境，部署在本地（数据存储在本地）

## 2. 简单使用
#### 1) 注册账号
首先，需要去官网注册一个帐号（打不开的同学你懂的），注册完成之后登录系统。
![注册账号](https://i.loli.net/2020/02/25/UWvlZmKobYrIVgh.png)

#### 2) 新建项目
按照提示，添加一个项目。

![新建项目](https://i.loli.net/2020/02/25/eQkFhyVWdrwlMHb.png)

选择项目的类型，可以看到 Exceptionless支持很多种项目。我们来选择一个 ASP.NET Core 的项目。

![选择项目类型](https://i.loli.net/2020/02/25/NwtLR8HKBZ1gcQS.png)

完成后可以看到一个详细步骤说明如何在项目中集成。

![nuget](https://i.loli.net/2020/02/25/hD1c2lbYJK4wRqz.png)

#### 3) 项目集成
* 首先，使用 NuGet 添加一个包，名字叫`Exceptionless.AspNetCore`。
* 在 ASP.NET Core 项目中，打开`startup.cs`文件，找到`Configure()`方法，添加如下：
    ```csharp
    using Exceptionless;
    ......

    public void Configure(IApplicationBuilder app, IHostingEnvironment env, ILoggerFactory loggerFactory)
    {
        // xxxxx 处填写上图画红线部分的key
        app.UseExceptionless("xxxxxxxxxxxxxxxxxxxxxxxxxx");

        app.UseMvc();
    }
    ```

至此，Exceptionless 已经可以在你的项目中工作了，它会自动记录项目中的异常情况。

#### 4) 查看异常
创建一个 ASP.NET Core 项目，然后通过下面方式直接抛出一个异常，下面我们来运行一下，看看它是怎么工作的吧。
```csharp
public IActionResult About() 
{
    throw new Exception("test exception");
    return View();
}
```
接下来，刷新 Exceptionless的页面，在 Dashboard 主面板中，可以看到关于整个项目的一个异常情况，并且分别以几种方式列了出来，其中包括分布图，最频繁的异常，最近的异常等等。

![Exceptionless控制台](https://i.loli.net/2020/02/25/UuIVhtvCGTesZnq.png)

这个我们刚才在Abount Action中制造的一个异常，Exceptionless已经记录了下来，点进去之后可以看一下详情。

![异常总揽](https://i.loli.net/2020/02/25/QukSHIMOJYn3AVy.png)
![异常详情](https://i.loli.net/2020/02/25/JZGabQRoCNv4zqn.png)

除了一些基本的异常类型、时间和堆栈外，Request和Enviroment中还包括访问者的坐标、IP地址、发生异常的URL地址、浏览器信息，操作系统、甚至发生异常时请求的Cookie值。

## 3. 进阶使用
### 3.1 发送事件
除了我们所熟悉的异常信息外，Exceptionless 还可以记录很多种类的其他信息，这些信息统称做事件(Event)。

在Exceptionless 中，有这几类事件： Log （日志）、Feature Usages（功能用途）、404、Custom Event（自定义事件）。

Exceptionless 中发送不同类型事件很简单，代码如下：
``` csharp
using Exceptionless;

// 发送日志
ExceptionlessClient.Default.SubmitLog("Logging made easy");

// 你可以指定日志来源，和日志级别。
// 日志级别有这几种: Trace, Debug, Info, Warn, Error
ExceptionlessClient.Default.SubmitLog(typeof(Program).FullName, "This is so easy", "Info");
ExceptionlessClient.Default.CreateLog(typeof(Program).FullName, "This is so easy", "Info").AddTags("Exceptionless").Submit();

// 发送 Feature Usages
ExceptionlessClient.Default.SubmitFeatureUsage("MyFeature");
ExceptionlessClient.Default.CreateFeatureUsage("MyFeature").AddTags("Exceptionless").Submit();

// 发送一个 404
ExceptionlessClient.Default.SubmitNotFound("/somepage");
ExceptionlessClient.Default.CreateNotFound("/somepage").AddTags("Exceptionless").Submit();

// 发生一个自定义事件
ExceptionlessClient.Default.SubmitEvent(new Event { Message = "Low Fuel", Type = "racecar", Source = "Fuel System" });
```

### 3.2 手动发送异常
有时候，我们在程序代码中显式的处理一些异常，这个时候可以手动的来将一些异常信息发送到Exceptionless。
```csharp
try 
{
    throw new ApplicationException(Guid.NewGuid().ToString());
} 
catch (Exception ex)
{
    ex.ToExceptionless().Submit();
}
```
### 3.3 附加标记
当然你还可以为发送的事件添加额外的标记信息，比如坐标，标签，以及其他的用户相关的信息等。
```csharp
try 
{
    throw new ApplicationException("Unable to create order from quote.");
} 
catch (Exception ex) 
{
    ex.ToExceptionless()
        // 为事件设定一个编号，以便于你搜索 
        .SetReferenceId(Guid.NewGuid().ToString("N"))
        // 添加一个不包含CreditCardNumber属性的对象信息
        .AddObject(order, "Order", excludedPropertyNames: new [] { "CreditCardNumber" }, maxDepth: 2)
        // 设置一个名为"Quote"的编号
        .SetProperty("Quote", 123)
        // 添加一个名为“Order”的标签
        .AddTags("Order")
        // 标记为关键异常
        .MarkAsCritical()
        // 设置一个地理位置坐标
        .SetGeo(43.595089, -88.444602)
        // 设置触发异常的用户信息
        .SetUserIdentity(user.Id, user.FullName)
        // 设置触发用户的一些描述
        .SetUserDescription(user.EmailAddress, "I tried creating an order from my saved quote.")
        // 发送事件
        .Submit();
}
```

### 3.4 统一处理发送的事件

可以在通过SubmittingEvent 事件设置全局的忽略异常信息添加一些自定义信息等。
```csharp

#region Exceptionless配置
    ExceptionlessClient.Default.Configuration.ApiKey = exceptionlessOptions.Value.ApiKey;
    ExceptionlessClient.Default.Configuration.ServerUrl = exceptionlessOptions.Value.ServerUrl;
    ExceptionlessClient.Default.SubmittingEvent += OnSubmittingEvent;
    app.UseExceptionless();
#endregion

 /// <summary>
/// 全局配置Exceptionless
/// </summary>
/// <param name="sender"></param>
/// <param name="e"></param>
private void OnSubmittingEvent(object sender, EventSubmittingEventArgs e)
{
    // 只处理未处理的异常
    if (!e.IsUnhandledError)
        return;

    // 忽略404错误
    if (e.Event.IsNotFound())
    {
        e.Cancel = true;
        return;
    }

    // 忽略没有错误体的错误
    var error = e.Event.GetError();
    if (error == null)
        return;
    // 忽略 401 (Unauthorized) 和 请求验证的错误.
    if (error.Code == "401" || error.Type == "System.Web.HttpRequestValidationException")
    {
        e.Cancel = true;
        return;
    }
    // Ignore any exceptions that were not thrown by our code.
    var handledNamespaces = new List<string> { "Exceptionless" };
    if (!error.StackTrace.Select(s => s.DeclaringNamespace).Distinct().Any(ns => handledNamespaces.Any(ns.Contains)))
    {
        e.Cancel = true;
        return;
    }
    // 添加附加信息.
    //e.Event.AddObject(order, "Order", excludedPropertyNames: new[] { "CreditCardNumber" }, maxDepth: 2);
    e.Event.Tags.Add("MunicipalPublicCenter.BusinessApi");
    e.Event.MarkAsCritical();
    //e.Event.SetUserIdentity();
}
```

### 3.5 配合使用 NLog 或 Log4Net
配合使用 NLog 或 Log4Net
有时候，程序中需要对日志信息做非常详细的记录，比如在开发阶段。这个时候可以配合 log4net 或者 nlog 来联合使用 exceptionless，详细可以查看这个官方的 [示例][https://github.com/exceptionless/Exceptionless.Net/tree/master/samples/Exceptionless.SampleConsole]。

如果你的程序中有在短时间内生成大量日志的情况，比如一分钟产生上千的日志。这个时候你需要使用内存存储（in-memory store）事件，这样客户端就不会将事件系列化的磁盘，所以会快很多。这样就可以使用Log4net 或者 Nlog来将一些事件存储到磁盘，另外 Exceptionless 事件存储到内存当中。
```csharp
using Exceptionless;
ExceptionlessClient.Default.Configuration.UseInMemoryStorage();
```

## 4. 异常日志模块封装
下面是实际项目(Asp.Net Core)中使用Exceptionless异常日志模块的简单封装。

简单说明下。在项目中许多可以预料的异常，如文件IO，网络请求等，这些异常我们一般都会通过`try...catch...`方式捕获，由于此类异常属于预料中异常，我们只记录日志(Exceptionless Log)即可。对于程序中出现的未处理异常则属于预料之外的错误，比如编写代码时的逻辑错误等，此类异常我们通过全局异常过滤器捕捉到并发送到Exceptionless的异常中。

其异常严重程度链如下：

`TraceLog/OtherLog < DebugLog < InfoLog < WarnLog < ErrorLog < FatalLog < Exception`

### 4.1 异常日志模块
```csharp
using System;
using Exceptionless;
using Exceptionless.Logging;

public static class ExceptionlessUtil
{
    public static void Trace(string message)
    {
        Trace(new Exception(message));
    }

    public static void Trace(Exception ex, string title = null, bool traceException = false)
    {
        TraceLog(ex, LogLevel.Trace, title, traceException);
    }

    public static void Debug(string message)
    {
        Debug(new Exception(message));
    }

    public static void Debug(Exception ex, string title = null, bool traceException = false)
    {
        TraceLog(ex, LogLevel.Debug, title, traceException);
    }

    public static void Info(string message)
    {
        Info(new Exception(message));
    }

    public static void Info(Exception ex, string title = null, bool traceException = false)
    {
        TraceLog(ex, LogLevel.Info, title, traceException);
    }

    public static void Warn(string message)
    {
        Warn(new Exception(message));
    }

    public static void Warn(Exception ex, string title = null, bool traceException = false)
    {
        TraceLog(ex, LogLevel.Warn, title, traceException);
    }

    public static void Error(string message)
    {
        Error(new Exception(message));
    }

    public static void Error(Exception ex, string title = null, bool traceException = false)
    {
        TraceLog(ex, LogLevel.Error, title, traceException);
    }

    public static void Fatal(string message)
    {
        Fatal(new Exception(message));
    }

    public static void Fatal(Exception ex, string title = null, bool traceException = false)
    {
        TraceLog(ex, LogLevel.Fatal, title, traceException);
    }

    public static void Other(string message)
    {
        Other(new Exception(message));
    }

    public static void Other(Exception ex, string title = null, bool traceException = false)
    {
        TraceLog(ex, LogLevel.Other, title, traceException);
    }


    /// <summary>
    /// 记录Log
    /// </summary>
    /// <param name="ex">异常</param>
    /// <param name="logLevel">日志级别</param>
    /// <param name="traceException">是否追踪异常。true则提交Exception,否则只提交Log</param>
    public static void TraceLog(Exception ex, LogLevel logLevel, string title = null, bool traceException = false)
    {
        ExceptionlessClient.Default.CreateLog(ex.TargetSite.GetType().FullName,
                string.IsNullOrWhiteSpace(title) ? string.Empty : $"{title},错误消息:" + ex.Message, logLevel)
            .AddTags(ex.GetType().FullName).Submit();

        if (traceException)
            TraceException(ex);
    }

    /// <summary>
    /// 追踪Exception
    /// </summary>
    /// <param name="ex"></param>
    public static void TraceException(Exception ex)
    {
        ex.ToExceptionless().Submit();
    }
}
```

### 4.2 异常日志记录
##### 1) 异常过滤
```csharp 

/// <summary>
/// 全局异常过滤器
/// </summary>
public class GlobalExceptionFilter:IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        //提交异常信息
        ExceptionlessUtil.TraceException(context.Exception);

        //转到错误页面
        context.Result = new RedirectResult("/error");
        context.HttpContext.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
        
        //标记已处理
        context.ExceptionHandled = true;
    }
}

// Startup.cs的ConfigureServices中注册filter
services.AddMvc(options => options.Filters.Add<GlobalExceptionFilter>())
```

此项目采用Asp.Net Core技术栈，引用的Exceptionless包为`Exceptionless.AspNetCore`,UnhandledException通过对filter进行处理。其他类型的项目可以引用对应的nuget包，作相应的UnhandledException处理即可。

##### 2) 日记记录
```csharp
private async Task<string> RequestAsync(string url, object parameter, string method)
{
    try
    {
        // 执行网络请求
        ...
    }
    catch (Exception ex)
    {
        ExceptionlessUtil.Warn(ex, $"网络请求出错{url}");
        return null;
    }
}
```

## 5. 本地部署
如果不想使用Exceptionless官网提供服务，也可以在本地部署服务器。部署步骤参考 https://github.com/exceptionless/Exceptionless/wiki/Self-Hosting

> Exceptionless 官方文档 https://github.com/exceptionless/Exceptionless/wiki/Getting-Started