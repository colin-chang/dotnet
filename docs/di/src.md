# Asp.Net 依赖注入源码分析

## 1. 程序启动DI源码解析

在[Asp.Net 依赖注入使用](aspnet.md)之“依赖注入在管道构建过程中的使用”中我们简单的介绍了DI在程序启动中的使用过程，接下来让我们从Asp.Net源码角度来深入探讨这一过程。

> 以下分析源码分析基于Asp.Net 2.1 <https://github.com/aspnet/AspNetCore/tree/release/2.1>

1）定位程序入口

```csharp
public static void Main(string[] args)
{
    CreateWebHostBuilder(args)
        .Build()
        .Run();
}

public static IWebHostBuilder CreateWebHostBuilder(string[] args) =>
    WebHost.CreateDefaultBuilder(args)
        .UseStartup<Startup>();
```

可以看到asp.Net程序实际上是一个控制台程序，运行一个`Webhost`对象从而启动一个一直运行的监听http请求的任务。

2）定位`IWebHostBuilder`实现，路径为src/Hosting/Hosting/src/WebHostBuilder.cs

![IWebHostBuilder实现](https://i.loli.net/2020/02/26/nlAvz6KjJoRSUpG.png)

3）通过上面的代码我们可以看到首先是通过`BuildCommonServices`来构建一个`ServiceCollection`。为什么说这么说呢，先让我们我们跳转到`BuidCommonServices`方法中看下吧。

![BuildCommonServices构建ServiceCollection](https://i.loli.net/2020/02/26/Rn5vt8h7i9Iorab.png)

通过`var services = new ServiceCollection();`创建了一个`ServiceCollection`然后往`services`里面注入很多内容，如：`WebHostOptions` ，`IHostingEnvironment` ，`IHttpContextFactory` ，`IMiddlewareFactory`等。最后这个`BuildCommonServices`就返回了这个`services`对象。

4）`UseStartup<Startup>()`。 在上面的`BuildCommonServices`方法中也有对`IStartup`的注入。首先，判断`Startup`类是否继承于`IStartup`接口，如果是继承的，那么就可以直接加入在`services` 里面去，如果不是继承的话，就需要通过`ConventionBasedStartup(methods)`把m`ethod`转换成`IStartUp`后注入到`services`里面去。结合上面我们的代码，貌似我们平时用的时候注入的方式都是采用后者。

5）回到`build`方法拿到了`BuildCommonServices`方法构建的`ServiceCollection`实例后，通过`GetProviderFromFactory(hostingServices)`方法构造出了`IServiceProvider` 对象。到目前为止，`IServiceCollection`和`IServiceProvider`都拿到了。然后根据`IServiceCollection`和`IServiceProvider`对象构建`WebHost`对象。构造了`WebHost`实例还不能直接返回，还需要通过`Initialize`对`WebHost`实例进行初始化操作。那我们看看在初始化函数`Initialize`中，都做了什么事情吧。

![WebHost](https://i.loli.net/2020/02/26/Q9th6Dn5FkeaVZb.png)

6）找到`src/Hosting/Hosting/src/Internal/WebHost.cs`的`Initialize`方法。如下图所示：主要就是一个`EnsureApplicationServices`方法。

![WebHost.Initialize](https://i.loli.net/2020/02/26/jqWCQM67w9uysE2.png)

7）`EnsureApplicationServices`内容如下：拿到`Startup` 对象，然后把`_applicationServiceCollection` 中的对象注入进去。

![EnsureApplicationServices](https://i.loli.net/2020/02/26/Tde1wQa9nouyg7c.png)

8）至此`build`中注册的对象以及`StartUp`中注册的对象都已经加入到依赖注入容器中了，接下来就是`Run`起来了。这个`run`的代码在`src\Hosting\Hosting\src\WebHostExtensions.cs`中，代码如下：

![WebHost.RunAsync](https://i.loli.net/2020/02/26/pxCqTulYrIfLDi1.png)

`WebHost`执行`RunAsync`运行web应用程序并返回一个只有在触发或关闭令牌时才完成的任务。这就是我们运行ASP.Net程序的时候，看到的那个命令行窗口了，如果不关闭窗口或者按`Ctrl+C`的话是无法结束的。

## 2. 配置文件DI

除了[Asp.Net 依赖注入使用](aspnet.html#2-依赖服务注册)中提到的服务注册方式。我们还可以通过配置文件进行对象注入。需要注意的是通过**读取配置文件注入的对象采用的是`Singleton`方式。**

### 2.1 配置文件DI基本使用

1）在`appsettings.json`里面加入如下内容

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Warning"
    }
  },
  "Author": {
    "Name":"Colin",
    "Nationality":"China"
  }
}
```

2）`Startup`类中`ConfigureServices`中注册`TOptions`对象

```csharp
services.Configure<Author>(Configuration.GetSection("Author"));//注册TOption实例对象
```

3）消费配置的服务对象,以`Controller`为例

```csharp
private readonly Author author;
public TestController(IOptions<Author> option)
{
    author = option.Value;
}
```

### 2.2 配置文件DI源码解析

1）在`Main`方法默认调用了`WebHost.CreateDefaultBuilder`方法创建了一个`IWebHost`对象，此方法加载了配置文件并使用一些默认的设置。

```csharp
public static void Main(string[] args)
{
    CreateWebHostBuilder(args)
        .Build()
        .Run();
}

public static IWebHostBuilder CreateWebHostBuilder(string[] args) =>
    WebHost.CreateDefaultBuilder(args)
        .UseStartup<Startup>();
```

2）在`src\MetaPackages\src\Microsoft.AspNetCore\WebHost.cs`中查看`CreateDefaultBuilder`方法源码如下。可以看到这个方法会在`ConfigureAppConfiguration` 的时候默认加载`appsetting`文件，并做一些初始的设置，所以我们不需要任何操作，就能加载`appsettings`的内容了。

![CreateDefaultBuilder](https://i.loli.net/2020/02/26/1NERpfLjOwGieDH.png)

3）**Asp.Net的配置文件是支持热更新的**，即不重启网站也能加载更新。如上图所示只需要在`AddJsonFile`方法中设置属性`reloadOnChange:true`即可。

> 参考文献：<https://www.cnblogs.com/yilezhu/p/9998021.html>
