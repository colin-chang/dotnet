# 配置管理

.Net Core的配置框架有[`Microsoft.Extensions.Configuration`](https://www.nuget.org/packages/Microsoft.Extensions.Configuration)和[`Microsoft.Extensions.Configuration.Abstractions`](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.Abstractions)两个核心包，新版`Microsoft.AspNetCore.App`包中默认包含了以上Nuget包，所以Asp.Net Core应用管理配置不需要再额外引用相关Nuget包。

.Net Core 配置内容都是以 key-value 形式存在的，支持从多种不同数据源读取配置。

## 1. 命令行和内存配置
.Net Core程序读取命令行配置需要引用[`Microsoft.Extensions.Configuration.CommandLine`](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.CommandLine)Nuget包。

我们可以通过以下语法读取命令行和内存配置数据。
```csharp
static void Main(string[] args)
{
    var settings = new Dictionary<string, string>
    {
        {"name", "Colin"},
        {"age", "18"}
    };

    // 短命令替换
    var mapper= new Dictionary<string, string>{{"-n","name"}};

    var config = new ConfigurationBuilder() //实例化配置对象工厂
        .AddInMemoryCollection(settings) //使用内存集合配置
        .AddCommandLine(args, mapper) //使用命令行配置
        .Build(); //获取配置根对象

    //获取配置
    Console.WriteLine($"name:{config["name"]} \t age:{config["age"]}");
}
```

使用命令行配置时可以通过以下三种方式传参。
* 无前缀 `key=value` 格式
* 双中线前缀  `--key value` 或 `--key=value` 
* 斜杠前缀 `/key value` 或 `/key=value`
  $$
等号和空格分隔符不允许混用。命令替换常用于实现短命令效果，类似 `dotnet -h` 替换 `dotnet --help`

```sh 
dotnet run cmddemo                        # 输出 name:Colin   age:18
dotnet run cmddemo name=Colin age=18    # 输出 name:Colin   age:18
dotnet run cmddemo -n Robin --age 20    # 输出 name:Robin   age:20
```

由于`AddCommandLine()`在`AddInMemoryCollection()`之后，所以当命令行有参数时会覆盖内存配置信息。

## 2. 环境变量配置
在Docker容器中部署应用程序时，会大量使用环境变量配置应用程序。
Linux中不支持使用":"作为配置分层键，我们可以使用"__"代替。此外，环境变量配置还支持前缀加载。

.Net Core程序读取环境变量配置需要引用[`Microsoft.Extensions.Configuration.EnvironmentVariables`](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.EnvironmentVariables)Nuget包。

```json
{
  "profiles": {
    "ConfigurationDemo": {
      "commandName": "Project",
      "environmentVariables": {
        "title": "tm",
        "user__name": "Colin",
        "user__age": 18,
        "test_width": 32,
        "test_height": 32
      }
    }
  }
}
```

```csharp
static void Main(string[] args)
{
    var configurationRoot = new ConfigurationBuilder().AddEnvironmentVariables().Build();
    var title = configurationRoot["title"];
    var userName = configurationRoot.GetSection("user")["name"]; //分层

    // 前缀过滤
    var configurationRootWithPrefix = new ConfigurationBuilder().AddEnvironmentVariables("test_").Build();
    var width = configurationRootWithPrefix["width"];
    var height = configurationRootWithPrefix["height"];
}
```
*以上环境变量配置仅适用于Windows环境。*


## 3. 文件配置
日常开发中最常使用的是文件配置，而其中当属Json文件配置使用最为广泛。使用多配置文件时并存在同Key值配置时，后面的配置会覆盖前面的配置。

程序读取配置文件根据不同文件格式需要引用如下Nuget包：
* [`Microsoft.Extensions.Configuration.Json`](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.Json)
* [`Microsoft.Extensions.Configuration.NewtonsoftJson`](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.NewtonsoftJson)
* [`Microsoft.Extensions.Configuration.Ini`](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.Ini)
* [`Microsoft.Extensions.Configuration.Xml`](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.Xml)
* [`Microsoft.Extensions.Configuration.UserSecrets`](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.UserSecrets)

假定项目目录下有名为`appsettings.json`的配置文件，内容如下：
```json
{
  "AppName": "配置测试",
  "Class": {
    "ClassName": "三年二班",
    "Master": {
      "Name": "Colin",
      "Age": 25
    },
    "Students": [
      {
        "Name": "Robin",
        "Age": 20
      },
      {
        "Name": "Sean",
        "Age": 23
      }
    ]
  }
}
```
下面为`appsettings.ini`配置文件：
```ini
School=Beijing University
Address=Beijing
```

```csharp
static void Main(string[] args)
{
    var config = new ConfigurationBuilder()
        .AddJsonFile("appsettings.json")
        .AddIniFile("appsettings.ini")
        .Build();

        Console.WriteLine($"AppName:{config["AppName"]}");
        Console.WriteLine($"ClassName:{config["Class:ClassName"]}");
        Console.WriteLine($"Master:\r\nName:{config["Class:Master:Name"]}\tAge:{config["Class:Master:Age"]}");
        Console.WriteLine("Students:");
        Console.WriteLine($"Name:{config["Class:Students:0:Name"]}\tAge:{config["Class:Students:0:Age"]}");
        Console.WriteLine($"Name:{config["Class:Students:1:Name"]}\tAge:{config["Class:Students:1:Age"]}");
        Console.WriteLine($"School:{config["School"]}");
}
```

除了可以使用IConfiguration类型的索引器方式读取配置，还可以通过其`GetSection(string key)`方法读取配置。`GetSection()`方法返回类型为`IConfigurationSection`，可以链式编程方式读取多层配置。

```csharp
var clsName = config.GetSection("Class").GetSection("ClassName").Value; //clsName="三年二班"
```

## 4. 配置对象绑定

前面提到的配置读取方式只能读取到配置项的字符串格式的内容，遇到较为复杂的配置我们更期望配置信息可以映射为C#当中的一个对象。

我们为前面使用的配置文件定义实体类内容如下:
```csharp
public class Class
{
    public string ClassName { get; set; }
    public Master Master { get; set; }
    public IEnumerable<Student> Students { get; set; }
}
public abstract class Person
{
    public string Name { get; set; }
    public int Age { get; set; }
}
public class Master : Person{}
public class Student : Person{}
```

[Microsoft.Extensions.Configuration.Binder](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.Binder)为IConfiguration扩展了三个`Bind()`方法，其作用是尝试将给定的配置信息映射为一个对象。

### 4.1 .Net Core

```csharp
var cls = new Class();
config.Bind("Class",cls); // 执行完成后配置文件内容将映射到cls对象中
// config.Bind("Class",cls,options=>options.BindNonPublicProperties=true); // 通过设置binderOptions可以支持绑定私有属性
```

### 4.2 Asp.Net Core

Asp.Net Core中默认包含了需要的Nuget包，在`Startup.cs`中直接使用`Configuration.Bind()`即可获得配置映射的Class对象，如需在其他位置使用此配置对象，需要手动将其注册到服务列表中。
```csharp
public void ConfigureServices(IServiceCollection services)
{
    // other services ...

    var cls = new Class();
    Configuration.Bind("Class",cls);
    services.AddSingleton<Class>(cls); //服务注册
}
```


## 5. 自定义配置数据源
除了使用命令行、环境变量、文件等作为系统提供的配置源外，我们也可以自定义配置数据源，实现定制化配置方案。
自定义配置源只需要通过自定义类型实现`IConfigurationSource`接口，自定义Provider实`IConfigurationProvider`或集成其抽象实现类`ConfigurationProvider`即可。

```csharp
class ColinConfigurationSource : IConfigurationSource
{
    public IConfigurationProvider Build(IConfigurationBuilder builder)
    {
        return new ColinConfigurationProvider();
    }
}

class ColinConfigurationProvider : ConfigurationProvider
{
    private Timer _timer;

    public ColinConfigurationProvider()
    {
        _timer = new Timer {Interval = 3000};
        _timer.Elapsed += (s, e) => Load(true);
        _timer.Start();
    }

    public override void Load() => Load(false);

    private void Load(bool reload)
    {
        //模拟配置动态更新
        Data["LastUpdatedTime"] = DateTime.Now.ToString();
        if (reload)
            OnReload();
    }
}

// 在系统配置命名空间下扩展 AddColinConfiguration 方法，方便使用且可防止自定义配置类型暴露
namespace Microsoft.Extensions.Configuration
{
    public static class ColinConfigurationExtension
    {
        public static IConfigurationBuilder AddColinConfiguration(this IConfigurationBuilder builder)
        {
            builder.Add(new ColinConfigurationSource());
            return builder;
        }
    }
}
```
自定义配置源完成后，可以通过以下方式使用。
```csharp
static void Main(string[] args)
{
    var builder = new ConfigurationBuilder();
    builder.AddColinConfiguration(); //使用自定义配置源
    var configurationRoot = builder.Build();
    //Console.WriteLine(configurationRoot["LastUpdatedTime"]);

    ChangeToken.OnChange(
        () => configurationRoot.GetReloadToken(),
        () => Console.WriteLine(configurationRoot["LastUpdatedTime"]));

    Console.ReadKey();
}
```

以上代码已共享在Github: [https://github.com/colin-chang/CustomConfiguration](https://github.com/colin-chang/CustomConfiguration)

上面案例中我们只是演示了通过赋值一个DateTime来模拟配置源变更，在实际开发中我们可以设置从Consule等配置中心远程读取配置，结合命令行和环境变量配置，就可以完成配置中心的远程方案，这意味着我们可以版本化的管理应用程序配置，这也为Docker容器化部署提供了完善的配置管理方案。

## 6. 配置管理工具类封装
在Asp.Net Core程序中我们可以方便的使用配置，但在其它.Net Core应用中DI并未默认被引入，我们可以考虑配置文件读取操作封装为一个工具类。考虑到配置文件热更新问题对象映射我们采用Configure&lt;T&gt;方式处理。

代码已上传到Github，这里不再展开。
https://github.com/colin-chang/ConfigurationManager.Core

具体使用方式可以查看示例项目。
https://github.com/colin-chang/ConfigurationManager.Core/tree/master/ColinChang.ConfigurationManager.Sample

> 该帮助类已发布到Nuget

```sh
# Package Manager
Install-Package ColinChang.ConfigurationManager.Core 

# .NET CLI
dotnet add package ColinChang.ConfigurationManager.Core
```