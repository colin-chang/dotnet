# 承载系统

借助.Net提供的承载(`Hosting`)系统，我们可以将任意一个或者多个长时间运行（Long-Running）的服务寄宿或者承载于托管进程中。ASP.Net应用仅仅是该承载系统的一种典型的服务类型而已，任何需要在后台长时间运行的操作都可以定义成标准化的服务并利用该系统来承载。

![服务承载模型](https://i.loli.net/2021/03/23/2VWF1moEOZ4RuyD.png)

服务承载模型主要由如下图所示的三个核心对象组成：多个通过`IHostedService`接口表示的服务被承载于通过`IHost`接口表示的宿主上，`IHostBuilder`接口表示`IHost`对象的构建者。

## 1. IHostedService

一个ASP.Net应用本质上是一个需要长时间运行的服务，开启这个服务是为了启动一个网络监听器。当监听到抵达的HTTP请求之后，该监听器会将请求传递给应用提供的管道进行处理。管道完成了对请求处理之后会生成HTTP响应，并通过监听器返回客户端。类似的承载服务还有WorkService。

除了以上典型的承载服务，我们还有很多其它的服务承载需求，下面通过一个简单的实例来演示如何承载一个服务来收集当前执行环境的性能指标。我们演示的承载服务会定时采集并分发当前进程的性能指标。简单起见，我们只关注处理器使用率、内存使用量和网络吞吐量这3种典型的性能指标，为此定义了下面的`PerformanceMetrics`类型。我们并不会实现真正的性能指标收集，所以定义静态方法`Create`利用随机生成的指标数据创建一个`PerformanceMetrics`对象。

```csharp
public class PerformanceMetrics
{
    private static readonly Random _random = new Random();

    public int Processor { get; set; }
    public long Memory { get; set; }
    public long Network { get; set; }

    public override string ToString() => $"CPU: {Processor * 100}%; Memory: {Memory / (1024 * 1024)}M; Network: {Network / (1024 * 1024)}M/s";

    public static PerformanceMetrics Create() => new PerformanceMetrics
    {
        Processor = _random.Next(1, 8),
        Memory = _random.Next(10, 100) * 1024 * 1024,
        Network = _random.Next(10, 100) * 1024 * 1024
    };
}
```

承载的服务总是会被定义成`IHostedService`接口的实现类型。如下面的代码片段所示，该接口仅定义了两个用来启动和关闭自身服务的方法。当作为宿主的`IHost`对象被启动的时候，它会利用依赖注入框架激活每个注册的`IHostedService`服务，并通过调用`StartAsync`方法来启动它们。当服务承载应用程序关闭的时候，作为服务宿主的`IHost`对象会被关闭，由它承载的每个`IHostedService`服务对象的`StopAsync`方法也随之被调用。

```csharp
public interface IHostedService
{
    Task StartAsync(CancellationToken cancellationToken);
    Task StopAsync(CancellationToken cancellationToken);
}
```

我们将性能指标采集服务定义成如下这个实现了该接口的`PerformanceMetricsCollector`类型。在实现的`StartAsync`方法中，我们利用`Timer`创建了一个调度器，每隔5秒它会调用`Create`方法创建一个`PerformanceMetrics`对象，并将它承载的性能指标输出到控制台上。这个`Timer`对象会在实现的`StopAsync`方法中被释放。

```csharp{1,4,10}
public sealed class PerformanceMetricsCollector : IHostedService
{
    private IDisposable _scheduler;
    public Task StartAsync(CancellationToken cancellationToken)
    {
        _scheduler = new Timer(_ => Console.WriteLine($"[{DateTimeOffset.Now}]{PerformanceMetrics.Create()}"), null, TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(5));
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _scheduler?.Dispose();
        return Task.CompletedTask;
    }
}
```

承载系统通过`IHost`接口表示承载服务的宿主，该对象在应用启动过程中采用`Builder`模式由对应的`IHostBuilder`对象来创建。`HostBuilder`类型是对`IHostBuilder`接口的默认实现，所以可以采用如下方式创建一个`HostBuilder`对象，并调用其`Build`方法来提供作为宿主的`IHost`对象。

```csharp{5,6}
static void Main()
{
    new HostBuilder()
        .ConfigureServices(services => 
            // services.AddSingleton<IHostedService, PerformanceMetricsCollector>()
            services.AddHostedService<PerformanceMetricsCollector>())
        .Build()
        .Run();
}
```

承载系统无缝集成了.Net的依赖注入框架，在服务承载过程中所需的依赖服务，包括承载服务自身和它所依赖的服务均由此框架提供，承载服务注册的本质就是将对应的`IHostedService`实现类型或者实例注册到依赖注入框架中，如上示例调用`IHostBuilder`接口的`ConfigureServices`方法将`PerformancceMetricsCollector`注册成针对`IHostedService`接口的服务。由于承载服务大都需要长时间运行直到应用被关闭，所以针对承载服务的注册一般采用`Singleton`生命周期模式。

除了采用普通的依赖服务注册方式，针对`IHostedService`服务的注册还可以调用`IServiceCollection`接口的`AddHostedService<THostedService>`扩展方法来完成。由于该方法通过调用`TryAddEnumerable`扩展方法来注册服务，所以不用担心服务重复注册的问题。

```csharp
public static class ServiceCollectionHostedServiceExtensions
{
    public static IServiceCollection AddHostedService<THostedService>(this IServiceCollection services) where THostedService: class, IHostedService
    {
        services.TryAddEnumerable(ServiceDescriptor.Singleton<IHostedService, THostedService>());
        return services;
    }
}
```

最后调用`Run`方法启动通过`IHost`对象表示的承载服务宿主，进而启动由它承载的`PerformancceMetricsCollector`服务，该服务将以下图所示的形式每隔5秒显示由它“采集”的性能指标。

![承载服务](https://i.loli.net/2021/03/23/2G3tDbgnAPLzjuT.png)

## 2. IHost

### 2.1 IHost

通过`IHostedService`接口表示的承载服务最终被承载于通过`IHost`接口表示的宿主上。一般来说，一个服务承载应用在整个生命周期内只会创建一个`IHost`对象，我们启动和关闭应用程序本质上就是启动和关闭作为宿主的`IHost`对象。如下面的代码片段所示，`IHost`接口派生于`IDisposable`接口，所以当它在关闭之后，应用程序还会调用其`Dispose`方法作一些额外的资源释放工作。`IHost`接口的`Services`属性返回作为依赖注入容器的`IServiceProvider`对象，该对象提供了服务承载过程中所需的服务实例，其中就包括需要承载的`IHostedService`服务。定义在`IHost`接口中的`StartAsync`和`StopAsync`方法完成了针对服务宿主的启动和关闭。

```csharp
public interface IHost : IDisposable
{
    IServiceProvider Services { get; }
    Task StartAsync(CancellationToken cancellationToken = default);
    Task StopAsync(CancellationToken cancellationToken = default);
}
```

### 2.2 应用生命周期

在利用`HostBuilder`对象构建出`IHost`对象之后，我们并没有调用其`StartAsync`方法启动它，而是另一个名为`Run`的扩展方法。`Run`方法涉及到服务承载应用生命周期的管理，如果想了解该方法的本质，就得先来认识一个名为`IHostApplicationLifetime`的接口。顾名思义，`IHostApplicationLifetime`接口体现了服务承载应用程序的生命周期。如下面的代码片段所示，该接口除了提供了三个`CancellationToken`类型的属性来检测应用何时开启与关闭之外，还提供了一个`StopApplication`来关闭应用程序。

```csharp
public interface IHostApplicationLifetime
{
    CancellationToken ApplicationStarted { get; }
    CancellationToken ApplicationStopping { get; }
    CancellationToken ApplicationStopped { get; }

    void StopApplication();
}
```

我们接下来通过一个简单的实例来演示如何利用`IHostApplicationLifetime`服务来关闭整个承载应用程序。我们在一个控制台应用程序中定义了如下这个承载服务`PerformanceMetricsCollector`。在`PerformanceMetricsCollector`类型的构造函数中，我们注入了`IHostApplicationLifetime`服务。在得到其三个属性返回的`CancellationToken`对象之后，我们在它们上面分别注册了一个回调，回调操作通过在控制台上输出相应的文字使我们可以知道应用程序何时被启动和关闭。

```csharp{6,9-11,16}
public sealed class PerformanceMetricsCollector : IHostedService
{
    private readonly IHostApplicationLifetime _lifetime;
    private IDisposable _tokenSource;

    public PerformanceMetricsCollector(IHostApplicationLifetime lifetime)
    {
        _lifetime = lifetime;
        _lifetime.ApplicationStarted.Register(() => Console.WriteLine("[{0}]Application started", DateTimeOffset.Now));
        _lifetime.ApplicationStopping.Register(() => Console.WriteLine("[{0}]Application is stopping.", DateTimeOffset.Now));
        _lifetime.ApplicationStopped.Register(() => Console.WriteLine("[{0}]Application stopped.", DateTimeOffset.Now));
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _tokenSource = new CancellationTokenSource(TimeSpan.FromSeconds(5)).Token.Register(_lifetime.StopApplication);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _tokenSource?.Dispose();
        return Task.CompletedTask;
    }
}

static void Main()
{
    new HostBuilder()
        .ConfigureServices(services => services.AddHostedService<PerformanceMetricsCollector>())
        .Build()
        .Run();
}
```

该程序运行之后会在控制台上输出如下图所示的结果，从三条消息产生的时间间隔我们可以确定当前应用程序正是承载`PerformanceMetricsCollector`通过调用`IHostApplicationLifetime`服务的`StopApplication`方法关闭的。

![利用IHostApplicationLifetime关闭应用](https://i.loli.net/2021/03/23/6pgMnJATsmwfiEo.png)

### 2.3 Run扩展方法

如果我们调用`IHost`对象的扩展方法`Run`，它会在内部调用`StartAsync`方法，接下来它会持续等待下去直到接收到应用被关闭的通知。当`IHost`对象对象利用`IHostApplicationLifetime`服务接收到关于应用关闭的通知后，它会调用自身的`StopAsync`方法，针对`Run`方法的调用此时才会返回。

## 3. IHostBuilder

`IHostBuilder`接口的核心方法`Build`用来提供由它构建的`IHost`对象。除此之外，它还具有一个字典类型的只读属性`Properties`，我们可以将它视为一个共享的数据容器。

```csharp
public interface IHostBuilder
{    
    IDictionary<object, object> Properties { get; }
    IHost Build();
    …
}
```

作为一个典型的设计模式，`Builder`模式在最终提供给由它构建的对象之前，一般会允许作相应的前期设置，`IHostBuilder`针对`IHost`的构建也不例外。`IHostBuilder`接口提供了一系列的方法，我们可以利用它们为最终构建的`IHost`对象作相应的设置。

### 3.1 配置系统

`IHostBuilder`接口针对配置系统的设置体现在`ConfigureHostConfiguration`和`ConfigureAppConfiguration`方法上。通过前面的实例演示，我们知道`ConfigureHostConfiguration`方法涉及的配置主要是在服务承载过程中使用的，是针对服务宿主的配置；`ConfigureAppConfiguration`方法设置的则是供承载的`IHostedService`服务使用的，是针对应用的配置。不过前者最终会合并到后者之中，我们最终得到的配置实际上是两者合并的结果。

```csharp
public interface IHostBuilder
{
    IHostBuilder ConfigureHostConfiguration( Action<IConfigurationBuilder> configureDelegate); 
    IHostBuilder ConfigureAppConfiguration( Action<HostBuilderContext, IConfigurationBuilder> configureDelegate);
    …
}
```

从上面的代码片段可以看出`ConfigureHostConfiguration`方法提供一个`Action<IConfigurationBuilder>`类型的委托作为参数，我们可以利用它注册不同的配置源或者作相应的设置（比如设置配置文件所在目录的路径）。另一个方法`ConfigureAppConfiguration`的参数类型则是`Action<HostBuilderContext, IConfigurationBuilder>`，作为第一个参数的`HostBuilderContext`对象携带了与服务承载相关的上下文信息，我们可以利用该上下文对配置系统作针对性设置。

```json
  "PerformanceMetricsCollectorOptions": {
    "CaptureInterval": 5
  }
```

```csharp{5,23-27}
public sealed class PerformanceMetricsCollector : IHostedService
{
    private IDisposable _scheduler;
    private readonly int _captureInterval;
    public PerformanceMetricsCollector(IOptions<PerformanceMetricsCollectorOptions> options) => _captureInterval = options.Value.CaptureInterval;
    
    public Task StartAsync(CancellationToken cancellationToken)
    {
        _scheduler = new Timer(_ => Console.WriteLine($"[{DateTimeOffset.Now}]{PerformanceMetrics.Create()}"), null, TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(_captureInterval));
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _scheduler?.Dispose();
        return Task.CompletedTask;
    }
}

static void Main()
{
    new HostBuilder()
        .ConfigureAppConfiguration((context, builder) => builder.AddJsonFile("appsettings.json"))
        .ConfigureServices((context,services) => services
            .AddHostedService<PerformanceMetricsCollector>()
            .AddOptions()
            .Configure<PerformanceMetricsCollectorOptions>(context.Configuration.GetSection(nameof(PerformanceMetricsCollectorOptions))))
        .Build()
        .Run();
}
```

### 3.2 承载环境

任何一个应用总是针对某个具体的环境进行部署的，我们将承载服务的部署环境称为承载环境。承载环境通过`IHostEnvironment`接口表示，`HostBuilderContext`的`HostingEnvironment`属性返回的就是一个`IHostEnvironment`对象。如下面的代码片段所示，除了表示环境名称的`EnvironmentName`属性之外，`IHostEnvironment`接口还定义了一个表示当前应用名称的`ApplicationName`属性。

```csharp
public interface IHostEnvironment
{
    string EnvironmentName { get; set; }
    string ApplicationName { get; set; }
    string ContentRootPath { get; set; }
    IFileProvider ContentRootFileProvider { get; set; }
}
```

当我们编译某个.Net项目的时候，提供的代码文件（.cs）文件会转换成元数据和IL指令保存到生成的程序集中，其它一些文件还可以作为程序集的内嵌资源。除了这些面向程序集的文件之外，一些文件还会以静态文件的形式供应用程序使用，比如Web应用三种典型的静态文件（JavaScript、CSS和图片），我们将这些静态文件称为内容文件“Content File”。`IHostEnvironment`接口的`ContentRootPath`表示的就是存放这些内容文件的根目录所在的路径，另一个`ContentRootFileProvider`属性对应的则是指向该路径的`IFileProvider`对象，我们可以利用它获取目录的层次结构，也可以直接利用它来读取文件的内容。

```csharp{6-8}
static void Main()
{
    new HostBuilder()
        .ConfigureAppConfiguration((context, builder) =>
        {
            var env= context.HostingEnvironment;
            env.IsDevelopment();
            env.IsEnvironment(Environments.Development);
        })
        .Build()
        .Run();
}
```

开发、预发和产品是三种最为典型的承载环境，如果采用`Development`、`Staging`和`Production`来对它们进行命名，我们针对这三种承载环境的判断就可以利用如下三个扩展方法（`IsDevelopment`、`IsStaging`和`IsProduction`）来完成。如果我们需要判断指定的`IHostEnvironment`对象是否属于某个具体的环境，可以直接调用扩展方法`IsEnvironment`。针对环境名称的比较是不区分大小写的。

`IHostEnvironment`对象承载的3个属性都是通过配置的形式提供的，对应的配置项名称为`environment`和`contentRoot`和`applicationName`，它们对应着`HostDefaults`类型中三个静态只读字段。我们可以调用如下这两个针对`IHostBuilder`接口的`UseEnvironment`和`UseContentRoot`扩展方法来设置环境名称和内容文件根目录路径。

```csharp{4-5}
static void Main()
{
    new HostBuilder()
        .UseEnvironment(Environments.Development)
        .UseContentRoot("files")
        .Build()
        .Run();
}
```

一般来说，应用程序不同的承载环境往往具有不同的配置选项，将共享或者默认的配置定义在基础配置文件（如`appsettings.json`）中，将差异化的部分定义在针对具体承载环境的配置文件（如`appsettings.staging.json`和`appsettings.production.json`）中可以实现针对具体环境的配置文件。

```csharp {4-7}
static void Main()
{
    new HostBuilder()
        .ConfigureHostConfiguration(builder => builder.AddCommandLine(args))
        .ConfigureAppConfiguration((context, builder) => builder
            .AddJsonFile(path: "appsettings.json", optional: false)
            .AddJsonFile(path: $"appsettings.{context.HostingEnvironment.EnvironmentName}.json", optional: true))
        .ConfigureServices((context,services) => services.AddHostedService<PerformanceMetricsCollector>())
        .Build()
        .Run();
}
```

我们调用`ConfigureAppConfiguration`方法注册了两个配置文件：一个是承载基础或者默认配置的`appsettings.json`文件，另一个是针对当前承载环境的`appsettings.{environment}.json`文件。前者是必需的，后者是可选的，这样做的目的在于确保即使当前承载环境不存在对应配置文件的情况也不会抛出异常（此时应用只会使用`appsettings.json`文件中定义的配置）。以上程序通过命令启动程序时指定不同环境变量即可加载不同配置文件。

### 3.3 依赖注入

由于包括承载服务在内的所有依赖服务都是由依赖注入框架提供的，所以`IHostBuilder`接口提供了更多的方法来对完成服务注册。绝大部分用来注册服务的方法最终都调用了如下所示的`ConfigureServices`方法，由于该方法提供的参数是一个`Action<HostBuilderContext, IServiceCollection>`类型的委托，意味服务可以针对当前的承载上下文进行针对性注册。如果注册的服务与当前承载上下文无关，我们可以调用如下所示的这个同名的扩展方法，该方法提供的参数是一个类型为`Action<IServiceCollection>`的委托对象。

```csharp
public interface IHostBuilder
{
    IHostBuilder ConfigureServices(Action<HostBuilderContext, IServiceCollection> configureDelegate);
    …
}

public static class HostingHostBuilderExtensions
{
    public static IHostBuilder ConfigureServices(this IHostBuilder hostBuilder, Action<IServiceCollection> configureDelegate)
        => hostBuilder.ConfigureServices((context, collection) => configureDelegate(collection));
}
```

`IHostBuilder`接口提供了两个`UseServiceProviderFactory<TContainerBuilder>`方法重载，我们可以利用它注册的`IServiceProviderFactory<TContainerBuilder>`对象实现对第三方依赖注入框架的整合。除此之外，该接口还提供了另一个`ConfigureContainer<TContainerBuilder>`为注册`IServiceProviderFactory<TContainerBuilder>`对象创建的容器作进一步设置。下面代码演示了Autofac接管依赖注入的使用方式。

```csharp{2,4}
new HostBuilder()
    .UseServiceProviderFactory(new AutofacServiceProviderFactory())
    .ConfigureServices((hostContext, services) =>services.AddHttpClient())
    .ConfigureContainer<ContainerBuilder>((context, builder) =>builder.RegisterOssHelpers(context.Configuration.GetSection(nameof(OssBuckets))))
    .Build()
    .Run();
```

### 3.4 日志

在具体的应用开发时不可避免地会涉及很多针对“诊断日志”的编程，下面演示在通过承载系统承载的应用中如何记录日志。

```csharp{4,6,7,13,20}
public sealed class PerformanceMetricsCollector : IHostedService
{
    private IDisposable _scheduler;
    private readonly ILogger _logger;

    public PerformanceMetricsCollector(ILogger<PerformanceMetricsCollector> logger) =>
        _logger = logger;

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _scheduler = new Timer(_ => Console.WriteLine($"[{DateTimeOffset.Now}]{PerformanceMetrics.Create()}"), null,
            TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(5));
        _logger.LogDebug($"{nameof(StartAsync)} is called");
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _scheduler?.Dispose();
        _logger.LogDebug($"{nameof(StopAsync)} is called");
        return Task.CompletedTask;
    }
}
```

如下面的代码片段所示，我们调用`IHostBuilder`接口的`ConfigureLogging`扩展方法注册了日志框架的核心服务，并利用提供的`Action<ILoggingBuilder>`对象注册了针对控制台作为输出渠道的`ConsoleLoggerProvider`。

```csharp{7-9}
public static void Main()
{
    new HostBuilder()
        .ConfigureAppConfiguration((context, builder) => builder.AddJsonFile("appsettings.json"))
        .ConfigureServices((context, services) => services
            .AddHostedService<PerformanceMetricsCollector>())
        .ConfigureLogging((context, builder) => builder
            .AddConfiguration(context.Configuration.GetSection("Logging"))
            .AddConsole())
        .Build()
        .Run();
}
```

如果对输出的日志进行过滤，可以将过滤规则定义在配置文件中。假设对于类别以`Microsoft`.为前缀的日志，我们只希望等级不低于`Warning`的才会被输出，这样会避免太多的消息被输出到控制台上造成对性能的影响，所以可以将产品环境对应的`appsettings.production.json`文件的内容做如下修改。

```json
{
  "Logging": {
    "LogLevel": {
      "Microsoft": "Warning"
    }
  }
}
```

为了应用日志配置，我们还需要对应用程序做相应的修改。如下面的代码片段所示，在对`ConfigureLogging`扩展方法的调用中，可以利用`HostBuilderContext`上下文对象得到当前配置，进而得到名为`Logging`的配置节。我们将这个配置节作为参数调用`ILoggingBuilder`对象的`AddConfiguration`扩展方法将承载的过滤规则应用到日志框架上。

## 4. 静态类型Host

当目前为止，我们演示的实例都是直接创建`HostBuilder`对象来创建作为服务宿主的`IHost`对象。如果直接利用模板来创建一个ASP.Net应用，我们会发现生成的程序会采用如下的服务承载方式。具体来说，用来创建宿主的`IHostBuilder`对象是间接地调用静态类型`Host`的`CreateDefaultBuilder`方法创建出来的。

```csharp
public class Program
{
    public static void Main(string[] args)
    {
        CreateHostBuilder(args).Build().Run();
    }

    public static IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
            .ConfigureWebHostDefaults(webBuilder =>
            {
                webBuilder.UseStartup<Startup>();
            });
}
```

定义在静态类型`Host`中的两个`CreateDefaultBuilder`方法重载的定义的，我们会发现它们最终提供的仍旧是一个`HostBuilder`对象，但是在返回该对象之前，该方法会帮助我们做一些初始化工作。如下面的代码片段所示，当`CreateDefaultBuilder`方法创建出`HostBuilder`对象之后，它会自动将当前目录所在的路径作为内容文件根目录的路径。接下来，该方法还会调用`HostBuilder`对象的`ConfigureHostConfiguration`方法注册针对环境变量的配置源，对应环境变量名称前缀被设置为“`DOTNET_`”。如果提供了代表命令行参数的字符串数组，`CreateDefaultBuilder`方法还会注册针对命令行参数的配置源。

在设置了针对宿主的配置之后，`CreateDefaultBuilder`调用了`HostBuilder`的`ConfigureAppConfiguration`方法设置针对应用的配置，具体的配置源包括针对Json文件`appsettings.json`和`appsettings.{environment}.json`、环境变量（没有前缀限制）和命令行参数（如果提供了表示命令航参数的字符串数组）。

在完成了针对配置的设置之后，`CreateDefaultBuilder`方法还会调用`HostBuilder`的`ConfigureLogging`扩展方法作一些与日志相关的设置，其中包括应用日志相关的配置（对应配置节名称为`Logging`）和注册针对控制台、调试器和`EventSource`的日志输出渠道。在此之后，它还会调用`UseDefaultServiceProvider`方法让针对服务范围的验证在开发环境下被自动开启。
