# 健康检查

现代化的应用及服务的部署场景主要体现在集群化、微服务和容器化，这一切都建立在针对部署应用或者服务的健康检查上。提到健康检查，读者想到的可能就是通过发送“心跳”请求以确定目标应用或者服务的可用性。其实采用 ASP.NET Core来开发Web应用或者服务，可以直接利用框架提供的原生健康检查功能。

ASP.NET Core 框架的健康检查功能是通过`HealthCheckMiddleware`中间件完成的。我们不仅可以利用该中间件确定当前应用的可用性，还可以注册相应的`IHealthCheck`对象来完成针对不同方面的健康检查。

## 1. 健康检查
对于部署于集群或者容器的应用或者服务来说，它需要对外暴露一个终结点，以便负载均衡器或者容器编排框架可以利用该终结点确定是否可用。

```csharp{5-6}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services.AddHealthChecks())
            .Configure(app => app.UseHealthChecks("/healthcheck")))
        .Build().Run();
}
```
我们调用`IApplicationBuilder`接口的`UseHealthChecks`扩展方法注册了`HealthCheckMiddleware`，该方法提供的参数`/healthcheck`是为健康检查终结点指定的路径。直接请求`/healthcheck`会得到一个状态码为`200 OK`内容为`Healthy`的响应。只要应用正常启动，它就被视为“健康”（完全可用）。

## 2. 定制健康检查逻辑
多数情况下我们需要自定义健康检查逻辑来满足不同的业务场景而不总是简单的返回将康状态。

### 2.1 应用健康检查
下面示例我们来演示一个自定义内存运行状况检查器，如果应用使用的内存多于给定内存阈值（在示例应用中为 1 GB），报告降级状态。

```csharp{6,8,14-38}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services
                .Configure<MemoryCheckOptions>(options => options.Threshold = 1024 * 1024 * 1024)
                .AddHealthChecks()
                .AddCheck<MemoryHealthCheck>("memory_check"))
            .Configure(app => app.UseHealthChecks("/healthcheck")
            ))
        .Build().Run();
}

public class MemoryHealthCheck : IHealthCheck
{
    private readonly long _threshold;
    public MemoryHealthCheck(IOptionsMonitor<MemoryCheckOptions> options) =>
        _threshold = options.CurrentValue.Threshold;

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default(CancellationToken))
    {
        var allocated = GC.GetTotalMemory(forceFullCollection: false);
        var data = new Dictionary<string, object>()
        {
            {"AllocatedBytes", allocated},
            {"Gen0Collections", GC.CollectionCount(0)},
            {"Gen1Collections", GC.CollectionCount(1)},
            {"Gen2Collections", GC.CollectionCount(2)},
        };
        var status = allocated < _threshold ? HealthStatus.Healthy : context.Registration.FailureStatus;

        return Task.FromResult(new HealthCheckResult(status,
            $"Reports degraded status if allocated bytes >= {_threshold} bytes.", exception: null,
            data: data));
    }
}

public class MemoryCheckOptions
{
    public long Threshold { get; set; }
}
```



针对健康状态`Healthy`和`Degraded`，响应码都是`200 OK`，因为此时的应用或者服务均会被视为可用（`Available`）状态，两者之间只是完全可用和部分可用的区别。状态为`Unhealthy` 的服务被视为不可用（`Unavailable`），所以响应状态码为` 503 Service` Unavailable`。

### 2.2 服务组件健康检查
如果当前应用承载或者依赖了若干组件或者服务，就可以针对它们以更细粒度为某个组件或者服务注册相应的`IHealthCheck`对象来确定它们的健康状况。

```csharp{9-11}
public static void Main(string[] args)
{
    var random = new Random();

    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services
                .AddHealthChecks()
                .AddCheck("foo", CheckStatus)
                .AddCheck("bar", CheckStatus)
                .AddCheck("baz", CheckStatus)
            )
            .Configure(app => app.UseHealthChecks("/healthcheck", new HealthCheckOptions
                {
                    ResultStatusCodes = new Dictionary<HealthStatus, int>
                    {
                        [HealthStatus.Unhealthy] = 503,
                        [HealthStatus.Degraded] = 299,
                        [HealthStatus.Healthy] = 200
                    }
                })
            ))
        .Build().Run();

    HealthCheckResult CheckStatus() => random.Next(1, 4) switch
    {
        1 => HealthCheckResult.Unhealthy(),
        2 => HealthCheckResult.Degraded(),
        _ => HealthCheckResult.Healthy()
    };
}
```
如上代码我们定义了名为`foo`、`bar`和`baz`的三个健康检查器，模拟分别用于对三个服务进行健康检查，当然这里我们为了简单采用了同样的健康检查逻辑(`CheckStatus`)。

当注册多个健康检查器的时，健康检查响应返回的是针对整个应用的整体健康状态，这个状态是根据所有服务当前的健康状态组合计算出来的。具体的计算逻辑按照严重程度，3种健康状态的顺序应该是`Unhealthy＞Degraded ＞Healthy`，组合中最严重的健康状态就是应用整体的健康状态。如果应用的整体健康状态为`Healthy`，就意味着所有服务的健康状态都是`Healthy`；如果应用的整体健康状态为`Degraded`，就意味着至少有一个服务的健康状态为`Degraded`，并且没有`Unhealthy`；如果其中某个服务的健康状态为`Unhealthy`，应用的整体健康状态就是`Unhealthy`。

## 3. 定制健康检查状态码
虽然健康检查默认响应状态码的设置是合理的，但是不能通过状态码来区分 `Healthy` 和`Unhealthy`这两种可用状态，我们可以自定义健康检查响应的状态码。

```csharp{15-24}
public static void Main(string[] args)
{
    var random = new Random();
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services
                .AddHealthChecks()
                .AddCheck("default", () => random.Next(1, 4) switch
                {
                    1 => HealthCheckResult.Unhealthy(),
                    2 => HealthCheckResult.Degraded(),
                    _ => HealthCheckResult.Healthy()
                })
            )
            .Configure(app => app.UseHealthChecks("/healthcheck", new HealthCheckOptions
                {
                    ResultStatusCodes = new Dictionary<HealthStatus, int>
                    {
                        [HealthStatus.Unhealthy] = 503,
                        [HealthStatus.Degraded] = 299,
                        [HealthStatus.Healthy] = 200
                    }
                })
            ))
        .Build().Run();
}
```

## 4. 健康报告
当在应用中注册多个健康检查器时除了得到的应用整体健康状态，我们也可以定制一份详细的针对所有服务的“健康诊断书”。

### 4.1 查看健康报告
```csharp{12-26}
public static void Main(string[] args)
{
    var random = new Random();
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services
                .AddHealthChecks()
                .AddCheck("foo", CheckStatus)
                .AddCheck("bar", CheckStatus, new[] {"bar1"})
                .AddCheck("baz", CheckStatus, new[] {"baz1", "baz2"})
            )
            .Configure(app => app.UseHealthChecks("/healthcheck", new HealthCheckOptions
                {
                    //过滤健康报告
                    Predicate = registration => registration.Tags.Any(), //只显示有Tags的报告

                    //定制健康报告
                    ResponseWriter = async (context, report) =>
                    {
                        context.Response.ContentType = "application/json";
                        var settings = new JsonSerializerSettings {Formatting = Formatting.Indented};
                        settings.Converters.Add(new StringEnumConverter());
                        await context.Response.WriteAsync(JsonConvert.SerializeObject(report, settings));
                    }
                })
            ))
        .Build().Run();

    HealthCheckResult CheckStatus() => random.Next(1, 4) switch
    {
        1 => HealthCheckResult.Unhealthy(),
        2 => HealthCheckResult.Degraded(),
        _ => HealthCheckResult.Healthy()
    };
}
```
在输出健康报告之前可以按需进行自定义过滤报告。上面健康检查得到报告如下图所示。
![完整健康报告](https://i.loli.net/2021/04/01/AbZcS7vhwn6KgJQ.png)

### 4.2 发布健康报告
除了针对具体的请求返回当前的健康报告，我们还能以设定的间隔定期收集和发布健康报告。我们可以利用这个功能将收集的健康报告发送给 `APM`（`Application Performance Management`）系统。

健康报告的发布实现在通过`IHealthCheckPublisher`接口表示的服务中。我们可以在同一个应用中注册多个`IHealthCheckPublisher`服务，如可以注册多个这样的服务将健康报告分别输出到控制台、日志文件或者直接发送给另一个健康报告处理服务。

下面我们简单演示如何定期发布健康报告到控制台。

```csharp{11-12,27-36,40-44,46}
public static void Main(string[] args)
{
    var random = new Random();
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services
                .AddHealthChecks()
                .AddCheck("foo", CheckStatus)
                .AddCheck("bar", CheckStatus, new[] {"bar1"})
                .AddCheck("baz", CheckStatus, new[] {"baz1", "baz2"})
                .AddConsolePublisher()
                .ConfigurePublisher((HealthCheckPublisherOptions options) => options.Period = TimeSpan.FromSeconds(5)))
            .Configure(app => app.UseHealthChecks("/healthcheck")))
            .Build().Run();

    HealthCheckResult CheckStatus()
    {
        return random.Next(1, 4) switch
        {
            1 => HealthCheckResult.Unhealthy(),
            2 => HealthCheckResult.Degraded(),
            _ => HealthCheckResult.Healthy()
        };
    }
}

public class ConsolePublisher : IHealthCheckPublisher
{
    public Task PublishAsync(HealthReport report, CancellationToken cancellationToken)
    {
        var settings = new JsonSerializerSettings {Formatting = Formatting.Indented};
        settings.Converters.Add(new StringEnumConverter());
        Console.WriteLine(JsonConvert.SerializeObject(report, settings));
        return Task.CompletedTask;
    }
}

public static class Extensions
{
    public static IHealthChecksBuilder AddConsolePublisher(this IHealthChecksBuilder builder)
    {
        builder.Services.AddSingleton<IHealthCheckPublisher, ConsolePublisher>();
        return builder;
    }

    public static void ConfigurePublisher(this IHealthChecksBuilder builder,Action<HealthCheckPublisherOptions> configure) => builder.Services.Configure(configure);
}
```