# 配置框架

## 1. 框架基础
.NET Core 配置框架通过构建的额抽象配置魔心个弥补了不同配置数据源的差异，并在此基础上通过提供一致性的编程方式来读取配置数据。新的配置系统显得更加轻量级，并且具有更好的扩展性。

.NET Core的配置系统由如下图所示的三个核心对象构成。

![核心数据类型](https://i.loli.net/2021/03/22/xVErk94eMgjW18p.png)

在读取配置的时候，我们根据配置的定义方式（数据源）创建相应的IConfigurationSource对象，并将其注册到IConfigurationBuilder对象上。提供配置的最初来源可能不止一个，我们可以注册多个相同或者不同类型的IConfigurationSource对象到同一个IConfigurationBuilder对象上。IConfigurationBuilder对象正是利用注册的这些IConfigurationSource对象提供的数据构建出我们在程序中使用的IConfiguration对象。

虽然大部分情况下的配置从整体来说都具有结构化层次关系，但是“原子”配置项都以体现为最简单的“键值对”形式，并且键和值通常都是字符串。

## 2. 读取配置

.Net Core的配置框架有[`Microsoft.Extensions.Configuration`](https://www.nuget.org/packages/Microsoft.Extensions.Configuration)和[`Microsoft.Extensions.Configuration.Abstractions`](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.Abstractions)两个核心包，新版`Microsoft.AspNetCore.App`包中默认包含了以上Nuget包，所以Asp.Net Core应用管理配置不需要再额外引用相关Nuget包。

### 2.1 命令行和内存配置
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

### 2.2 环境变量配置
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


### 2.3 文件配置
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

除了可以使用`IConfiguration`类型的索引器方式读取配置，还可以通过其`GetSection(string key)`方法读取配置。`GetSection()`方法返回类型为`IConfigurationSection`，可以链式编程方式读取多层配置。

```csharp
var clsName = config.GetSection("Class").GetSection("ClassName").Value; //clsName="三年二班"
```

## 3. 配置对象绑定

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

### 3.1 .Net Core

```csharp
var cls0 = new Class();
config.Bind("Class",cls0); // 执行完成后配置文件内容将映射到cls对象中
// config.Bind("Class",cls,options=>options.BindNonPublicProperties=true); // 通过设置binderOptions可以支持绑定私有属性

var cls1 = config.GetSection("Class").Get<Class>();
```

### 3.2 Asp.Net Core

Asp.Net Core中默认包含了需要的Nuget包，在`Startup.cs`中直接使用`Configuration.Bind()`即可获得配置映射的Class对象。
```csharp
public void ConfigureServices(IServiceCollection services)
{
    // other services ...

    var cls0 = new Class();
    Configuration.Bind("Class",cls);

    var cls1= Configuration.GetSection("Class").Get<Class>();
}
```

## 4. 自定义配置数据源
除了使用命令行、环境变量、文件等作为系统提供的配置源外，我们也可以自定义配置数据源，实现定制化配置方案。
自定义配置源只需要通过自定义类型实现`IConfigurationSource`接口，自定义`Provider`实`IConfigurationProvider`或集成其抽象实现类`ConfigurationProvider`即可。

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

上面案例中我们只是演示了通过赋值一个`DateTime`来模拟配置源变更，在实际开发中我们可以设置从`Consule`等配置中心远程读取配置，结合命令行和环境变量配置，就可以完成配置中心的远程方案，这意味着我们可以版本化的管理应用程序配置，这也为Docker容器化部署提供了完善的配置管理方案。