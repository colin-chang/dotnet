# 异常处理

由于ASP.Net是一个同时处理多个请求的Web应用框架，所以在处理某个请求过程中抛出的异常并不会导致整个应用的中止。出于安全方面的考量，为了避免敏感信息外泄，客户端在默认情况下并不会得到详细的出错信息，这无疑会在开发过程中增加查错和纠错的难度。对于生产环境来说，我们也希望最终用户能够根据具体的错误类型得到具有针对性并且友好的错误消息。NuGet 包`Microsoft.AspNetCore.Diagnostics`中提供的相应的中间件可以帮助我们将定制化的错误信息呈现出来。

**由于中间件执行存在顺序问题，我们需要把异常处理中间件注册为第一个中间件才能捕捉到后续管道中所有中间件的异常。**

在ASP.Net的世界里，针对请求的处理总是体现为一个RequestDelegate对象，异常中间件亦是如此，我们可以在中间件中通过HttpContext对象获取任何需要的信息，然后进一步处理异常，比如记录错误日志、返回定制错误信息，重定向到错误页等。

## 1. 开发者异常页

ASP.Net应用在处理请求时出现服务端异常一般会返回一个状态码为`500 Internal Server Error`的响应。为了避免一些敏感信息的外泄，详细的错误信息并不会随着响应发送给客户端，所以客户端只会得到一个如下图所示的很泛化的错误消息，用户看不到任何具有针对性的错误信息。

![服务端错误](https://i.loli.net/2021/03/28/r6Jo5vnD7LKZ1WG.png)

开发人员通常有两种方式进行查错和纠错。一种是利用日志，因为ASP.Net应用在进行请求处理时出现的任何错误都会被写入日志，所以可以通过注册相应的`ILoggerProvider`对象来获取写入的错误日志，如可以注册一个`ConsoleLoggerProvider`对象将日志直接输出到宿主应用的控制台上。另一种解决方案就是直接显示一个错误页面，由于这个页面只是在开发环境给开发人员看的，所以可以将这个页面称为开发者异常页面（`Developer Exception Page`）。开发者异常页面的呈现是利用一个名为`DeveloperExceptionPageMiddleware`的中间件完成的，我们可以采用如下所示的方式调用`IApplicationBuilder`接口的`UseDeveloperExceptionPage`扩展方法来注册这个中间件。

```csharp{7-8}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .Configure(app =>
            {
                if (app.ApplicationServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment())
                    app.UseDeveloperExceptionPage();

                app.Run(context => Task.FromException(new InvalidOperationException("非法操作")));
            }))
        .Build()
        .Run();
}
```

![开发者异常页](https://i.loli.net/2021/03/28/Uc4FWOTmrDfjzvH.png)

如上图所示在开发者异常页中我们可以看到应用在处理请求过程中出现的异常信息就会以下图所示的形式直接出现在浏览器上，我们可以在这个页面中看到几乎所有的错误信息，包括异常的类型、消息和堆栈信息等，方便开发人员定位和处理异常。出于安全考虑一般仅在开发环境中开启此页面。

## 2. 异常处理程序

在生产环境下，我们倾向于为最终的用户呈现一个定制的错误页面，这可以通过注册另一个名为`ExceptionHandlerMiddleware`的中间件来实现，它旨在提供一个异常处理器（`ExceptionHandler`）来处理抛出的异常。实际上，这个所谓的异常处理器就是一个`RequestDelegate`对象。

```csharp{6-16}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder            
            .Configure(app => app
                .UseExceptionHandler(appBuilder => appBuilder.Run(async context =>
                {
                    var logger = context.RequestServices.GetService<ILogger<Program>>();
                    var exception = context.Features.Get<IExceptionHandlerPathFeature>().Error;
                    logger.LogError(exception, exception.Message);

                    await context.Response.WriteAsync(
                        "error occured when execute the current request. please try again later or contact the administrator.");
                }))
                // 重定向到指定错误页
                // .UseExceptionHandler("/error")
                .Run(context => Task.FromException(new InvalidOperationException("非法操作")))
            ))
        .Build()
        .Run();
}
```

以上中间件将异常相信信息记录了日志，并返回给客户端一个定制消息。如果应用已经设置了一个错误页面，并且这个错误页面有一个固定的路径，那么我们在进行异常处理的时候就没有必要提供一个`RequestDelegate`对象，只需要重定向到错误页面指向的路径即可。

## 3. 定制状态码错误

异常或者错误的语义表达在HTTP协议层面主要体现在响应报文的状态码上，具体来说，HTTP通信的错误大体分为如下两种类型。

* 客户端错误：表示因客户端提供不正确的请求信息而导致服务器不能正常处理请求，响应状态码的范围为`[400, 499]`。
* 服务端错误：表示服务器在处理请求过程中因自身的问题而发生错误，响应状态码的范围为`[500, 599]`。

正是因为响应状态码是对错误或者异常语义最重要的表达，所以在很多情况下我们需要针对不同的响应状态码来定制显示的错误信息。针对响应状态码对错误页面的定制可以借助一个`StatusCodePagesMiddleware`类型的中间件来实现。`StatusCodePagesMiddleware`中间件被调用的前提是后续请求处理过程中产生一个错误的响应状态码`[400～599]`。

```csharp{7-13}
public static void Main(string[] args)
{
    var random = new Random();
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .Configure(app => app
                .UseStatusCodePages(async context =>
                {
                    var code = context.HttpContext.Response.StatusCode;
                    await context.HttpContext.Response.WriteAsync(code < 500
                        ? $"client error {code}"
                        : $"server error {code}");
                })
                .Run(async context =>
                {
                    context.Response.StatusCode = random.Next(400, 599);
                    await Task.CompletedTask;
                })
            ))
        .Build()
        .Run();
}
```

## 4. 自定义异常中间件

如果对异常管理有较高的要求，开发者也可以自定义异常处理中间件，用于捕获并处理系统全局异常。

项目中通常会将异常分为异常(`Expected Exception`)和未知异常(`Unexpected Exception`)。已知异常一般为开发者手动抛出的错误，比如数据校验不合法等，这类异常消息相对安全友好可以直接展示给客户端。未知异常则是预期之外的程序错误，比如程序逻辑BUG，数据库错误等，这类异常信息通常包含敏感信息，需要开发者拦截处理后返回给客户端自定义的更为友好的错误提示。

下面我们简单演示如何自定义异常处理中间件来实现上述功能。

```csharp
public class ExceptionHandlerMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlerMiddleware> _logger;
    private readonly RequestDelegate _exceptionHandler;
    private readonly IOperationResult _operationResult;
    private readonly long _logMaxBodyLength;
    private readonly string _overSizeBodyLengthMessage;

    public ExceptionHandlerMiddleware(ExceptionHandlerOptions options, RequestDelegate next,
        ILogger<ExceptionHandlerMiddleware> logger)
    {
        _logMaxBodyLength = options.LogMaxBodyLength;
        _overSizeBodyLengthMessage = options.OverSizeBodyLengthMessage;
        _operationResult = options.OperationResult;

        _next = next;
        _logger = logger;
    }

    public ExceptionHandlerMiddleware(RequestDelegate exceptionHandler, RequestDelegate next)
    {
        _exceptionHandler =
            exceptionHandler ?? throw new ArgumentNullException($"{nameof(exceptionHandler)} cannot be null");

        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            //允许Request.Body多次读取
            context.Request.EnableBuffering();
            await _next(context);
        }
        catch (Exception e)
        {
            context.Features.Set<IExceptionHandlerPathFeature>(new ExceptionHandlerFeature {Error = e});
            await (_exceptionHandler ?? HandleErrorAsync).Invoke(context);
        }
    }

    private async Task HandleErrorAsync(HttpContext context)
    {
        var error = context.Features.Get<IExceptionHandlerPathFeature>().Error;
        if (error == null)
            return;

        // 解析请求参数
        string body;
        if (context.Request.HasFormContentType)
        {
            var files = context.Request.Form.Files.Select(f =>
                new KeyValuePair<string, string>($"{f.Name}(file)", f.FileName));
            var dict = new Dictionary<string, string>(files);
            foreach (var (k, v) in context.Request.Form)
                dict[k] = v;
            body = JsonConvert.SerializeObject(dict);
        }
        else
        {
            context.Request.EnableBuffering();
            using var reader = new StreamReader(context.Request.Body, context.Request.ContentType == null
                ? Encoding.UTF8
                : new MediaType(context.Request.ContentType).Encoding);
            var request = await reader.ReadToEndAsync();
            context.Request.Body.Seek(0, SeekOrigin.Begin);
            body = request.Length > _logMaxBodyLength ? _overSizeBodyLengthMessage : request;
        }

        var log = JsonConvert.SerializeObject(new
        {
            Url = context.Request.GetEncodedUrl(),
            context.Request.Method,
            context.Request.Headers,
            context.Request.Cookies,
            context.Request.Query,
            Body = body
        });

        string message;
        const string logTemplate = "error:{0}\r\nrequest{1}";
        // expected exception
        if (error is OperationException)
        {
            message = error.Message;
            context.Response.StatusCode = (int) HttpStatusCode.BadRequest;
            _logger.LogWarning(error, logTemplate, error.Message, log);
        }
        // unexpected exception
        else
        {
            message = _operationResult.ErrorMessage;
            context.Response.StatusCode = (int) HttpStatusCode.InternalServerError;
            _logger.LogError(error, logTemplate, error.Message, log);
        }

        context.Response.ContentType = "application/json";
        _operationResult.ErrorMessage = message;
        _operationResult.Code = context.Response.StatusCode;
        await context.Response.WriteAsync(JsonConvert.SerializeObject(_operationResult,
            new JsonSerializerSettings {ContractResolver = new CamelCasePropertyNamesContractResolver()}));
    }
}

public static class ExceptionHandlerMiddlewareExtension
{
    public static IApplicationBuilder UseErrorHandler(this IApplicationBuilder app) =>
        app.UseErrorHandler(new ExceptionHandlerOptions());

    public static IApplicationBuilder UseErrorHandler(this IApplicationBuilder app,
        ExceptionHandlerOptions options)
    {
        app.UseMiddleware<ExceptionHandlerMiddleware>(options);
        return app;
    }

    public static IApplicationBuilder UseErrorHandler(this IApplicationBuilder app,
        RequestDelegate exceptionHandler)
    {
        app.UseMiddleware<ExceptionHandlerMiddleware>(exceptionHandler);
        return app;
    }
}

public class ExceptionHandlerOptions
{
    /// <summary>
    /// 日志记录允许的Request.Body最大长度，超过后日志将记录OverSizeBodyLengthMessage内容
    /// </summary>
    public long LogMaxBodyLength { get; set; } = 4 * 1024;

    /// <summary>
    /// Request.Body长度超过LogMaxBodyLength后记录的错误消息
    /// </summary>
    public string OverSizeBodyLengthMessage { get; set; } = "the request body is too large to record";

    /// <summary>
    /// 发生异常后返回给客户端的响应对象
    /// </summary>
    public IOperationResult OperationResult { get; set; } =
        new OperationResult<object>(null, OperationException.DefaultMessage);
}
```

注册自定义异常中间件。

```csharp
Host.CreateDefaultBuilder(args)
    .ConfigureWebHostDefaults(builder =>
    {
        // builder.UseStartup<Startup>();
        builder.Configure(app =>
        {
            app.UseErrorHandler();
            // app.UseErrorHandler(new ErrorHandlerOptions
            // {
            //     LogMaxBodyLength = 1024,
            //     OverSizeBodyLengthMessage = "request body oversize",
            //     OperationResult = new OperationResult<int>(-1, "error occurs")
            // });
            // app.UseErrorHandler(async context =>
            // {
            //     var error = context.Features.Get<IExceptionHandlerPathFeature>().Error;
            //     await context.Response.WriteAsync($"unexpected exception:{error.Message}");
            // });
        });
    }).Build().Run();
```

以上中间件已发布到[Nuget](https://www.nuget.org/packages/ColinChang.ExceptionHandler/)供需要的小伙伴自由使用，相关代码已开源到[GitHub](https://github.com/colin-chang/ExceptionHandlerMiddleware),需要的小伙伴儿可以参考。

## 5. 其它异常处理

### 5.1 MVC 异常过滤器

在Asp.Net MVC框架中我们也可以通过异常过滤器来捕获并处理异常。因为MVC作为一个中间件，此方式自然只能处理在MVC自身框架执行过程的异常，并不能处理其它中间件的异常。

#### 5.1.1 IExceptionFilter

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

在`Startup`中全局注入过滤器。

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddTransient<IOperationResult>(provider =>
        new OperationResult<object>(null, -1, OperationException.DefaultMessage));
    services.AddControllers(options => options.Filters.Add<OperationExceptionFilter>());
}
```

#### 5.1.2 ExceptionFilterAttribute

除了以上异常过滤器，我们还可以使用`Attribute`形式以更细颗粒度控制`Controller`或`Action`方法的异常处理。

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

### 5.2 Exception Filter

在C# 6以后，`Try Catch`加了一个过滤`Exception Filter`语法，可以在`catch`后跟一个条件语句。

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

在这个语法中，`when`后面是一个`bool`的判断，为`true`则进入`catch`块，为`false`则跳过。在C#中，异常是从内向外逐层查找处理程序的，随着查找层数的增加，性能会逐渐降低。

理论上讲`try`块的运行效率和不加`try`块的性能差不多，可以认为基本一致，但`catch`块的性能会差很多。所以一般来说，一个基本的原则是，不要把`try`、`catch`作为程序的逻辑。但如果我们需要又需要记录这个异常，该怎么办？这时候，就可以利用`Exception Filter`语法。

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

在这个代码中，`when`条件后跟了一个返回`bool`的方法。我们可以在这个方法中进行异常的记录处理，然后返回`false`。为什么要返回`false`呢？是因为我们要记录异常，但为了性能的考虑，不希望代码进入到`catch`块。返回`false`后，程序执行了`log`方法，却又没进入到`catch`块。当然，如果你想进入到`catch`块，那返回`true`就可以了。

以上方式不算是一个常规的解决办法，只能作为一个小技巧使用。
