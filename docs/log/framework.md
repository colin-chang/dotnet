# 日志框架

.NET中有四种典型的诊断日志框架。其写入日志的对象分别为`Debugger/TraceSource/EventSource/DiagnosticSource`，所以我们通常分别称之为调试日志、跟踪日志、事件日志和诊断日志。

除了微软提供的日志框架，还有很多流行的第三方日志框架，如`Log4Net/NLog/Serilog`等。虽然大多日志框架都采用观察者模式设计，但各自的编程模式具有很大的差异，造成使用体验不一致。于是.NET定义了一套日志框架提供统一的日志编程模型。

## 1. 日志对象
一般来说，写入的每条日志消息总是针对某个具体的事件（`Event`），所以每条日志消息（`Log Entry`或者`Log Message`）都有一个标识事件的ID。日志事件本身的重要程度或者反映的问题严重性不尽相同，这一点则通过日志消息的等级来标识，英文的“日志等级”可以表示成`Log Level/Log Verbosity Level/Log SeverityLevel`等。日志事件ID和日志等级可以通过如下所示的两个类型来表示。
```csharp
public readonly struct EventId
{
    public int Id { get; }
    public string? Name { get; }
    public EventId(int id, string? name = null)
    public override string ToString()
    ...
}

public enum LogLevel
{
    Trace = 0,
    Debug = 1,
    Information = 2,
    Warning = 3,
    Error = 4,
    Critical = 5,
    None = 6,
}
```
表示`EventId`的结构体分别通过只读属性`Id`和`Name`表示事件的ID（必需）与名称（可选）。`EventId`重写了`ToString`方法，如果表示事件名称的`Name`属性存在，那么该方法会将事件名称作为返回值，否则这个方法会返回其`Id`属性。从上面提供的代码片段还可以看出，`EventId`定义了针对整型的隐式转化器，所以任何涉及使用`EventId`的地方都可以直接用表示事件ID的整数来替换。

如果忽略选项`None`，枚举`LogLevel` 实际上定义了6种日志等级，枚举成员的顺序体现了等级的高低，`Trace`最低，`Critical`最高。以下给出了这6种日志等级的事件描述，我们可以在发送日志事件时根据它来决定当前日志消息应该采用何种等级。

日志等级|事件描述
:-|:-
`Trace`|用于记录一些相对详细的消息，以辅助开发人员针对某个问题进行代码跟踪调试。由于这样的日志消息往往包含一些相对敏感的信息，所以在默认情况下不应该开启此等级
`Debug`|用于记录一些辅助调试的日志，这样的日志内容往往具有较短的时效性，如记录针对某个方法的调用及其返回值
`Information`|向管理员传达非关键信息，类似于“供您参考”之类的注释。这样的消息可以用来跟踪一个完整的处理流程，相应日志记录的消息往往具有相对较长的时效性，如记录当前请求的目标`URL`
`Warning`|应用出现不正常行为，或者出现非预期的结果。尽管不是对实际错误做出的响应，但是警告指示组件或者应用程序未处于理想状态，并且一些进一步操作可能会导致关键错误，如用户登录时没有通过认证
`Error`|应用当前的处理流程因出现未被处理的异常而终止，但是整个应用不至于崩溃。这样的事件主要针对当前活动或者操作遇到的异常，而不是针对整个应用级别的错误，如添加记录时出现主键冲突
`Critical`|系统或者应用出现难以恢复的崩溃，或者需要引起足够重视的灾难性事件

## 2. 日志模型
总的来说，日志模型由`ILogger`、`ILoggerFactory` 和 `ILoggerProvider` 这 3 个核心对象构成，可以将它们称为日志模型三要素。这些接口都定义在NuGet包`Microsoft.Extensions.Logging.Abstractions`中，而具体的实现则由另一个NuGet包`Microsoft.Extensions.Logging`来提供。

`ILoggerFactory` 对象和`ILoggerProvider`对象都是`ILogger`对象的创建者，而`ILoggerProvider`对象会注册到`ILoggerFactory`对象上。有人认为这3个对象之间的关系很混乱，这主要体现在`ILogger`对象具有两个不同的创建者。

![日志模型三要素](https://i.loli.net/2021/03/24/l3ZiQ52rC4LmuKs.jpg)

**`ILoggerProvider`和 `ILoggerFactory`创建的其实是不同的 `ILogger`对象。`ILoggerFactory`创建的`ILogger`对象被应用程序用来分发日志事件，而`ILoggerProvider`提供的`ILogger`对象则是日志事件的真正消费者，所以从发布订阅模式的角度来讲，前者属于发布者，后者属于订阅者。一个具体的`ILoggerProvider`会利用提供的`ILogger`对象将接收的日志实现输出到对应的渠道，而`ILoggerFactory`提供的`ILogger`对象则是由这组面向具体输出渠道的`ILogger`对象组合而成的。**

如果进一步引入两个实现类型可以绘制成图 9-11 所示的类图，由此可以更好地理解日志模型三要素之间的关系。`LoggerFactory` 类型是对 `ILoggerFactory` 接口的默认实现，而由它创建的是一个类型为 `Logger`的对象，该对象由注册到`LoggerFactory`对象上的所有 `ILoggerProvider`对象提供的一组 `ILogger`对象组合而成。虽然 `Logger`类型只是一个实现了 `ILogger`接口的内部类型，但是应用程序用来分发日志事件的就是这个对象，正是该对象将日志事件分发给它的`ILogger`对象成员，后者最终将经过过滤的日志消息输出到对应的渠道。

![日志模型三要素关系](https://i.loli.net/2021/03/24/R3TzheI4rpGQUkZ.jpg)

## 3. ILogger
`ILogger` 接口中定义了如下 3 个方法：`Log`、`IsEnabled` 和 `BeginScope`。一般来说，当`ILogger` 对象在接收到分发给它的日志事件之后，它会将日志等级作为参数调用其 `IsEnabled` 方法来确定当前日志是否应该分发下去。针对日志事件的分发实现在 `Log` 方法中，除了提供日志等级，在调用`Log`方法时还需要提供一个`EventId`来标识当前的日志事件。

```csharp
public interface ILogger
{
    bool IsEnabled(LogLevel logLevel);
    void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter);
    IDisposable BeginScope<TState>(TState state);
}
```
日志事件的内容荷载通过 `Log`方法的参数 `state`来提供，由于该方法并没有对此做任何限制，所以可以提供一个任意类型的对象来承载描述日志事件的内容。日志的一个重要作用就是帮助我们更好地排错和纠错，所以这类日志承载的大部分信息会用来描述抛出的异常，该异常由`Log`方法的参数`exception`来提供。

一般来说，日志输出要么体现为日志内容的可视化呈现（如直接显示在控制台上），要么体现为持久化存储（如写入文件或者数据库中），最终的内容基本上都体现为一个格式化的字符串，因此日志在被写入之前需要先进行格式化。所谓的日志格式化就是将利用参数`state`和`exception`表示的原始内容荷载转换成一个字符串的过程，所以格式化器可以通过一个`Func＜object，Exception，string＞`对象来表示，调用`Log`方法提供的最后一个参数就是这样一个对象。

除了定义在`ILogger`接口中的`Log`方法，还可以调用如下这些扩展的 `Log`方法来分发日志事件。这些扩展方法会帮助我们完成针对日志消息的格式化。由于这些方法默认采用针对模板的格式化方式，所以调用这些方法时需要以字符串的形式提供日志消息模板和填充占位符的参数列表。除此之外，作为日志事件标识的`EventId`也不是必须提供的参数，因为这些方法会默认提供一个ID属性为0的`EventId`。

```csharp
public static class LoggerExtensions
{
    public static IDisposable BeginScope(this ILogger logger, string messageFormat, params object[] args);
    public static void Log(this ILogger logger, LogLevel logLevel, string message, params object[] args);
    public static void Log(this ILogger logger, LogLevel logLevel, EventId eventId, string message, params object[] args);
    public static void Log(this ILogger logger, LogLevel logLevel, Exception exception, string message, params object[] args);
    public static void Log(this ILogger logger, LogLevel logLevel, EventId eventId, Exception exception, string message, params object[] args)
}
```
由`ILogger`对象分发的日志事件必须具有一个明确的等级，所以调用`ILogger`对象的`Log`方法记录日志时必须显式指定日志消息采用的等级。除此之外，我们也可以调用 6 种日志等级对应的扩展方法 `Log{Level}`（`LogDebug、LogTrace、LogInformation、LogWarning、LogError` 和`LogCritical`）。下面的代码片段列出了针对日志等级`Debug`的 3个`LogDebug`方法重载的定义，针对其它日志等级的扩展方法的定义与之类似。
```csharp
public static class LoggerExtensions
(
    public static void LogDebug(this ILogger logger, EventId eventId, Exception exception, string message, params object[] args); 
    public static void LogDebug(this ILogger logger, EventId eventId, string message, params object[] args);
    public static void LogDebug(this ILogger logger, string message, params object[] args);
}
```
每条日志消息都关联一个具体的类别（`Category`），这个类型实际上可以表示创建这条日志消息的“源”。日志类别指明日志消息是被谁写入的，我们一般将日志分发所在的组件、服务或者类型名称作为日志类别。日志类别是`ILogger`对象自身的属性，在利用`ILoggerFactory`工厂创建一个 `ILogger`对象时，我们必须提供对应的日志类别。由同一个 `ILogger`对象分发的日志事件具有相同的类别。`ILogger＜TCategoryName＞`提供了一种强类型的日志类别指定方式，`Logger＜T＞`是其默认实现类型。`Logger＜T＞`能够根据泛型类型解析日志类别。

除了可以调用构造函数创建一个`Logger＜T＞`对象，还可以调用针对`ILoggerFactory`接口的`CreateLogger＜T＞`扩展方法来创建。如下面的代码片段所示，除了这个`CreateLogger＜T＞`方法，另一个`CreateLogger`方法直接指定一个`Type`类型的参数，虽然返回类型不同，但是两个方法创建的`Logger`在日志记录行为上是等效的。
```csharp
public static class LoggerFactoryExtensions
{
    public static ILogger<T> CreateLogger<T>(this ILoggerFactory factory);
    public static ILogger CreateLogger(this ILoggerFactory factory, Type type);
}
```

## 4. 依赖注入
我们总是采用依赖注入的方式来提供用于分发日志事件的`ILogger`对象。具体来说，有两种方式可供选择：一种是先利用作为依赖注入容器的 `IServiceProvider` 对象来提供一个`ILoggerFactory` 工厂，然后利用它根据指定日志类别创建 `ILogger`对象；另一种则是直接利用`IServiceProvider`对象提供一个泛型的 `ILogger＜TCategoryName＞`对象。`IServiceProvider`对象能够提供期望服务对象的前提是预先添加了相应的服务注册。

构成日志模型的核心服务是通过`IServiceCollection`接口的`AddLogging`扩展方法进行注册的。由于可以直接利用作为依赖注入容器的`IServiceProvider`对象提供`ILoggerFactory`和 `ILogger＜TCategoryName＞`对象，`AddLogging`方法自然提供了针对这两个类型的服务注册。

```csharp{11-12,14-15}
public static class LoggingServiceCollectionExtensions
{
    public static IServiceCollection AddLogging(this IServiceCollection services) => AddLogging(services, builder => { });

    public static IServiceCollection AddLogging(this IServiceCollection services, Action<ILoggingBuilder> configure)
    {
        if (services == null)
            throw new ArgumentNullException(nameof(services));

        services.AddOptions();
        services.TryAdd(ServiceDescriptor.Singleton<ILoggerFactory, LoggerFactory>());
        services.TryAdd(ServiceDescriptor.Singleton(typeof(ILogger<>), typeof(Logger<>)));

        services.TryAddEnumerable(ServiceDescriptor.Singleton<IConfigureOptions<LoggerFilterOptions>>(
            new DefaultLoggerLevelConfigureOptions(LogLevel.Information)));

        configure(new LoggingBuilder(services));
        return services;
    }
}
```
除了添加针对`LoggerFactory`和`Logger＜TCategoryName＞`类型的服务注册，`AddLogging`扩展方法还调用`IServiceCollection`接口的`AddOptions`扩展方法注册了`Options`模式的核心服务。这个扩展方法还以`Singleton`模式添加了一个针对`IConfigureOptions＜LoggerFilterOptions＞`接口的服务注册，具体的服务实例是一个`DefaultLoggerLevelConfigureOptions`对象，它将默认的最低日志等级设置为`Information`，这正是在默认情况下等级为`Trace`和`Debug`的日志事件会被忽略的根源所在。

```csharp{5-8,10-11}
class Program
{
    static void Main(string[] args)
    {
        var logger = new ServiceCollection()
            .AddLogging(builder => builder.AddConsole())
            .BuildServiceProvider()
            .GetService<ILogger<Program>>();

        // logger.Log(LogLevel.Information,1,"test log");
        logger.LogInformation("server time is {0}", DateTime.Now);

        Console.ReadKey();
    }
}
```

本文中示例都是基于非`Hosted Service`的普通程序演示，日志框架在Asp.Net Core等`Hosted Servier`中已默认集成，其使用方式可以参考[Hosting日志](../hosting/hosted_service.md#_3-4-日志)。

## 5. 日志范围
日志可以为针对某种目的（如纠错查错、系统优化和安全审核等）进行数据分析提供原始数据，所以孤立存在的一条日志消息对数据分析往往毫无用处，很多问题只有将多条相关的日志消息综合起来分析才能找到答案。

为了解决上述问题，日志模型引入了日志范围（`Log Scope`）。所谓的日志范围是为日志记录创建的一个具有唯一标识的上下文，如果注册的`ILoggerProvider`对象支持这个特性，那么它提供的`ILogger`对象会感知到当前日志范围的存在，并将其标识连同日志消息的内容荷载一并记录下来。在进行数据分析时，就可以根据日志范围上下文标识将相关的日志消息串联起来。

日志作用于常用于解决以下场景的问题：
* 单次事务中包含批量多条操作日志
* 复杂流程的日志关联
* 调用链追踪与请求处理过程对应


```csharp{5,9}
static async Task Main(string[] args)
{
    var logger = new ServiceCollection()
        .AddLogging(builder => builder
            .AddConsole(options => options.IncludeScopes = true))
        .BuildServiceProvider()
        .GetService<ILogger<Program>>();
    
    using (logger.BeginScope($"Test Transaction[{Guid.NewGuid()}]"))
    {
        var stopwatch = Stopwatch.StartNew();
        await Task.Delay(500);
        logger.LogInformation("Operation-0 completes at {0}", stopwatch.Elapsed);
        await Task.Delay(300);
        logger.LogWarning("Operation-1 completes at {O}", stopwatch.Elapsed);
    }

    Console.ReadKey();
}
```
以上输出结果形如：
```
info: ConsoleDemo.Program[0]
      => Test Transaction[c5a62b31-9e1f-497e-bb96-9e92bac39568]
      Operation-0 completes at 00:00:00.5013837
warn: ConsoleDemo.Program[0]
      => Test Transaction[c5a62b31-9e1f-497e-bb96-9e92bac39568]
      Operation-1 completes at 00:00:00.8217213
```
`ILogger`接口的泛型方法`BeginScope＜TState＞`会为我们建立一个日志范围，调用该方法指定的参数将作为这个日志范围的标识。对于在一个日志范围中分发的日志事件，日志范围的标识将会作为一个重要的内容荷载被记录下来。日志范围最终体现为一个`IDisposable`对象，其`Dispose`方法的调用会导致日志范围的终结。

在Asp.Net Core中我们可以把一次Web请求设定为一个作用域记录其日志，同个作用域中的日志会带有相同的作用域标识前缀。

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

## 6. 日志过滤
在应用程序中使用`ILogger`对象分发的日志事件，并不能保证都会进入最终的输出渠道，因为注册的 `ILoggerProvider` 对象会对日志进行过滤，只有符合过滤条件的日志消息才会被真正地输出到对应的渠道。我们可以采用多种方式为注册的`ILoggerProvider`对象定义过滤规则。

一般来说，日志消息的等级越高，表明对应的日志事件越重要或者反映的问题越严重，自然就越应该被记录下来，所以在很多情况下我们指定的过滤条件只需要一个最低等级，所有不低于（等于或者高于）该等级的日志都会被记录下来。**最低日志等级在默认情况下被设置为`Information`**。

### 6.1 SetMinimumLevel
调用`ILoggingBuilder`接口的`SetMinimumLevel`方法可以设置最低日志等级。
```csharp{5}
static void Main(string[] args)
{
    var logger = new ServiceCollection()
        .AddLogging(builder => builder
            .SetMinimumLevel(LogLevel.Debug)
            .AddConsole())
        .BuildServiceProvider()
        .GetService<ILogger<Program>>();
    
    logger.LogDebug("server time is {0}", DateTime.Now);

    Console.ReadKey();
}
```
### 6.2 AddFilter
日志过滤条件并不仅限于日志等级，很多时候还会同时考虑日志的类别。在利用`ILoggerFactory`创建对应的 `ILogger`时需要指定日志类别，由于一般将当前组件、服务或者类型的名称作为日志类别，所以日志类别基本上体现了日志消息来源，如果我们只希望输出由某个组件或者服务发出的日志事件，就需要针对类别对日志事件实施过滤。日志过滤条件可以通过一个类型为`Func＜string，LogLevel，bool＞`的委托对象来表示，它的两个输入参数分别代表日志事件的类别和等级。这个委托称为过滤器(`Filter`)。

```csharp{5-10}
static void Main(string[] args)
{
    var loggerFactory = new ServiceCollection()
        .AddLogging(builder => builder
            .AddFilter((category, level) => category switch
            {
                "Colin" => level >= LogLevel.Debug,
                "Robin" => level >= LogLevel.Warning,
                _ => level >= LogLevel.Information
            })
            .AddConsole())
        .BuildServiceProvider()
        .GetService<ILoggerFactory>();

    var colinLogger = loggerFactory.CreateLogger("Colin");
    var robinLogger = loggerFactory.CreateLogger("Robin");
    var defaultLogger = loggerFactory.CreateLogger("Default");
    
    colinLogger.LogDebug("Debug log");
    robinLogger.LogWarning("warning log");
    defaultLogger.LogInformation("Information log");

    Console.ReadKey();
}
```
过滤器委托还有一个重载可以过滤特定`ILoggerProvider`，`Func＜string，string，LogLevel，bool＞`，该委托的 3 个输入参数分别表示`ILogger Provider`类型的全名、日志类别和等级。

### 6.3 配置文件
日志过滤规则除了可以采用编程的形式来设置，还可以采用配置的形式来提供。以配置的形式定义的过滤规则最终都体现为一个设定的最低等级，设定的这个最低日志等级可以是一个全局的默认设置，也可以专门针对某个日志类别或者`ILoggerProvider`类型。

```json
{
    "LogLevel": {
        "Default": "Warning",
        "Colin": "Information"
    },
    "Console": {
        "LogLevel": {
            "Default": "Error",
            "Colin": "Warning"
        }
    }
}
```

`Default`表示默认设置，其它的则是针对具体日志类别的设置。上面定义的这段配置体现的过滤规则如下：对于 `ConsoleLoggerProvider`来说，在默认情况下只有等级不低于`Error`的日志事件会被输出，而对于日志类别`Colin`来说，最低日志输出级别为`Warning`。其它`ILoggerProvider`中，默认日志输出级别为`Warning`，而对于日志类别`Colin`来说，最低日志输出级别为`Information`。

```csharp{9}
static void Main(string[] args)
{
    var config = new ConfigurationBuilder()
        .AddJsonFile("appsettings.json")
        .Build();

    var loggerFactory = new ServiceCollection()
        .AddLogging(builder => builder
            .AddConfiguration(config)
            .AddConsole()
            .AddDebug())
        .BuildServiceProvider()
        .GetService<ILoggerFactory>();

    var colinLogger = loggerFactory.CreateLogger("Colin");
    var robinLogger = loggerFactory.CreateLogger("Robin");
    colinLogger.LogWarning("colin warning");
    robinLogger.LogError("robin error");

    Console.ReadKey();
}
```

## 7. LoggerMessage
实际在记录日志的过程中总是需要一个包含占位符的消息模板，为了提供针对语义化日志（`Semantic Logging`）或者结构化日志（`Structured Logging`）的支持，我们可以采用一个具有明确语义的字符串作为占位符。日志系统提供了一个名为`LoggerMessage`的静态类型，我们可以利用它根据某个具体的消息模板创建一个`Action＜ILogger，...＞`对象来分发日志事件。

```csharp{1,6-7,22}
private static Action<ILogger, string, string, DateTime, Exception> _log;
private static ILogger _logger;

static void Main(string[] args)
{
    _log = LoggerMessage.Define<string, string, DateTime>(LogLevel.Information, 1,
        "SayHi is invoked.\r\nArguments:name={name}\r\nReturn value:{returnValue}\r\nTime:{time}");
    _logger = new ServiceCollection()
        .AddLogging(builder => builder.AddConsole())
        .BuildServiceProvider()
        .GetService<ILogger<Program>>();

    SayHi("Colin");
    SayHi("Robin");

    Console.ReadKey();
}

static string SayHi(string name)
{
    var returnValue = $"Hi {name}";
    _log(_logger, name, returnValue, DateTime.Now, null);
    return returnValue;
}
```

**利用 `LoggerMessage` 创建的委托对象来记录日志的一个主要的目的就是避免对相同消息模板重复解析**，这种基于模板的字符串解析过程不仅针对具体的日志消息，还针对日志范围上下文。调用 `ILogger` 对象的`BeginScope`方法时，同样是提供一个包含占位符的模板和对应的参数，针对相同模板的重复解析依然存在，所以`LoggerMessage`定义了一系列`DefineScope`方法，我们可以利用它们提供的委托对象来创建日志范围上下文。

## 8. 第三方日志组件
Asp.Net Core默认的日志提供程序并没有提供写文件、数据库、邮件等功能，我们可以使用第三方日志提供程序完成,如[Nlog](https://nlog-project.org/)。配置步骤非常简单，按[官方文档](https://github.com/NLog/NLog/wiki/Getting-started-with-ASP.NET-Core-5)进行即可。

由于实现了统一的日志接口，替换不同的日志提供程序后，使用日志组件记录日志的代码无需修改，这也体现了面向接口多态编程的好处。

除了前面提到的日志组件，在大型分布式应用或微服务中就需要将分布式应用中分散各处的日志进行统一整理归类，这就需要分布式日志管理，如经典的日志组件 [ELK](elk.md)(跨平台)，.Net Core 日志组件 [Exceptionless](exceptionless.md)(Windows only)。