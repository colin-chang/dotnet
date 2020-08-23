# 日志管理


.NET Core 支持适用于各种内置和第三方日志记录提供程序的日志记录 API,并统一了日志操作接口`ILogger`,同时默认提供了基础日志的Provider。


## 1. 日志框架
下面我们来快速简单的演示最基础的日志框架的使用。
```csharp {11-15,18-20}
static void Main(string[] args)
{
    //配置框架注入
    var configBuilder = new ConfigurationBuilder();
    configBuilder.AddJsonFile("appsettings.json");
    var config = configBuilder.Build();
    var services = new ServiceCollection();
    services.AddSingleton<IConfiguration>(p => config); //工厂模式确保配置受到DI容器管理

    //日志框架注入
    services.AddLogging(builder =>
    {
        builder.AddConfiguration(config.GetSection("Logging")); //注入日志配置
        builder.AddConsole(); //日志输出到控制台
    });

    var provider = services.BuildServiceProvider();
    var loggerFactory = provider.GetService<ILoggerFactory>(); //获取日志工厂
    var logger = loggerFactory.CreateLogger("ColinLogger"); //创建日志记录器
    logger.LogWarning("log something {time}", DateTime.Now); //记录警告日志
    // logger.LogWarning($"log something {DateTime.Now}");

    Console.ReadKey();
}
```
上面代码中第20行和21行功能相同，但第20行使用模板方式，会在真正需要记录日志时才进行字符串拼接，而21行则先进行字符串拼接而后再记录日志。当调整日志输出级别(如Critical)而导致部分级别(如Debug)日志不输出时，第二种方式的字符串拼接就变得没有意义了，而且大量字符串拼接可能会造成一定程度的资源开销，所以建议大家使用第一种方式拼接日志内容。

实际开发中我们鲜少使用`ILoggerFactory`来创建`ILogger`对象，更多的会通过以下方式从容器中获取`ILogger<T>`对象，其名称为`Logging+Namespace+ClassName`.
```csharp{3-7,11}
public class HomeController : ControllerBase
{
    private ILogger _logger;
    public HomeController(ILogger<HomeController> logger)
    {
        _logger = logger;
    }

    public IActionResult Index()
    {
        _logger.LogDebug("日志记录测试内容");
        return View();
    }
}
```

Asp.Net Core服务器构建之前的`CreateDefaultBuilder`中配置了默认的日志服务。我们可以在不做任何配置的情况下直接DI使用默认的日志服务,日志可以在控制台，VS调试窗口和事件查看器中查看到输出入的日志。

![默认日志配置](https://i.loli.net/2020/02/26/XKQsZ2i6z7CTI5x.jpg)

更详细的日志使用请参见[官方文档](https://docs.microsoft.com/zh-cn/aspnet/core/fundamentals/logging/?view=aspnetcore-2.2)

## 2. 日志级别过滤
日志级别在不同平台中大抵相同，.NET Core通过`Microsoft.Extensions.Logging.LogLevel`枚举定义了以下日志级别：
* Trace
* Debug
* Information
* Warning
* Error
* Critical
* None

我们可以通过日志记录器名称为其设置对应日志记录级别。
```json {6}
"Logging": {
    "LogLevel": {
        "Default": "Debug",
        "System": "Information",
        "Microsoft": "Information",
        "ColinLogger": "Warning"
    }
}
```

## 3. 日志作用域
在应用程序实际运行过程中往往存在大量的日志，我们可以通过日志作用域来区分不同范围的日志，日志作用于常用于解决以下场景的问题：
* 单次事务中包含批量多条操作日志
* 复杂流程的日志关联
* 调用链追踪与请求处理过程对应

```json{9}
"Logging": {
    "LogLevel": {
        "Default": "Debug",
        "System": "Information",
        "Microsoft": "Information",
        "ColinLogger": "Warning"
    },
    "Console": {
        "IncludeScopes": true
    }
}
```

```csharp{2}
var logger= provider.GetService<ILogger<Program>>();
using (logger.BeginScope("ScopeId:{id}", Guid.NewGuid()))
{
    logger.LogError("scope error");
    logger.LogCritical("scope critical");
}
```
以上输出结果形如：
```
fail: ConfigurationDemo.Program[0]
      => ScopeId:ac024a80-6db8-4306-9510-d6db3aa033e1
      scope error
crit: ConfigurationDemo.Program[0]
      => ScopeId:ac024a80-6db8-4306-9510-d6db3aa033e1
      scope critical
```


在Asp.Net Core中我们可以把一次Web请求设定为一个作用域记录其日志，同个作用域中的日志会带有相同的作用域标识前缀。
```csharp
public void Get([FromServices] ILogger<TestController> logger)
{
    logger.LogWarning("log warning");
    logger.LogError("log error");
}
```
其输出日中中包含每次Web Request的基本信息，形如：
```
warn: WebDemo.Controllers.TestController[0]
      => ConnectionId:0HM27GQCJTIDM => RequestPath:/test RequestId:0HM27GQCJTIDM:00000001, SpanId:|fb5ff22-48b5a8efba5ca8b4., TraceId:fb5ff22-48b5a8efba5ca8b4, ParentId: => WebDemo.Controllers.TestController.Get (WebDemo)
      log warning
fail: WebDemo.Controllers.TestController[0]
      => ConnectionId:0HM27GQCJTIDM => RequestPath:/test RequestId:0HM27GQCJTIDM:00000001, SpanId:|fb5ff22-48b5a8efba5ca8b4., TraceId:fb5ff22-48b5a8efba5ca8b4, ParentId: => WebDemo.Controllers.TestController.Get (WebDemo)
      log error
```


## 4. 第三方日志组件
Asp.Net Core默认的日志提供程序并没有提供写文件、数据库、邮件等功能，我们可以使用第三方日志提供程序完成,如[Nlog](https://nlog-project.org/)。配置步骤非常简单，按[官方文档](https://github.com/NLog/NLog.Web/wiki/Getting-started-with-ASP.NET-Core-2)进行即可。

由于实现了统一的日志接口，替换不同的日志提供程序后，使用日志组件记录日志的代码无需修改，这也体现了面向接口多态编程的好处。

除了前面提到的日志组件，在大型分布式应用或微服务中就需要将分布式应用中分散各处的日志进行统一整理归类，这就需要分布式日志管理，如经典的日志组件 [ELK](https://ccstudio.org/architecture/log/elk.html)(跨平台)，.Net Core 日志组件 [Exceptionless](https://ccstudio.org/architecture/log/exceptionless.html)(依赖Windows平台)。