# 异常处理

## 1. 业务性错误
简单的错误可以直接使用`HttpStatusCode`返回，如请求资源不能存在直接返回`NotFound`(404)即可。

较为复杂的业务错误,如，“用户年龄不合法”、“Id不存在等”，这种情况`HttpStatusCode`不足以满足业务需要，
一般我们可以自定义一个统一的返回对象来做详细说明。

```csharp
public interface IApiResult{}

public class ApiResult<T>:IApiResult
{
    /// <summary>
    /// 业务码。可自定义一套业务码标准
    /// </summary>
    public int Code { get; set; } = 200;

    /// <summary>
    /// 消息。一般可用于传输错误消息
    /// </summary>
    public string Message { get; set; }

    /// <summary>
    /// 数据内容。一般为实际请求数据，如Json
    /// </summary>
    public T Content { get; set; }

    public ApiResult(int code, string message, T content)
    {
        Code = code;
        Message = message;
        Content = content;
    }
}
```
使用方式如下：
```csharp
[HttpGet("{age}")]
public ActionResult<IApiResult> Get(int age)
{
    if (age < 18||age>60)
    {
        return new ApiResult<string>(0,"年龄超限",null);
    }
    else
    {
        return new ApiResult<string>(1,"OK","123");    
    } 
}
```

## 2. 常规异常处理
在API代码中做好必要的异常捕捉和处理，如用户请求参数合法性校验等。一般API中只做简单的数据采集校验，响应和格式化返回数据等工作，复杂的业务逻辑处理是业务逻辑层的工作，一般在BLL中做异常捕获和处理。

## 3. 全局异常过滤器
全局未处理异常可以通过异常过滤器来进行捕捉处理。

自定义异常过滤器。
```csharp
public class MyAsyncExceptionFilter : IAsyncExceptionFilter
{
    private ILogger _logger;

    public MyAsyncExceptionFilter(ILogger<MyAsyncExceptionFilter> logger)
    {
        _logger = logger;
    }

    public async Task OnExceptionAsync(ExceptionContext context)
    {
        context.ExceptionHandled = true;

        var msg = context.Exception.Message;
        _logger.LogError(msg);
        context.Result = new ObjectResult(new ApiResult<string>(500, msg, null)) {StatusCode = 500};

        await Task.CompletedTask;
    }
}
```
Startup中注册过滤器。
```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddMvc(options =>
    {
        options.Filters.Add<MyAsyncExceptionFilter>();
    });
}
```