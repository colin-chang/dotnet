# 异常处理

## 1. catch when
在C# 6以后，Try Catch加了一个过滤Exception Filter语法，可以在catch后跟一个条件语句。
```csharp {7}
[HttpGet]
public IActionResult Get()
{
    try
    {
        List<string> example_list = null;
        var item_count  = example_list.Count();
        return Ok(item_count);
    }
    catch (Exception ex) when (ex.InnerException == null)
    {
        return StatusCode(HttpContext.Response.StatusCode, "error");
    }
    catch (Exception ex)
    {
        return StatusCode(HttpContext.Response.StatusCode, "other error");
    }
}
```
在这个语法中，when后面是一个bool的判断，为true则进入catch块，为false则跳过。在C#中，异常是从内向外逐层查找处理程序的，随着查找层数的增加，性能会逐渐降低。

理论上讲try块的运行效率和不加try块的性能差不多，可以认为基本一致，但catch块的性能会差很多。所以一般来说，一个基本的原则是，不要把try、catch作为程序的逻辑。但如果我们需要又需要记录这个异常，该怎么办？这时候，就可以利用Exception Filter语法。

```csharp {10}
[HttpGet]
public IActionResult Get()
{
    try
    {
        List<string> example_list = null;
        var item_count = example_list.Count();
        return Ok(item_count);
    }
    catch (Exception ex) when (log(ex)){}
    return StatusCode(HttpContext.Response.StatusCode, "error");
}

private bool log(Exception ex)
{
    _logger.LogError(ex,ex.Message);
    return false;
}
```

在这个代码中，when条件后跟了一个返回bool的方法。我们可以在这个方法中进行异常的记录处理，然后返回false。为什么要返回false呢？是因为我们要记录异常，但为了性能的考虑，不希望代码进入到catch块。返回false后，程序执行了log方法，却又没进入到catch块。当然，如果你想进入到catch块，那返回true就可以了。

以上方式不算是一个常规的解决办法，只能算一个旁门的小技巧。

## 2. 异常中间件

由于中间件执行存在顺序问题，我们需要把异常处理中间件注册为第一个中间件才能捕捉到后续管道中所有中间件的异常。

### 2.1 异常处理页
Asp.Net Core项目在在Startup.Configure方法中默认为开发环境启用了异常处理页中间件，用于为开发人员显示异常的详细信息。

```csharp {5}
public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    if (env.IsDevelopment())
    {
        app.UseDeveloperExceptionPage();
    }
    // logic
}
```

![异常处理页](https://i.loli.net/2020/08/29/TbXyki6jSOIr8KA.jpg)

### 2.2 异常处理委托
`app.UseExceptionHandler()`也是一个内置的用来处理异常的中间件，参数可以是一个Endpoint(路由到一个Action方法中处理异常)，也可以是一个Action委托(在匿名方法中处理异常)。实际应用时，还可以写成一个IApplicationBuilder的扩展。

```csharp
public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    app.UseExceptionHandler(appBuilder => appBuilder.Run(async context =>
    {
        var logger = context.RequestServices.GetService<ILogger<Startup>>();
        var exception = context.Features.Get<IExceptionHandlerPathFeature>().Error;
        logger.LogError(exception, exception.Message);

        await context.Response.WriteAsync("error occured when execute the current request. please try again later or contact the administrator.");
    }));

    app.UseRouting();
    app.UseEndpoints(endpoints => { endpoints.MapControllers(); });
}
```

### 2.3 自定义异常中间件
如果对异常管理有较高的要求，开发者也可以自定义异常处理中间件，用于捕获并处理系统全局异常。

项目中通常会将异常分为异常(Expected Exception)和未知异常(Unexpected Exception)。已知异常一般为开发者手动抛出的错误，比如数据校验不合法等，这类异常消息相对安全友好可以直接展示给客户端。未知异常则是预期之外的程序错误，比如程序逻辑BUG，数据库错误等，这类异常信息通常包含敏感信息，需要开发者拦截处理后返回给客户端自定义的更为友好的错误提示。

下面我们简单演示如何自定义异常处理中间件来实现上述功能。

```csharp
class ExceptionHandlerMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlerMiddleware> _logger;
    private readonly Func<HttpContext, Exception, Task> _exceptionHandler;
    private readonly IOperationResult _operationResult;

    public ExceptionHandlerMiddleware(IOperationResult operationResult, RequestDelegate next,
        ILogger<ExceptionHandlerMiddleware> logger)
    {
        _next = next;
        _logger = logger;
        _operationResult = operationResult;
    }

    public ExceptionHandlerMiddleware(Func<HttpContext, Exception, Task> exceptionHandler, RequestDelegate next)
    {
        _exceptionHandler = exceptionHandler;
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception e)
        {
            await (_exceptionHandler ?? HandleExceptionAsync).Invoke(context, e);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        string message;

        // expected exception
        if (exception is OperationException)
        {
            message = exception.Message;
            context.Response.StatusCode = (int) HttpStatusCode.BadRequest;
            _logger.LogWarning(exception, exception.Message);
        }
        // unexpected exception
        else
        {
            message = _operationResult.ErrorMessage;
            context.Response.StatusCode = (int) HttpStatusCode.InternalServerError;
            _logger.LogError(exception, exception.Message);
        }

        _operationResult.ErrorMessage = message;
        await context.Response.WriteAsync(JsonConvert.SerializeObject(_operationResult));
    }
}

public static class ExceptionHandlerMiddlewareExtension
{
    public static IApplicationBuilder UseErrorHandler(this IApplicationBuilder app)
    {
        app.UseMiddleware<ExceptionHandlerMiddleware>();
        return app;
    }

    public static IApplicationBuilder UseErrorHandler(this IApplicationBuilder app,
        Func<HttpContext, Exception, Task> exceptionHandler)
    {
        app.UseMiddleware<ExceptionHandlerMiddleware>(exceptionHandler);
        return app;
    }
}
```
在Startup中配置并使用以上中间件。
```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddTransient<IOperationResult>(provider =>
        new OperationResult<object>(null, -1, OperationException.DefaultMessage));

    services.AddControllers();
}

public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    app.UseErrorHandler();
    // app.UseErrorHandler(async (context, e) => await context.Response.WriteAsync("unexpected exception"));

    app.UseRouting();
    app.UseEndpoints(endpoints => { endpoints.MapControllers(); });
}
```

以上中间件已发布到[Nuget](https://www.nuget.org/packages/ColinChang.ExceptionHandler/)供需要的小伙伴自由使用，相关代码已开源到[GitHub](https://github.com/colin-chang/ExceptionHandler),需要的小伙伴儿可以参考。

## 3. 异常过滤器
在Asp.Net Core MVC框架中我们也可以通过异常过滤器来捕获并处理异常。此方式只能处理MVC框架执行过程的异常，并不能处理其他中间件的异常。
### 3.1 IExceptionFilter
自定义异常过滤器如下。
```csharp
public class OperationExceptionFilter : IExceptionFilter, IAsyncExceptionFilter
{
    private readonly ILogger _logger;
    private readonly IOperationResult _operationResult;

    public OperationExceptionFilter(IOperationResult operationResult, ILogger<OperationExceptionFilter> logger)
    {
        _operationResult = operationResult;
        _logger = logger;
    }

    public void OnException(ExceptionContext context)
    {
        context.ExceptionHandled = true;
        var exception = context.Exception;

        string message;
        HttpStatusCode code;

        // expected exception
        if (exception is OperationException)
        {
            message = exception.Message;
            code = HttpStatusCode.BadRequest;
            _logger.LogWarning(exception, exception.Message);
        }
        // unexpected exception
        else
        {
            message = _operationResult.ErrorMessage;
            code = HttpStatusCode.InternalServerError;
            _logger.LogError(exception, exception.Message);
        }

        _operationResult.ErrorMessage = message;
        context.Result = new ObjectResult(JsonConvert.SerializeObject(_operationResult)) {StatusCode = (int) code};
    }

    public async Task OnExceptionAsync(ExceptionContext context)
    {
        OnException(context);
        await Task.CompletedTask;
    }
}
```
在Startup中全局注入过滤器。
```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddTransient<IOperationResult>(provider =>
        new OperationResult<object>(null, -1, OperationException.DefaultMessage));
    services.AddControllers(options => options.Filters.Add<OperationExceptionFilter>());
}
```
### 3.2 ExceptionFilterAttribute
除了以上异常过滤器，我们还可以使用Attribute形式以更细颗粒度控制Controller或Action方法的异常处理。

```csharp
public class OperationExceptionFilterAttribute : ExceptionFilterAttribute
{
    public override void OnException(ExceptionContext context)
    {
        context.ExceptionHandled = true;
        var exception = context.Exception;
        var logger = context.HttpContext.RequestServices.GetService<ILogger<OperationExceptionFilterAttribute>>();
        var operationResult = context.HttpContext.RequestServices.GetService<IOperationResult>();

        string message;
        HttpStatusCode code;

        // expected exception
        if (exception is OperationException)
        {
            message = exception.Message;
            code = HttpStatusCode.BadRequest;
            logger.LogWarning(exception, exception.Message);
        }
        // unexpected exception
        else
        {
            message = operationResult.ErrorMessage;
            code = HttpStatusCode.InternalServerError;
            logger.LogError(exception, exception.Message);
        }

        operationResult.ErrorMessage = message;
        context.Result = new ObjectResult(JsonConvert.SerializeObject(operationResult)) {StatusCode = (int) code};
    }

    public override async Task OnExceptionAsync(ExceptionContext context)
    {
        OnException(context);
        await Task.CompletedTask;
    }
}
```

`ExceptionFilterAttribute`也是实现了`IExceptionFilter`和`IAsyncExceptionFilter`，所以也可以按照以上[3.1](#_3-1-iexceptionfilter)节过滤器全局注入方式使用。
```csharp{5}
public void ConfigureServices(IServiceCollection services)
{
    services.AddTransient<IOperationResult>(provider =>
        new OperationResult<object>(null, -1, OperationException.DefaultMessage));
    services.AddControllers(options => options.Filters.Add<OperationExceptionFilterAttribute>());
}
```

当然，也可以在特定Controller或Action方法上使用Attribute处理异常。
```csharp {13}
public void ConfigureServices(IServiceCollection services)
{
    services.AddTransient<IOperationResult>(provider =>
        new OperationResult<object>(null, -1, OperationException.DefaultMessage));
    services.AddControllers();
}

[ApiController]
[Route("[controller]")]
public class TestController : ControllerBase
{
    [HttpGet("{id}")]
    [OperationExceptionFilter]
    public Task<IOperationResult> GetAsync(int id)
    {
        if (id < 0)
            throw new OperationException("custom exception");

        if (id > 0)
            return Task.FromResult<IOperationResult>(new OperationResult<string>("success"));

        throw new Exception("unexpected exception");
    }
}
```
当我们需要在MVC框架和全局异常处理中使用不同处理逻辑时，可以同时使用MVC的异常过滤器和全局异常处理中间件。

以上过滤器已发布到[Nuget](https://www.nuget.org/packages/ColinChang.ExceptionHandler/)供需要的小伙伴自由使用，相关代码已开源到[GitHub](https://github.com/colin-chang/ExceptionHandler),需要的小伙伴儿可以参考。