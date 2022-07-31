# 文件提供程序

.Net为我们封装了一套文件操作接口，方便我们进行文件操作同时屏蔽底层文件操作实现细节，当然开发者也可以通过自定义实现接口来封装自己的文件提供程序。

`IFileProvider`构建了一套具有层次化目录结构的抽象文件系统，它提供了统一API来读取各种类型的文件，还能及时监控目标文件的变化。

## 1. 核心类型
.Net文件提供程序主要最常用的三个核心类型(`Microsoft.Extensions.FileProviders.Abstractions`)如下，其作用如字面含义，不作赘述。

* `IFileProvider`
* `IDirectoryContents`
* `IFileInfo`

```csharp
  public interface IFileProvider
  {
    /// <summary>获取指定文件信息.</summary>
    /// <param name="subpath">文件相对路径.</param>
    /// <returns>文件信息</returns>
    IFileInfo GetFileInfo(string subpath);

    /// <summary>枚举指定目录内容.</summary>
    /// <param name="subpath">目录相对路径.</param>
    /// <returns>目录内容.</returns>
    IDirectoryContents GetDirectoryContents(string subpath);
  }
```

.Net内置实现了以下三个文件提供程序，分别用于实现物理文件操作，应用程序内嵌文件操作和组合文件操作。组合文件操作用于处理多种文件源。
* `PhysicalFileProvider`(`Microsoft.Extensions.FileProviders.Physical`)
* `EmbeddedFileProvider`(`Microsoft.Extensions.FileProviders.Embedded`)
* `CompositeFileProvider`(`Microsoft.Extensions.FileProviders.Composite`)

## 2. 读取文件
```csharp
static async Task Main(string[] args)
{
    //物理文件提供程序
    var provider = new PhysicalFileProvider(AppDomain.CurrentDomain.BaseDirectory);
    //获取根目录内容
    var contents = provider.GetDirectoryContents("/");
    foreach (var file in contents)
    {
        //获取文件名
        if (Path.GetExtension(file.Name) != ".json")
            continue;

        //读取文件内容
        await using var stream = file.CreateReadStream();
        using var reader = new StreamReader(stream, Encoding.Default);
        Console.WriteLine(await reader.ReadToEndAsync());
        break;
    }
}
```

.Net文件提供程序把目录和文件都抽象为`IFileInfo`对象，该对象可能对应一个物理文件，也可能保存在数据库中，或者来源于网络，甚至有可能根本不存在，目录页仅仅是组织文件的逻辑容器。`IsDirectory`属性标识其是否为目录，`Exists`判断对象是否存在。只有当`IFileInfo`为文件时，`Length`,`CreateReadStream()`等成员才能使用。

当项目中文件`BuildAction`设置为`EmbeddedResource`时则可以使用`EmbeddedFileProvider`来进行文件操作。嵌入式文件项目文件内容形如：
```xml
<ItemGroup>
    <EmbeddedResource Include="test.txt" />
</ItemGroup>
```

组合文件提供程序可以将多个文件提供程序组合在一起如同一个目录一样进行文件操作。
```csharp
//物理文件提供程序
var provider1 = new PhysicalFileProvider(AppDomain.CurrentDomain.BaseDirectory);
//嵌入式文件提供程序
var provider2 = new EmbeddedFileProvider(Assembly.GetExecutingAssembly());
//组合文件提供程序
var provider = new CompositeFileProvider(provider1, provider2);

//获取组合根目录(物理和嵌入式两者根目录)内容
var contents = provider.GetDirectoryContents("/");
```

## 3. 监测文件更新

### 3.1 IChangeToken
[`IChangeToken`](https://docs.microsoft.com/zh-cn/aspnet/core/fundamentals/change-tokens?view=aspnetcore-5.0)对象就是一个与某组监控数据相关联的“令牌”，它能在监测到数据改变时及时对外发出通知。常用于监测并响应数据变化，如文件热更新，缓存更新自动刷新等。当`IChangeToken`对象关联的数据发生改变，它的`HasChanged`属性会变成`True`,我们可以调用其`RegisterChangeCallback`方法注册一个在数据发生变化时自动执行的回调，该方法返回一个`IDisposable`对象，可以用其`Dispose`方法解除注册的回调。`IChangeToken`的`ActiveChangeCallbacks`属性表示当数据改变时是否主动执行注册的回调操作。

```csharp
public interface IChangeToken
{
  // 接收一个指示是否发生更改的值
  bool HasChanged { get; }
  // 指示令牌是否主动引发回调
  bool ActiveChangeCallbacks { get; }
  // 注册在令牌更改时调用的回调
  IDisposable RegisterChangeCallback(Action<object> callback, object state);
}
```

### 3.2 CancellationChangeToken
.NET 提供了若干原生`IChangeToken`实现类型，其中最常使用的是一个名为`CancallationChangeToken`的实现。

```csharp{5,8}
var cts = new CancellationTokenSource();
//注册“取消”回调

//1. 使用CancellationChangeToken包装
//new CancellationChangeToken(cts.Token).RegisterChangeCallback(_ => Console.WriteLine($"{nameof(cts)} cancelled"), null);

//2. 直接使用CancellationToken注册回调
cts.Token.Register(() => Console.WriteLine($"{nameof(cts)} cancelled"));

//触发“取消”
cts.Cancel();
```

`CancellationChangeToken`是线程安全的，且它应用远不限于其字面含义可以用于监测取消操作，它可以用于响应任意资源变化，其实.Net中大部分的`IChangeToken`实现内部都使用了`CancellationTokenSource`，如`IFileProvider`用`Watch()`监测文件变化，其实际类型为`PollingFileChangeToken`。

更改令牌主要用于在 ASP.Net 中监视对象更改：
* 为了监视文件更改，`IFileProvider`的`Watch`方法将为要监视的指定文件或文件夹创建`IChangeToken`。
* 可以将`IChangeToken`令牌添加到缓存条目，以在更改时触发缓存逐出。
* 对于`TOptions`更改，`IOptionsMonitor<TOptions>`的默认`OptionsMonitor<TOptions>`实现有一个重载，可接受一个或多个 `IOptionsChangeTokenSource<TOptions>`实例。 每个实例返回`IChangeToken`，以注册用于跟踪选项更改的更改通知回调。

### 3.3 CompositeChangeToken
要在单个对象中表示多个`IChangeToken`实例，请使用`CompositeChangeToken`类。如果任何表示的令牌`HasChanged`为`true`，则复合令牌上的`HasChanged`报告`true`。 如果任何表示的令牌 `ActiveChangeCallbacks`为`true`，则复合令牌上的`ActiveChangeCallbacks`报告`true`。如果发生多个并发更改事件，则调用一次复合更改回调。

### 3.4 自定义 IChangeToken
如果`CancellationChangeToken`等无法满足开发者需要，或者开发者需要以更加合理的业务逻辑来编写代码时，可以自定义`IChangeToken`实现。

```csharp{3-5}
public static void Main()
{
    var uninstallChangeToken = new UninstallChangeToken("Wechat");
    uninstallChangeToken.RegisterChangeCallback(app => Console.WriteLine($"clean up {app}"));
    uninstallChangeToken.Uninstall();

    Console.ReadKey();
}

public class UninstallChangeToken : IChangeToken
{
    private readonly CancellationTokenSource _cts;
    private readonly string _app;

    public UninstallChangeToken(string app)
    {
        _cts = new();
        _app = app;
    }

    public bool HasChanged => _cts.IsCancellationRequested;
    public bool ActiveChangeCallbacks { get; } = true;

    public IDisposable RegisterChangeCallback(Action<object> callback, object state) =>
        _cts.Token.Register(callback, state);

    public IDisposable RegisterChangeCallback(Action<object> callback) =>
        RegisterChangeCallback(callback, _app);

    public void Uninstall()
    {
        //模拟业务
        if (string.IsNullOrWhiteSpace(_app))
            return;

        Console.WriteLine($"uninstalled {_app}");
        _cts.Cancel();
    }
}
```

如果大多数`IChangeToken`实现，我们也基于`CancellationChangeToken`自定义`IChangeToken`实现。

### 3.4 ChangeToken
`ChangeToken`则是一个封装了`IChangeToken`的静态类，它简化了`IChangeToken`的使用。`ChangeToken.OnChange(Func<IChangeToken>, Action)`方法注册令牌更改时要执行的操作。`OnChange`返回`IDisposable`,调用`Dispose`将使令牌停止侦听更多更改并释放令牌的资源。

### 3.5 监测文件更新
`IFileProvider`的`Watch`方法将为要监视的指定文件或文件夹创建`IChangeToken`。

```csharp
var provider = new PhysicalFileProvider(AppDomain.CurrentDomain.BaseDirectory);
var path = "test.txt";

//动态检测文件变化
var ct = ChangeToken.OnChange(() => provider.Watch(path), async () =>
{
    //文件变化后打印文件内容
    await using var stream = provider.GetFileInfo(path).CreateReadStream();
    using var reader = new StreamReader(stream, Encoding.Default);
    Console.WriteLine(await reader.ReadToEndAsync());
});

Console.ReadKey();
//停止侦听更改并释放令牌的资源
ct.Dispose();
```

## 4. 自定义文件系统
`PhysicalFileProvider`和`EmbeddedFileProvider`作为`IFileProvider`的系统实现，分别构建了一套物理文件系统与程序集内嵌文件系统，它们都是针对“本地”文件。

开发者也可以通过实现`IFileProvider`来自定义文件提供程序。比如自定义实现阿里云OSS文件提供程序可以将读取OSS文件操作变为如同读取本地目录一样简单，而文件提供程序使用者则无需关注其具体实现，只需注入对应文件提供程序对象即可实现读取任意位置文件。