# 选项框架

## 1. 框架简介

在系统设计过程中我们一般需要遵循以下原则：
* `ISP`(接口分离原则)。服务不应依赖它不使用的配置。
* `SoC`(关注点分离)。不同组件、服务之间的配置不应相互依赖或耦合。
 
.NET Core中提供了选项框架来帮我们处理服务和配置之间的关系。选项框架具有以下特性：

* 支持单例模式读取配置
* 支持快照
* 支持配置变更通知
* 支持热更新

## 2. 选项集成配置
[Microsoft.Extensions.Options.ConfigurationExtensions](https://www.nuget.org/packages/Microsoft.Extensions.Options.ConfigurationExtensions)包为`IServiceCollection`扩展了`Configure<T>`方法，其作用是注册一个配置对象并绑定为`IOptions<T>`对象。下面我们简单演示如何通过选项框架解除服务与配置间的依赖。

服务实现代码如下：
```csharp {12,14,17,29}
public interface IRedisHelper
{
    Task<bool> StringSetAsync<T>(string key, T value);
    Task<T> StringGetAsync<T>(string key) where T : class;
}

public class RedisHelper : IRedisHelper
{
    private readonly ConnectionMultiplexer _conn;
    private readonly IDatabase _db;

    public RedisHelper(IOptions<RedisHelperOptions> options)
    {
        var connectionString = options.Value.ConnectionString;
        _conn = ConnectionMultiplexer.Connect(connectionString);

        var dbNumber = options.Value.DbNumber;
        _db = _conn.GetDatabase(dbNumber);
    }


    public async Task<bool> StringSetAsync<T>(string key, T value) =>
        await _db.StringSetAsync(key, value.ToRedisValue());

    public async Task<T> StringGetAsync<T>(string key) where T : class =>
        (await _db.StringGetAsync(key)).ToObject<T>();
}

public class RedisHelperOptions
{
    public string ConnectionString { get; set; }
    public int DbNumber { get; set; }
}
```

`appsettings.json`配置内容如下：
```json
{
  "RedisHelperOptions": {
    "ConnectionString": "127.0.0.1:6379,password=123123,connectTimeout=1000,connectRetry=1,syncTimeout=10000",
    "DbNumber": 0
  }
}
```

服务注入代码如下：
```csharp {3,4}
 public void ConfigureServices(IServiceCollection services)
{
    services.Configure<RedisHelperOptions>(Configuration.GetSection(nameof(RedisHelperOptions)));
    //动态选项配置 读取配置后如需要根据业务进行动态处理，可以采用此方式
    //services.PostConfigure<RedisHelperOptions>(options => options.ConnectionString.Replace("6379", "6380"));
    services.AddSingleton<IRedisHelper, RedisHelper>();
}
```

不难发现，以上案例中`RedisHelper`服务只依赖了`RedisHelperOptions`类型，服务只需要关注配置的具体值是什么，而无需关注其依附的配置框架和数据来源，从而解除服务和配置之间的依赖关系。我们可以为不同的服务设计其对应`Options`，这样一来服务间的选项配置也不会相互依赖。

使用选项框架解除了服务与配置的依赖关系，但是每次注入服务时都需要先调用`IServiceCollection`的`Config`方法来配置选项，当需要注册的服务数量较多时选项配置就会导致代码看起来比较混乱，为了避免这个问题我们通常会为自定义服务扩展一个注入方法，将其对应的选项配置放在扩展方法中。
```csharp
public static IServiceCollection AddRedisHelper(this IServiceCollection services, IConfiguration config)
{
    services.Configure<RedisHelperOptions>(config);
    services.AddSingleton<IRedisHelper, RedisHelper>();
    return services;
}
```
使用以上扩展方法简化服务注入代码如下：
```csharp {3}
public void ConfigureServices(IServiceCollection services)
{
    services.AddRedisHelper(Configuration.GetSection(nameof(RedisHelperOptions)));
}
```
上述案例代码已共享到[Github](https://github.com/colin-chang/RedisHelper)

## 3. 配置选项
### 3.1 配置文件
.Net Core中配置文件支持热更新。在`ConfigurationBuilder`的`AddJsonFile()`方法中`reloadOnChange`参数表示配置文件变更后是否自动重新加载(热更新)。

```csharp
new ConfigurationBuilder().AddJsonFile("appsettings.json", true, true)
```

在Asp.Net Core中不指定配置文件时默认使用应用根目录下的`appsettings.json`文件作为配置文件并且启用了热更新，这在`WebHost.CreateDefaultBuilder(args)`过程中完成，若要使用自定义配置文件名称可以通过以下方式修改。

```csharp
WebHost.CreateDefaultBuilder(args)
    .ConfigureAppConfiguration(config => config.AddJsonFile("myconfig.json",true,false))
```

开启配置文件热更新后程序会启动一个后台线程监听配置文件是否变动，基于文件的配置由 `FileConfigurationSource`表示, 它使用[`IFileProvider`](fileprovider.md#_3-2-监控文件变化)来监视文件。如果配置文件不需要经常改动可以关闭配置文件热更新以减少系统开支，关闭方式同上。

如果需要在配置文件动态修改之后执行特定操作，可注册`ChangeToken`的`OnChange`事件。
```csharp {4}
static void Main(string[] args)
{
    var configurationRoot = new ConfigurationBuilder().AddIniFile("appsettings.json", false, true).Build();
    ChangeToken.OnChange(() => configurationRoot.GetReloadToken(), () => Console.WriteLine("配置已被修改"));
}
```

### 3.2 选项框架
选项框提供了`IOptionsSnapshot<TOptions>`(用于`Scope`模式)和`IOptionsMonitor<TOptions>`(用于`Singleton`模式)两个关键类型来支持配置热更新。

```csharp
// 服务注册
public void ConfigureServices(IServiceCollection services)
{
    services.Configure<SnapshotSmapleOptions>(Configuration.GetSection(nameof(SnapshotSmapleOptions)));
    services.AddScoped<ISnapshotSmaple, SnapshotSmaple>(); //Scope 热更新

    services.Configure<MonitorSmapleOptions>(Configuration.GetSection(nameof(MonitorSmapleOptions)));
    services.AddSingleton<IMonitorSmaple, MonitorSmaple>(); //Singleton 热更新

    services.AddControllers();
}

//服务消费
public class HomeController : ControllerBase
{
    private ISnapshotSmaple _snapshot;
    private IMonitorSmaple _monitor;

    public HomeController(IOptionsSnapshot<ISnapshotSmaple> snapshotOptions,
        IOptionsMonitor<IMonitorSmaple> monitorOptions)
    {
        _snapshot = snapshotOptions.Value;
        _monitor = monitorOptions.CurrentValue;

        //监听变更
        monitorOptions.OnChange(listener =>
        {
            Console.WriteLine($"new value is {listener.Content}");
        });
    }
}
```

### 3.3 命名选项
我们知道在DI容器中注册多个同类型服务时可以通过服务集合遍历拿到所有同类型服务，当然也可以通过Autofac等框架实现同类型命名服务，而选项框架则不同，注册多个同类型的选项对象，后面注册的会覆盖前面注册的对象。

选项框提供了`IOptionsSnapshot<TOptions>`和`IOptionsMonitor<TOptions>`类型可以支持[命名选项](https://docs.microsoft.com/zh-cn/aspnet/core/fundamentals/configuration/options?view=aspnetcore-5.0#named-options-support-using-iconfigurenamedoptions)方式注册同类型配置，`IOptions<TOptions>`则不支持。

请考虑以下 appsettings.json 文件：
```json
{
  "TopItem": {
    "Month": {
      "Name": "Green Widget",
      "Model": "GW46"
    },
    "Year": {
      "Name": "Orange Gadget",
      "Model": "OG35"
    }
  }
}
```
下面的类用于每个节，而不是创建两个类来绑定`TopItem:Month`和`TopItem:Year`：
```csharp
public class TopItem
{
    public const string Month = "Month";
    public const string Year = "Year";

    public string Name { get; set; }
    public string Model { get; set; }
}
```
下面的代码将配置命名选项：
```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.Configure<TopItem>(TopItem.Month, Configuration.GetSection(TopItem.Month));
    services.Configure<TopItem>(TopItem.Year, Configuration.GetSection(TopItem.Year));
}
```
下面的代码将显示命名选项：
```csharp
public class TestNOModel : PageModel
{
    private readonly TopItem _monthTopItem;
    private readonly TopItem _yearTopItem;

    public TestNOModel(IOptionsSnapshot<TopItem> namedOptionsAccessor)
    {
        _monthTopItem = namedOptionsAccessor.Get(TopItem.Month);
        _yearTopItem = namedOptionsAccessor.Get(TopItem.Year);
    }
}
```

如果需要注入多个同类型服务，每个服务有各自不同的选项，通过简单命名选项方式是无法处理的，此时需要借助Autofac的命名服务注入。具体业务场景可以参考[OssHelper](https://github.com/colin-chang/OssHelper/blob/main/ColinChang.OssHelper.MultiBucket/MultiOssHelperExtensions.cs)案例，这里不再赘述。

## 4. 数据验证
我们可以通过以下三种方式来实现选项框架的数据验证：
* 注册验证函数
* 使用 `DataAnnotations`
* 实现 `IValidateOptions<TOptions>`

通过添加选项数据验证，我们可以在配置错误的情况下阻值应用程序启动，从而避免用户流量达到错误的节点上。

**启用数据验证时，如果仍需要支持配置热更新，则需要在服务注册前注册**`IOptionsChangeTokenSource<TOptions>`.


### 4.1 注册验证函数
```csharp
services.AddOptions<RedisHelperOptions>()
    .Configure(options => Configuration.Bind(options))
    // 注册验证函数
    .Validate(options => options.DbNumber < 0 || options.DbNumber >15, "DbNumber must be between 0 and 15");
```

### 4.2 DataAnnotations验证
```csharp
services.AddOptions<RedisHelperOptions>()
    .Configure(options => Configuration.Bind(options))
    // Attribute 验证
    .ValidateDataAnnotations();
//同时支持配置热更新
services.AddSingleton<IOptionsChangeTokenSource<RedisHelperOptions>>(
                new ConfigurationChangeTokenSource<RedisHelperOptions>(Configuration));


public class RedisHelperOptions
{
    public string ConnectionString { get; set; }

    [Range(0,15,ErrorMessage="DbNumber must be between 0 and 15")]
    public int DbNumber { get; set; }
}
```

### 4.3 自定义验证类
```csharp
services.AddOptions<RedisHelperOptions>()
    .Configure(options => Configuration.Bind(options))
    // 自定义验证服务
    .Services.AddSingleton<IValidateOptions<RedisHelperOptions>, RedisHelperValidateOptions>();

// 自定义验证类
public class RedisHelperValidateOptions : IValidateOptions<RedisHelperOptions>
{
    public ValidateOptionsResult Validate(string name, RedisHelperOptions options) =>
        (options.DbNumber < 0 || options.DbNumber > 15)
            ? ValidateOptionsResult.Fail("DbNumber must be greater than 0")
            : ValidateOptionsResult.Success;
}
```
