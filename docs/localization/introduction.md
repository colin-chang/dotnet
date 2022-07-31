# 本地化

如果要开发面向不同语种用户的网站，就不得不考虑本地化（`Localization`）和全球化（`Globalization`）的问题。本地化或者全球化涉及的范围很大，这里我们只关注语言选择的问题，即如何根据请求携带的语言文化信息来提供对应语言的字符串文本。这里主要涉及两个方面的功能实现：一是如何利用注册的中间件识别请求携带的语言文化信息，并利用它对当前执行上下文的语言文化属性进行定制；二是如何根据当前执行环境的语言文化属性来提供对应的字符串文本。

## 1. 本地化服务与中间件
.NET应用通常采用资源文件来存储针对多语言的资源，资源文件在.Net中得到了很好的传承。下面演示的实例将针对多语种的字符串文本存储在相应的资源文件中。我们提供两个同名的资源文件，`SharedResource.zh.resx`文件存储的是针对中文的字符串文本，而另一个不带任何语言文化扩展名的`SharedResource.resx`文件则用来存储“语言文化中性”的资源。

![本地化资源文件](https://i.loli.net/2021/03/30/zFyiceXd1tIEn7B.png)

我们以Asp.Net WebAPI项目为例演示项目本地化。我们调用`IServiceCollection`接口的 `AddLocalization`扩展方法注册与本地化相关的服务。针对当前线程语言文化属性的设置可以利用`RequestLocalizationMiddleware`中间件来完成。

```csharp{6-7,11-14,24-26,30}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services
                //注册本地化服务
                .AddLocalization()
                .AddRouting()
                .AddControllers())
            .Configure(app => app
                //自动设置语言文化
                .UseRequestLocalization(options => options
                    .AddSupportedCultures("en", "zh")
                    .AddSupportedUICultures("en", "zh"))
                .UseRouting().UseEndpoints(endpoints => endpoints.MapControllers())
            ))
        .Build().Run();
}

[ApiController]
[Route("[controller]")]
public class HomeController : ControllerBase
{
    private readonly IStringLocalizer _localizer;
    public HomeController(IStringLocalizerFactory localizerFactory) =>
        _localizer = localizerFactory.Create(nameof(SharedResource), nameof(WebDemo));

    [HttpGet]
    public async ValueTask<string> GetAsync() =>
        await ValueTask.FromResult(_localizer.GetString("Greeting"));
}
```

::: tip Culture 与 UICulture
通过`CultureInfo`表示语言文化是描述线程执行上下文的一项重要信息，它体现为`Thread`类型的`CurrentCulture`和`CurrentUICulture`的属性。一般来说，`UICulture`决定采用的语种，而数据类型（如数字、日期时间和货币等）的格式、类型转换、排序等行为规则由`Culture`决定。
:::

## 2. 设定语言文化
### 2.1 查询参数
我们可以通过名为`culture`的`query`参数来指定语言文化。通过`RequestLocalizationMiddleware`设置语言自动化后，请求没有匹配的语言文化时，会默认使用当前线程自动识别的语言文化，如当前语言为`zh`，请求`fr`时没有匹配则采用自动识别的`zh`语言。
![针对不同语言文化的响应](https://i.loli.net/2021/03/30/pKovt9n4QIHmDsy.png)

### 2.2 Accept-Language
针对本地化资源的请求除了可以采用查询字符串来指定语言文化，还可以通过设置`Accept-Language`请求头来指定语言文化。`Accept-Language`请求报文头表示客户端可以接受的语言，`RequestLocalizationMiddleware`在解析请求携带的语言文化信息时会将`Accept-Language`报头作为首选的来源。

![本地化Accept-Language设置](https://i.loli.net/2021/03/31/zUIxoVDJYgRHNaF.png)

### 2.3 Cookie
HTTP请求的语言文化还可以通过名称为`.AspNetCore.Culture`的`Cookie`的形式进行传递。已`c={Culture}|uic={UICulture}`的形式来指定`Culture`和`UICulture`即可。

![本地化Cookie设置](https://i.loli.net/2021/03/31/pwXjTYVSghCbKPa.png)

## 3. 资源文件管理
上面演示的这个实例试图将整个应用涉及的本地化文本统一存储在一个资源文件中，对于一个简单的应用程序来说，这没有什么问题，但一旦涉及过多的本地化文本，这种单一存储方式就很难维护。为了解决这个问题，我们需要对涉及的本地化文本进行分组，并将它们分散到不同的资源文件中。如果将针对资源文件的拆分做到极致，我们就可以将每个类型中使用的本地化文本定义在独立的资源文件中。

```csharp{6-7,11-14,20-25,30,33}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services
                //注册本地化服务
                .AddLocalization(options => options.ResourcesPath = "Resources")
                .AddRouting()
                .AddControllers())
            .Configure(app => app
                //自动设置语言文化
                .UseRequestLocalization(options => options
                    .AddSupportedCultures("en", "zh")
                    .AddSupportedUICultures("en", "zh"))
                .UseRouting().UseEndpoints(endpoints => endpoints.MapControllers())
            ))
        .Build().Run();
}

[ApiController]
public abstract class BaseController<T> : ControllerBase
{
    protected IStringLocalizer Localizer { get; }
    protected BaseController(IStringLocalizer<T> localizer) => Localizer = localizer;
}

[Route("[controller]")]
public class HomeController : BaseController<HomeController>
{
    public HomeController(IStringLocalizer<HomeController> localizer) : base(localizer) { }

    [HttpGet]
    public async ValueTask<string> GetAsync() => await ValueTask.FromResult(Localizer.GetString("Greeting"));
}

[Route("[controller]")]
public class TestController : BaseController<TestController>
{
    public TestController(IStringLocalizer<TestController> localizer) : base(localizer) { }

    [HttpGet]
    public async ValueTask<string> GetAsync() => await ValueTask.FromResult(Localizer.GetString("Greeting"));
}
```
为了便于管理我们统一将资源文件放到了`Resources`目录中，我们可以在`AddLocalization`注册本地化服务时配置目录(第7行)。建立资源文件时需要注意其命名要需要以`Controllers`开头。在项目中定义的`.resx`文件最终都会内嵌到编译后的程序集中，内嵌于程序集中的文件系统并没有目录的概念，所以`.resx`文件针对项目根目录的路径最终都体现在内嵌的文件名上。

![资源文件管理](https://i.loli.net/2021/03/31/YyVJ9WaHvNXrPmG.png)


## 4. 文本本地化模型
构成字符串本地化模型的 3 个接口/类型（`LocalizedString`、`IStringLocalizer` 和`IStringLocalizerFactory`）定义在 NuGet 包`Microsoft.Extensions.Localization.Abstractions`中。

![文本本地化模型的核心接口和类型以及它们之间的关系](https://i.loli.net/2021/03/31/F9eNPiOEKxwlR3j.png)

文本本地化模型通过 `LocalizedString` 类型来表示本地化字符串文本。`LocalizedString`对象由通过`IStringLocalizer`接口表示的字符串本地化器提供，`IStringLocalizerFactory`则表示创建或者提供 `IStringLocalizer` 对象的工厂。泛型的 `IStringLocalizer＜TResourceSource＞`接口表示与具体数据源关联的字符串本地化器，具体的数据源由作为泛型参数的`TResourceSource`类型来定位。作为对该接口默认实现的 `StringLocalizer＜TResourceSource＞`类型实际上是对另一个`IStringLocalizer` 对象的封装，后者由指定的 `IStringLocalizerFactory` 对象根据作为泛型参数的 `TResourceSource` 类型创建。
