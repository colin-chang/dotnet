# 路由

借助路由系统提供的请求URL模式与对应终结点（`Endpoint`）之间的映射关系，我们可以将具有相同 URL 模式的请求分发给应用的终结点进行处理。ASP.NETCore的路由是通过`EndpointRoutingMiddleware`和`EndpointMiddleware`这两个中间件协作完成的，它们在ASP.Net平台上具有举足轻重的地位，因为ASP.Net MVC框架就建立在这个中间件之上。

## 1. 路由映射

### 1.1 终结点

一个 Web 应用本质上体现为一组终结点(`Endpoint`)的集合。终结点则体现为一个暴露在网络中可供外界采用 HTTP 协议调用的服务(MVC框架中体现为`Controller`中一个`Action`方法)，路由的作用就是建立一个请求 URL 模式与对应终结点之间的映射关系。借助这个映射关系，客户端可以采用模式匹配的URL来调用对应的终结点。

![路由终结点映射](https://i.loli.net/2021/03/28/Ae8QuaUI1v2LCpg.png)

利用映射关系对请求进行路由解析，然后选择并执行与之匹配的终结点的工作过程称为“入栈路由”，反之路由系统还可以根据指定的路由参数和URL模式和生成一个完整的URL，此过程称为“出栈路由”，两者路由方向相反。

![终结点](https://i.loli.net/2021/03/28/wYbVlX5fWDzNu8S.png)

之所以将应用划分为若干不同的终结点，是因为不同的终结点具有不同的请求处理方式。ASP.Net应用可以利用`RequestDelegate`对象来表示HTTP请求处理器，每个终结点都封装了一个`RequestDelegate`对象并用它来处理路由给它的请求。如上图所示，除了请求处理器，终结点还提供了一个用来存放元数据的容器，路由过程中的很多行为都可以通过相应的元数据来控制。

一般来说，当我们调用`IApplicationBuilder`接口的`UseEndpoints`扩展方法注册`EndpointMiddleware`中间件时，会利用提供的`Action<IEndpointRouteBuilder>`委托对象注册所需的`EndpointDataSource`对象。`IEndpointRouteBuilder`接口具有一系列的`Map`扩展方法，这些方法可以帮助我们注册所需的终结点。

### 1.2 中间件

ASP.Net针对终结点的路由是由`EndpointRoutingMiddleware`和`EndpointMiddleware`这两个中间件协同完成的。这两个中间件类型都定义在 NuGet包`Microsoft.AspNetCore.Routing`中。应用在启动之前会注册若干表示终结点的`Endpoint`对象（具体来说是包含路由模式的`RouteEndpoint`对象）。

![路由中间件](https://i.loli.net/2021/03/28/U3goczF5M4R1AQr.png)

当应用接收到请求并创建`HttpContext`上下文之后，`EndpointRoutingMiddleware`中间件会根据请求的URL及其它相关信息从注册的终结点中选择匹配度最高的那个。之后被选择的终结点会以一个特性（`IEndpointFeature`）的形式附加到当前`HttpContext`上下文中。我们通常使用`IApplicationBuilder`的`UseRouting`扩展方法注册`EndpointRoutingMiddleware`中间件。`EndpointMiddleware`中间件的职责特别明确，就是执行由`EndpointRoutingMiddleware`中间件附加到当前`HttpContext`上下文中的终结点。我们一般使用`IApplicationBuilder`的`UseREndPoints`扩展方法注册`EndpointMiddleware`中间件。由于路由中间件在进行路由解析过程中需要使用一些服务，所以可以调用`IServiceCollection`的`AddRouting`扩展方法来对它们进行注册。

```csharp
app.UseRouting();
app.UseEndpoints(endpoints => endpoints.MapGet("/", async context => await context.Response.WriteAsync("Hello World!")));
```

### 1.3 路由案例

这是一个简易版的天气预报站点。如果用户希望获取某个城市在未来N天之内的天气信息。**路由不区分大小写。**

```csharp{5-9,16-18}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services.AddRouting())
            .Configure(app => app
                .UseRouting()
                .UseEndpoints(endpoints => endpoints.MapGet("weather/{city}/{days}", QueryWeatherAsync))
            ))
        .Build()
        .Run();
}

private static async Task QueryWeatherAsync(HttpContext context)
{
    var routeParams = context.GetRouteData().Values;
    var city = routeParams.TryGetValue("city", out var c) ? c as string : "010";
    var days = !routeParams.TryGetValue("days", out var daysStr) ? 1 : int.TryParse(daysStr?.ToString(), out var d) ? d : 1;

    await context.RendWeatherAsync(new WeatherReport(city, days));
}
```

定义`WeatherReport`随机生成某个城市某段时间内的天气。此处仅作演示之用读者无需关心其具体逻辑。

```csharp
public class WeatherReport
{
    private static readonly string[] Conditions = {"晴", "多云", "小雨"};
    private static readonly Random Random = new();

    public static readonly Dictionary<string, string> Cities = new()
    {
        ["010"] = "北京",
        ["028"] = "成都",
        ["0512"] = "苏州"
    };

    public string City { get; }
    public IDictionary<DateTime, WeatherInfo> WeatherInfos { get; }

    public WeatherReport(string city, int days)
    {
        if (!Cities.ContainsKey(city))
            return;

        City = city;
        WeatherInfos = new Dictionary<DateTime, WeatherInfo>();
        for (var i = 0; i < days; i++)
        {
            WeatherInfos[DateTime.Today.AddDays(i + 1)] = new WeatherInfo
            {
                Condition = Conditions[Random.Next(0, 2)],
                HighTemperature = Random.Next(20, 30),
                LowTemperature = Random.Next(10, 20)
            };
        }
    }

    public WeatherReport(string city, DateTime date)
    {
        City = city;
        WeatherInfos = new Dictionary<DateTime, WeatherInfo>
        {
            [date] = new()
            {
                Condition = Conditions[Random.Next(0, 2)],
                HighTemperature = Random.Next(20, 30),
                LowTemperature = Random.Next(10, 20)
            }
        };
    }

    public class WeatherInfo
    {
        public string Condition { get; set; }
        public double HighTemperature { get; set; }
        public double LowTemperature { get; set; }
    }
}

public static class WeatherReportExtensions
{
    public static async Task RendWeatherAsync(this HttpContext context, WeatherReport report)
    {
        context.Response.ContentType = "text/html;charset=utf-8";
        var sb = new StringBuilder($"<html><head><title>Weather</title></head><body><h3>{report.City}</h3>");
        foreach (var (date, weather) in report.WeatherInfos)
            sb.Append($"<p>{date:yyyy-MM-dd}:{weather.Condition}({weather.LowTemperature}℃ ~ {weather.HighTemperature}℃)</p>");
        sb.Append("</body></html>");
        await context.Response.WriteAsync(sb.ToString());
    }
}
```

直接利用浏览器发送一个GET请求并将对应城市（采用电话区号表示）和天数设置在URL中。请求`weather/010/2`与路由模板`weather/{city}/{days}`匹配，所以被映射到`QueryWeatherAsync`终结点处理，`QueryWeatherAsync`解析路由参数并据其查询对应天气情况最终返回结果如下图所示。

![路由案例](https://i.loli.net/2021/03/28/B6iHWbOMFkpfetn.png)

## 2. 路由约束

上面示例中路由模板中定义的两个参数`{city}`和`{days}`未做任何约束，当请求类似`/weather/011/abc`等带有非法路由参数时客户端将接收到一个状态为`500 Internal Server Error`的响应。

为了确保路由参数值的有效性，在进行路由注册时可以采用内联（`Inline`）的方式直接将相应的约束规则定义在路由模板中。下面代码约束了`city`是必须以0开头的三倒四位数字，`days`则必须是一到四之间的整数。如果URL中路由参数不满足约束条件客户端将接收到一个状态码为`404 Not Found`的响应。

```csharp{8}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services.AddRouting())
            .Configure(app => app
                .UseRouting()
                .UseEndpoints(endpoints => endpoints.MapGet(@"weather/{city:regex(^0\d{{2,3}}$)}/{days:int:range(1,4)}", QueryWeatherAsync))
            ))
        .Build()
        .Run();
}
```

路由系统采用`IRouteConstraint`接口来表示路由约束，该接口具有唯一的`Match`方法，该方法用来验证URL携带的参数值是否有效。针对路由参数约束的检验同时应用在入栈路由和出栈路由两个路由方向上。路由系统定义了一系列原生的`IRouteConstraint`实现类型，我们可以使用它们解决很多常见的约束问题。我们可以根据需要为某个路由参数指定一个或者多个约束表达式。

内联约束|`IRouteConstraint`类型|说明
:-|:-|:-
`int` | `IntRouteConstraint` | 要求路由参数值能够解析为一个int整数，如`{variable:int}`
`bool` | `BoolRouteConstraint` | 要求参数值可以解析为一个bool值，如`{variable:bool}`
`datetime` | `DateTimeRouteConstraint` | 要求参数值可以解析为一个DateTime对象（采用CultureInfo. InvariantCulture进行解析），如`{variable:datetime}`
`decimal` | `DecimalRouteConstraint` | 要求参数值可以解析为一个decimal数字，如`{variable:decimal}`
`double` | `DoubleRouteConstraint` | 要求参数值可以解析为一个double数字，如`{variable:double}`
`float` | `FloatRouteConstraint` | 要求参数值可以解析为一个float数字，如`{variable:float}`
`guid` | `GuidRouteConstraint` | 要求参数值可以解析为一个Guid，如`{variable:guid}`
`long` | `LongRouteConstraint` | 要求参数值可以解析为一个long整数，如`{variable:long}`
`minlength` | `MinLengthRouteConstraint` | 要求参数值表示的字符串不小于指定的长度，如`{variable:minlength(5)}`
`maxlength` | `MaxLengthRouteConstraint` | 要求参数值表示的字符串不大于指定的长度，如`{variable:maxlength(10)}`
`length` | `LengthRouteConstraint` | 要求参数值表示的字符串长度限于指定的区间范围，如`{variable:length(5,10)}`
`min` | `MinRouteConstraint` | 最小值，如`{variable:min(5)}`
`max` | `MaxRouteConstraint` | 最大值，如`{variable:max(10)}`
`range` | `RangeRouteConstraint` | 要求参数值介于指定的区间范围，如`{variable:range(5,10)}`
`alpha` | `AlphaRouteConstraint` | 要求参数的所有字符都是字母，如`{variable:alpha}`
`regex` | `RegexInlineRouteConstraint` | 要求参数值表示的字符串与指定的正则表达式相匹配，如`{variable:regex(^\w+$)}`
`required` | `RequiredRouteConstraint` | 要求参数值不应该是一个空字符串，如`{variable:required}`
`file` | `FileNameRouteConstraint` | 要求参数值可以作为一个包含扩展名的文件名，如`{variable:file}`
`nonfile` | `NonFileNameRouteConstraint` | 与`FileNameRouteConstraint`刚好相反，这两个约束类型旨在区分针对静态文件的请求

如果现有的`IRouteConstraint`实现类型无法满足某些特殊的约束需求，我们也可以通过实现`IRouteConstraint`接口创建自定义的约束类型，这里不再演示。

## 3. 路由参数

路由注册时提供的路由模板（如`weather/{city}/{days}`）可以包含静态的字符（如`weather`），也可以包含动态的参数（如`{city}`和`{days}`），我们将后者称为路由参数。

### 3.1 默认路由参数

并非所有路由参数都是必需的，有的路由参数是可空的，我们称为默认路由参数。在路由参数名后面添加一个问号(`？`)将原本必需的路由参数变成可以默认的。**默认的路由参数只能出现在路由模板尾部**。默认路由参数可以在路由模板中直接设置默认值。

```csharp{8}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services.AddRouting())
            .Configure(app => app
                .UseRouting()
                .UseEndpoints(endpoints => endpoints.MapGet(@"weather/{city=010}/{days?}", QueryWeatherAsync))
            ))
        .Build()
        .Run();
}
```

使用以上路由模板时常见请求结果如下：

* `/weather` -> 北京 1天
* `/weather/028` -> 成都 1天
* `/weather/0512/2` -> 苏州 2天

### 3.2 特殊路由参数

一个 URL 可以通过分隔符“/”划分为多个路径分段（`Segment`），路由模板中定义的路由参数一般来说会占据某个独立的分段（如`weather/{city}/{days}`）。但也有例外情况，我们既可以在一个单独的路径分段中定义多个路由参数，也可以让一个路由参数跨越多个连续的路径分段。

假设设计一种路径模式来获取某个城市某一天的天气信息，如`/weather/010/2021.3.20`这样一个URL可以获取北京在2021年3月20日的天气，那么路由模板为`/weather/{city}/{year}.{month}.{day}`。

```csharp{9}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services.AddRouting())
            .Configure(app => app
                .UseRouting()
                .UseEndpoints(endpoints =>
                    endpoints.MapGet(@"weather/{city}/{year}.{month}.{day}", QueryWeatherAsync))
            ))
        .Build()
        .Run();
}

private static async Task QueryWeatherAsync(HttpContext context)
{
    var routeParams = context.GetRouteData().Values;
    var city = routeParams.TryGetValue("city", out var c) ? c as string : "010";
    var year = !routeParams.TryGetValue("year", out var yearStr) ? DateTime.Today.Year : int.TryParse(yearStr?.ToString(), out var y) ? y : DateTime.Today.Year;
    var month = !routeParams.TryGetValue("month", out var monthStr) ? DateTime.Today.Month : int.TryParse(monthStr?.ToString(), out var m) ? m : DateTime.Today.Month;
    var day = !routeParams.TryGetValue("day", out var dayStr) ? DateTime.Today.Day : int.TryParse(dayStr?.ToString(), out var d) ? d : DateTime.Today.Day;
    
    await context.RendWeatherAsync(new WeatherReport(city, new DateTime(year, month, day)));
}
```

对于上面设计的这个 URL 来说，我们采用`.`作为日期分隔符，如果采用`/`作为日期分隔符（如 `2021/3/20`），这个路由默认应该如何定义？由于`/`也是路径分隔符，如果表示日期的路由变量也采用相同的分隔符，就意味着同一个路由参数跨越了多个路径分段，我们只能采用定义“通配符”的形式来达到这个目的。通配符路由参数采用`{*variable}`或者`{**variable}`的形式，`*`表示路径“余下的部分”，所以**通配符路由参数只能出现在模板的尾端**。对我们的实例来说，路由模板可以定义成`/weather/{city}/{*date}`。

```csharp{9}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services.AddRouting())
            .Configure(app => app
                .UseRouting()
                .UseEndpoints(endpoints =>
                    endpoints.MapGet(@"weather/{city}/{*date}", QueryWeatherAsync))
            ))
        .Build()
        .Run();
}

private static async Task QueryWeatherAsync(HttpContext context)
{
    var routeParams = context.GetRouteData().Values;
    var city = routeParams.TryGetValue("city", out var c) ? c as string : "010";

    var date = DateTime.Today;
    if (routeParams.TryGetValue("date", out var d))
    {
        if (DateTime.TryParse(d as string, out var dt))
            date = dt;
    }

    await context.RendWeatherAsync(new WeatherReport(city, date));
}
```

## 4. MVC路由

Asp.Net 应用在`Startup`中默认使用以上代码注册了两个路由中间件，且在默认在框架中调用了`AddRouting`注入了路由相关服务，Asp.Net MVC应用则通过`IEndpointRouteBuilder`的`MapControllers`扩展方法注入MVC自定义路由终结点，通过`IServicesCollection`的`AddControllers`扩展方法注入控制器服务。

### 4.1 RouteAttribute

WebAPI中必须为每个`Controller`使用`[Route]`特性进行路由设定，而不能通过`UseMvc`中定义的传统路由或通过`Startup.Configure`中的`UseMvcWithDefaultRoute`配置路由。

与`Controller`设定路由方式一样，我们也可以在`Action`方法上使用`[Route]`单独设定路由，除了`[Route]`，我们也可以使用`HttpMethodAttribute`设定路由，用法相同，`HttpMethodAttribute`包括`[HttpGet]`、`[HttpPost]`、`[HttpPut]`、`[HttpDelete]`等。`Action`路由建立在`Controller`路由之上。

使用`HttpMethodAttribute`定义路由时会同时限制`Action`方法的`HTTP`访问方式，如果单纯想为`Action`方法设定路由同时允许多种HTTP访问方式，可以是使用`[Route]`配置路由。

```csharp{1,5,8-9,12-13,16-17}
[Route("api/test")]
public class TestController : ControllerBase
{
    // GET api/test
    [HttpGet]
    public ActionResult<string> Get() => nameof(Get);

    //GET api/test/1
    [HttpGet("{id}")]
    public ActionResult<string> Get(int id) => nameof(Get) + id;

    //GET api/test/getbyname/colin
    [HttpGet("GetByName/{name?}")]
    public ActionResult<string> Get(string name) => "GetByName" + name;

    //GET api/test/colin/18
    [HttpGet("{name}/{age}")]
    public ActionResult<string> Get(string name,int age) => nameof(Get) + name + age;
}
```

### 4.2 路由规则

#### 4.2.1 Restful 路由

WebAPI默认路由使用`Restful`风格,按照请求方式进行路由，不作标记的情况下，`Action`方法名会按照请求方式进行`StartWith`匹配。所以的`Get()`、`GetById()`、`GetXXX()`没有任何区别。如果使用`[HttpGet]`标记了`Action`方法，则方法名任意取，不必以`GET`开头。同理，`POST`、`PUT`、`DELETE`亦是如此。

完全符合`Restful`风格的API在很多业务常见下并不能满足需求。如之前所说，把所有业务抽象为CRUD操作并不现实，简单通过HTTP状态码也不容易区分处理结果。除此之外，仅通过简单几种谓词语意进行路由在难以满足复杂业务需求。如，根据ID查询用户、根据用户名查询用户、根据手机号查询用户。

```csharp
// 错误方式，调用报错
[Route("api/test")]
public class TestController : ControllerBase
{
    [HttpGet("{id}")]
    public ActionResult<User> GetById(int id)
    {
        return Users.FirstOrDefault(u=>u.Id==id);
    }

    [HttpGet("{userName}")]
    public ActionResult<User> GetByUserName(string userName)
    {
        return Users.FirstOrDefault(u=>u.UserName==userName);
    }

    [HttpGet("{phoneNumber}")]
    public ActionResult<User> GetByPhoneNumber(string phoneNumber)
    {
        return Users.FirstOrDefault(u=>u.PhoneNumber==phoneNumber);
    }
}
```

以上代码可以编译通过，但由于三个`Action`匹配相同路由规则，所以`GET`请求`~/api/test/xxx` 时会出现歧义而抛出`AmbiguousMatchException`。

#### 4.2.2 自定义路由

此时我们可以通过前面提到的[`RouteAttribute`或`HttpMethodAttribute`](#_1-routeattribute)来为每个`Action`设置特定路由。

```csharp
// 自定义Action路由
[Route("api/test")]
public class TestController : ControllerBase
{
    //GET api/test/getbyid/1
    [HttpGet("GetById/{id}")]
    public ActionResult<User> GetById(int id) => Users.FirstOrDefault(u=>u.Id==id);
    
    //GET api/test/getbyusername/colin
    [HttpGet("GetByUserName/{userName}")]
    public ActionResult<User> GetByUserName(string userName) => Users.FirstOrDefault(u=>u.UserName==userName);

    //GET api/test/getbyphonenumber/110
    [HttpGet("GetByPhoneNumber/{phoneNumber}")]
    public ActionResult<User> GetByPhoneNumber(string phoneNumber) => Users.FirstOrDefault(u=>u.PhoneNumber==phoneNumber);
}
```

#### 4.2.3 回归MVC路由

以上为每个`Action`单独配置路由后解决了`Restful`遇到的问题。不难发现当每个`Action`方法路由名称恰好是自身方法名时，我们便可以通过`Action`名称来访问对应接口，这与`MVC`路由方式效果一致。

单独为每个`Action`方法都配置路由较为繁琐，我们可以仿照`MVC`路由方式直接配置Controller路由，路由效果一致，但使用跟简单。

```csharp
// 自定义Controller路由

[Route("api/test/{Action}")]
public class TestController : ControllerBase
{
    //GET api/test/getbyid/1
    [HttpGet("{id?}")]
    public ActionResult<User> GetById(int id) => Users.FirstOrDefault(u=>u.Id==id);

    //GET/POST/PUT/DELETE api/test/getbyusername/colin
    [Route("{userName}")]
    public ActionResult<User> GetByUserName(string userName) => Users.FirstOrDefault(u=>u.UserName==userName);

    //GET api/test/getbyphonenumber?phoneNumber=110
    [HttpGet]
    public ActionResult<User> GetByPhoneNumber(string phoneNumber) => Users.FirstOrDefault(u=>u.PhoneNumber==phoneNumber);
}
```

`Restful`风格路由与MVC路由只是匹配`Action`方法方式不同，MVC路由通过`Action`方法名定位要比`Restful`通过谓词语意定位更加多变，更容易应付复杂的业务场景。

### 4.3 路由约束

在定义路由时我们可以声明路由约束，常见路由约束有 非空约束、类型约束、范围数据、正则约束和自定义约束等。Web请求不符合路由约束时会得到404状态码。

```csharp
[ApiController]
[Route("[controller]")]
public class TestController : ControllerBase
{
    //非空约束
    [HttpGet("test0/{name:required}")]
    public Task<string> GetAsync(string name) => Task.FromResult($"Hello {name}");

    //最大值约束
    [HttpGet("test1/{age:max(120)}")]
    public Task<int> GetAsync(int age) => Task.FromResult(age);

    //正则约束
    [HttpGet(@"test2/{postcode:regex(^\d{{6}}$)}")]
    public Task<long> GetAsync(long postcode) => Task.FromResult(postcode);

    //自定义约束
    [HttpGet("test3/{ok:CustomRoutConstraint}")]
    public Task<bool> GetAsync([FromRoute]bool ok) => Task.FromResult(ok);
}
```

自定义约束定义如下：

```csharp
public class CustomRoutConstraint : IRouteConstraint
{
    public bool Match(HttpContext httpContext, IRouter route, string routeKey, RouteValueDictionary values,
        RouteDirection routeDirection)
    {
        if (routeDirection == RouteDirection.UrlGeneration)
            return false;

        var val = values[routeKey];
        return bool.TryParse(val.ToString(), out _);
    }
}
```

自定义约束注入：

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddControllers();

    //注入自定义路由约束
    services.AddRouting(options =>
        options.ConstraintMap.Add(nameof(CustomRoutConstraint), typeof(CustomRoutConstraint)));
}
```

### 4.4 LinkGenerator

除了将URL匹配到对应`Action`方法外，路由还可以根据参数生成URL地址等。

```csharp
[HttpGet("test4")]
public Task<object> GetAsync([FromServices] LinkGenerator generator)
{
    //根据路由参数，生成Path和Url
    var path = generator.GetPathByAction(HttpContext, "Get", "Test", new {name = "Colin"});
    var url = generator.GetUriByAction(HttpContext, "Get", "Test", new {name = "Colin"});

    return Task.FromResult<object>(new {RequrestPath = path, RequestUrl = url});
}
```
