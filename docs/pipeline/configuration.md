# 配置

当`IWebHostBuilder`对象被创建的时候，它会将当前的环境变量作为配置源来创建承载最初配置数据的`IConfiguration`对象，但它只会选择名称以`ASPNETCORE_`为前缀的环境变量。

## 1. 读取和修改键值对配置
`IConfiguration`对象是以字典的结构来存储配置数据的，该接口定义的索引可供我们以键值对的形式来读取和修改配置数据。在ASP.NET Core应用中，我们可以通过调用定义在`IWebHostBuilder`接口的`GetSetting`方法和`UseSetting`方法达到相同的目的。

```csharp{5-6}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .UseSetting("RedisHelper:ConnectionString", "connection_string")
            .UseSetting("RedisHelper:DbNumber", "0")
            .UseStartup<Startup>())
        .Build()
        .Run();
}
```

ASP.NET Core 框架自身的很多特性也都可以通过配置进行定制。例如，ASP.NET Core应用的服务器默认使用`launchSettings.json`文件定义的监听地址，但是我们可以通过修改配置采用其它的监听地址。

如果希望通过修改配置来控制ASP.NET Core框架的某些行为，就需要先知道对应的配置项的名称是什么。如端口和监听地址是通过名称为`urls`的配置项来控制的，如果记不住这个配置项的名称，也可以直接使用定义在`WebHostDefaults`中对应的只读属性`ServerUrlsKey`，该静态类型中还提供了其它一些预定义的配置项名称。

```csharp{5-6}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            // .UseSetting(WebHostDefaults.ServerUrlsKey, "http://0.0.0.0:8888")
            .UseUrls("http://0.0.0.0:8888")
            .UseStartup<Startup>())
        .Build()
        .Run();
}
```
除了调用`UseSetting`方法设置`urls`配置项来修改服务器的监听地址，直接调用`IWebHostBuilder`接口的`UseUrls`扩展方法也可以达到相同的目的。

## 2. 合并配置
在启动一个 ASP.NET Core应用时，我们可以自行创建一个承载配置的`IConfiguration`对象，并通过调用`IWebHostBuilder`接口的`UseConfiguration`扩展方法将它与应用自身的配置进行合并。如果应用自身存在重复的配置项，那么该配置项的值会被指定的`IConfiguration`对象覆盖。
```csharp{3-8,12}
public static void Main(string[] args)
{
    var configuration = new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string>
        {
            ["Foobar:Foo"] = "Foo",
            ["Foobar:Bar"] = "Bar"
        }).Build();

    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .UseConfiguration(configuration)   
            .UseStartup<Startup>())
        .Build()
        .Run();
}
```

## 3. 注册IConfigurationSource
配置系统最大的特点是可以注册不同的配置源。借助IWebHostBuilder接口的UseConfiguration扩展方法，虽然可以将利用配置系统提供的IConfiguration对象应用到ASP.NET Core程序中，但是这样的整合方式总显得不够彻底，更加理想的方式应该是可以直接在 ASP.NET Core 应用中注册IConfigurationSource。

针对 IConfigurationSource的注册可以调用 IWebHostBuilder接口的ConfigureAppConfiguration方法来完成，该方法与在 IHostBuilder 接口上定义的同名方法基本上是等效的。

```csharp{5-10}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureAppConfiguration(configuration => configuration.AddInMemoryCollection(
                new Dictionary<string, string>
                {
                    ["Foobar:Foo"] = "Foo",
                    ["Foobar:Bar"] = "Bar"
                }))
            .UseStartup<Startup>())
        .Build()
        .Run();
}
```