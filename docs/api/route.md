# 路由

## 1. RouteAttribute
WebAPI中必须为每个`Controller`使用`[Route]`特性进行路由设定，而不能通过`UseMvc`中定义的传统路由或通过`Startup.Configure`中的`UseMvcWithDefaultRoute`配置路由。

与`Controller`设定路由方式一样，我们也可以在`Action`方法上使用`[Route]`单独设定路由，除了`[Route]`，我们也可以使用`HttpMethodAttribute`设定路由，用法相同，`HttpMethodAttribute`包括`[HttpGet]`、`[HttpPost]`、`[HttpPut]`、`[HttpDelete]`等。`Action`路由建立在`Controller`路由之上。

使用`HttpMethodAttribute`定义路由时会同时限制`Action`方法的`HTTP`访问方式，如果单纯想为`Action`方法设定路由同时允许多种HTTP访问方式，可以是使用`[Route]`配置路由。

路由不区分大小写。

```csharp
[Route("api/test")]
public class TestController : ControllerBase
{
    // GET api/test
    [HttpGet]
    public ActionResult<string> Get()
    {
        return nameof(Get);
    }

    //GET api/test/1
    [HttpGet("{id}")]
    public ActionResult<string> Get(int id)
    {
        return nameof(Get) + id;
    }

    //GET api/test/getbyname/colin
    [HttpGet("GetByName/{name?}")]
    public ActionResult<string> Get(string name)
    {
        return "GetByName" + name;
    }

    //GET api/test/colin/18
    [HttpGet("{name}/{age}")]
    public ActionResult<string> Get(string name,int age)
    {
        return nameof(Get) + name + age;
    }
}
```

## 2. 路由规则
## 2.1 Restful 路由
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

### 2.2 自定义路由
此时我们可以通过前面提到的[`RouteAttribute`或`HttpMethodAttribute`](#_1-routeattribute)来为每个`Action`设置特定路由。
```csharp
// 自定义Action路由
[Route("api/test")]
public class TestController : ControllerBase
{
    //GET api/test/getbyid/1
    [HttpGet("GetById/{id}")]
    public ActionResult<User> GetById(int id)
    {
        return Users.FirstOrDefault(u=>u.Id==id);
    }
    
    //GET api/test/getbyusername/colin
    [HttpGet("GetByUserName/{userName}")]
    public ActionResult<User> GetByUserName(string userName)
    {
        return Users.FirstOrDefault(u=>u.UserName==userName);
    }

    //GET api/test/getbyphonenumber/110
    [HttpGet("GetByPhoneNumber/{phoneNumber}")]
    public ActionResult<User> GetByPhoneNumber(string phoneNumber)
    {
        return Users.FirstOrDefault(u=>u.PhoneNumber==phoneNumber);
    }
}
```

### 2.3 回归MVC路由
以上为每个`Action`单独配置路由后解决了`Restful`遇到的问题。不难发现当每个`Action`方法路由名称恰好是自身方法名时，我们便可以通过`Action`名称来访问对应接口，这与`MVC`路由方式效果一致。

单独为每个`Action`方法都配置路由较为繁琐，我们可以仿照`MVC`路由方式直接配置Controller路由，路由效果一致，但使用跟简单。

```csharp
// 自定义Controller路由

[Route("api/test/{Action}")]
public class TestController : ControllerBase
{
    //GET api/test/getbyid/1
    [HttpGet("{id?}")]
    public ActionResult<User> GetById(int id)
    {
        return Users.FirstOrDefault(u=>u.Id==id);
    }

    //GET/POST/PUT/DELETE api/test/getbyusername/colin
    [Route("{userName}")]
    public ActionResult<User> GetByUserName(string userName)
    {
        return Users.FirstOrDefault(u=>u.UserName==userName);
    }

    //GET api/test/getbyphonenumber?phoneNumber=110
    [HttpGet]
    public ActionResult<User> GetByPhoneNumber(string phoneNumber)
    {
        return Users.FirstOrDefault(u=>u.PhoneNumber==phoneNumber);
    }
}
```
`Restful`风格路由与MVC路由只是匹配`Action`方法方式不同，MVC路由通过`Action`方法名定位要比`Restful`通过谓词语意定位更加多变，更容易应付复杂的业务场景。

## 3. 路由约束
在定义路由时我们可以声明路由约束，常见路由约束有 非空约束、类型约束、范围数据、正则约束和自定义约束等。Web请求不符合路由约束时会得到404状态码。

```csharp
[ApiController]
[Route("[controller]")]
public class TestController : ControllerBase
{
    //非空约束
    [HttpGet("test0/{name:required}")]
    public Task<string> GetAsync(string name)
    {
        return Task.FromResult($"Hello {name}");
    }

    //最大值约束
    [HttpGet("test1/{age:max(120)}")]
    public Task<int> GetAsync(int age)
    {
        return Task.FromResult(age);
    }

    //正则约束
    [HttpGet(@"test2/{postcode:regex(^\d{{6}}$)}")]
    public Task<long> GetAsync(long postcode)
    {
        return Task.FromResult(postcode);
    }

    //自定义约束
    [HttpGet("test3/{ok:CustomRoutConstraint}")]
    public Task<bool> GetAsync([FromRoute]bool ok)
    {
        return Task.FromResult(ok);
    }
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
## 4. LinkGenerator
除了将URL匹配到对应Action方法外，路由还可以根据参数生成URL地址等。
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