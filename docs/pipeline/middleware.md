# 中间件

## 1. 工作原理

中间件是一种装配到应用管道以处理请求和响应的软件。 每个组件：
* 选择是否将请求传递到管道中的下一个组件。
* 可在管道中的下一个组件前后执行工作。
  
请求委托用于处理每个 HTTP 请求,通常使用`Run`,`Map`和`Use`扩展方法来配置请求委托。可将一个单独的请求委托并行指定为匿名方法（称为并行中间件），或在可重用的类中对其进行定义。 这些可重用的类和并行匿名方法即为中间件。 请求管道中的每个中间件组件负责调用管道中的下一个组件，或使管道短路。 当中间件短路时，它被称为“终端中间件”。

ASP.NET Core 请求管道包含一系列请求委托，依次调用。 下图演示了这一概念。 沿黑色箭头执行。
![中间件管道](https://i.loli.net/2020/08/25/61lCiIjHZOXLEpF.jpg)


### 1.1 Use
用`Use`将多个请求委托链接在一起。`next`参数表示管道中的下一个委托。 可通过不调用`next`参数使管道短路，短路可以避免不必要的工作，节省系统开支。例如，静态文件中间件可以处理对静态文件的请求，并让管道的其余部分短路，从而起到终端中间件的作用。

```csharp {3-8}
public void Configure(IApplicationBuilder app)
{
    app.Use(async (context, next) =>
    {
        // Do work that doesn't write to the Response.
        await next.Invoke();
        // Do logging or other work that doesn't write to the Response.
    });
}
```

**需要特别注意的是，在向客户端发送响应(Response)后请勿继续调用`next.Invoke`，响应启动后，针对 HttpResponse 的更改将引发异常。可以通过`Response.HasStarted`判断是否已发送标头或已写入正文。**

### 1.2 Run 
`Run`委托不会收到`next`参数,第一个`Run`委托即为终端中间件，用于终止管道。
```csharp {3-6}
public void Configure(IApplicationBuilder app)
{
    app.Run(async context =>
    {
        await context.Response.WriteAsync("Hello from 2nd delegate.");
    });
}
```

中间件执行顺序是很重要的，每个委托均可在下一个委托执行前后执行操作处理单词请求共享的`HttpContext`对象，应尽早在管道中调用异常处理委托，这样它们就能捕获在管道的后期阶段发生的异常。

下图显示了Asp.Net Core MVC应用的完整请求处理管道，了解现有中间件的顺序，以及在哪里添加自定义中间件就可以完全控制如何重新排列现有中间件，或根据场景需要注入新的自定义中间件。
![中间件管道](https://i.loli.net/2020/08/25/DzoOs1HynUFhVYq.jpg)

向`Startup.Configure`方法添加中间件组件的顺序定义了针对请求调用这些组件的顺序，以及响应的相反顺序。 此顺序对于安全性、性能和功能至关重要。

### 1.3 Map
`Map`扩展用作约定来创建管道分支，`Map`基于给定请求路径的匹配项来创建请求管道分支。 如果请求路径以给定路径开头，则执行分支。
```csharp{3-4,7-8}
public void Configure(IApplicationBuilder app)
{
    app.Map("/map1", builder => builder.Run(async context => await context.Response.WriteAsync("Map Test 1")));
    app.Map("/map2", builder => builder.Run(async context => await context.Response.WriteAsync("Map Test 2")));

    // 当请求表单中存在 bigfile 字段时，启用自定义Form
    app.MapWhen(context => context.Request.Form.ContainsKey("bigfile"),
                builder => builder.Use(async (con, next) => con.Request.Form = new FormCollection(null, null)));

    app.Run(async context =>
    {
        await context.Response.WriteAsync("Hello from non-Map delegate. <p>");
    });
}
```

## 2. 自定义中间件
当需要在某个时机处理具有某些特征的某类Http请求时，我们通常会通过自定义中间件来解决。如同`StartUp`可按约定定义或实现`IStartUp`接口，自定义中间件也可以选择遵循约定或者实现`IMiddleware`。 

下面我们简单演示如何自定义一个中间件，该中间件主要作用是处理多参数大文件上传，即在上传一个或多个大文件时同时处理多个不同类型的其他参数。
```csharp
class BigFileFormMiddleware
{
    private readonly RequestDelegate _next;
    private readonly long _minBodySize;
    private readonly long _maxBodySize;

    public BigFileFormMiddleware(RequestDelegate next, IOptionsMonitor<BigFileFormOptions> options)
    {
        _next = next;
        _minBodySize = options.CurrentValue.MinBodySize;
        _maxBodySize = options.CurrentValue.MaxBodySize;
    }

    //中间件逻辑
    public async Task InvokeAsync(HttpContext context)
    {
        if (MultipartRequestHelper.IsMultipartContentType(context.Request.ContentType)
            && context.Request.ContentLength >= _minBodySize
            && context.Request.ContentLength <= _maxBodySize
            && context.Request.Method == HttpMethods.Post)
        {
            var fields = new Dictionary<string, StringValues>();
            var files = new FormFileCollection();

            var boundary = MultipartRequestHelper.GetBoundary(
                MediaTypeHeaderValue.Parse(context.Request.ContentType), _maxBodySize);
            var reader = new MultipartReader(boundary, context.Request.Body);

            try
            {
                var section = await reader.ReadNextSectionAsync();
                while (section != null)
                {
                    var hasContentDispositionHeader =
                        ContentDispositionHeaderValue.TryParse(
                            section.ContentDisposition, out var contentDisposition);

                    if (hasContentDispositionHeader)
                    {
                        var memoryStream = new MemoryStream();
                        await section.Body.CopyToAsync(memoryStream);

                        // Check if the file is empty or exceeds the size limit.
                        if (memoryStream.Length == 0)
                            throw new InvalidParameterException("the file must be not empty");

                        if (memoryStream.Length > _maxBodySize)
                            throw new ArgumentOutOfRangeException(
                                $"the file is too large and exceeds {_maxBodySize / 1024 / 1024:N1} MB");

                        if (!MultipartRequestHelper
                            .HasFileContentDisposition(contentDisposition))
                            fields[contentDisposition.Name.Value.ToLower()] =
                                Encoding.Default.GetString(memoryStream.ToArray());
                        else
                        {
                            var filename = contentDisposition.FileName.Value;
                            var ext = Path.GetExtension(filename).ToLowerInvariant();

                            files.Add(new FormFile(memoryStream, 0, memoryStream.Length,
                                contentDisposition.Name.Value,
                                filename));
                        }
                    }

                    section = await reader.ReadNextSectionAsync();
                }

                context.Request.Form = new FormCollection(fields, files);
            }
            catch (IOException)
            {
                const string msg = "failed to upload.try recheck the file";
                throw new IOException(msg);
            }
        }

        // 调用下一个中间件
        await _next(context);
    }
}

// 扩展 UseBigFileForm 
public static class BigFileFormMiddlewareExtension
{
    public static IApplicationBuilder UseBigFileForm(this IApplicationBuilder app)
    {
        app.UseMiddleware<BigFileFormMiddleware>();
        return app;
    }
}

public static class MultipartRequestHelper
{
    public static string GetBoundary(MediaTypeHeaderValue contentType, long lengthLimit)
    {
        var boundary = HeaderUtilities.RemoveQuotes(contentType.Boundary).Value;

        if (string.IsNullOrWhiteSpace(boundary))
        {
            throw new InvalidDataException("Missing content-type boundary.");
        }

        if (boundary.Length > lengthLimit)
        {
            throw new InvalidDataException(
                $"Multipart boundary length limit {lengthLimit} exceeded.");
        }

        return boundary;
    }

    public static bool IsMultipartContentType(string contentType)
    {
        return !string.IsNullOrEmpty(contentType)
                && contentType.IndexOf("multipart/", StringComparison.OrdinalIgnoreCase) >= 0;
    }

    public static bool HasFormDataContentDisposition(ContentDispositionHeaderValue contentDisposition)
    {
        // Content-Disposition: form-data; name="key";
        return contentDisposition != null
                && contentDisposition.DispositionType.Equals("form-data")
                && string.IsNullOrEmpty(contentDisposition.FileName.Value)
                && string.IsNullOrEmpty(contentDisposition.FileNameStar.Value);
    }

    public static bool HasFileContentDisposition(ContentDispositionHeaderValue contentDisposition)
    {
        // Content-Disposition: form-data; name="myfile1"; filename="Misc 002.jpg"
        return contentDisposition != null
                && contentDisposition.DispositionType.Equals("form-data")
                && (!string.IsNullOrEmpty(contentDisposition.FileName.Value)
                    || !string.IsNullOrEmpty(contentDisposition.FileNameStar.Value));
    }
}
```
在`StartUp.Configure`启用此中间件：
```csharp {3}
public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    app.UseBigFileForm();
    app.UseRouting();
    app.UseEndpoints(endpoints => { endpoints.MapControllers(); });
}
```
启用此中间件后，当通过`POST`方式上传表单文件且文件尺寸介于指定范围时，我们就可以使用`Request.Form`来获取请求参数，通过`Request.Form.Files`拿到上传的大文件。
```csharp
[HttpPost]
[DisableFormValueModelBinding]
[DisableRequestSizeLimit]
public async Task PostAsync()
{
    var releaseNotes = Request.Form["releasenotes"];
    app = Request.Form.Files["app"];

    //logic
}
```
![多参数大文件上传](https://i.loli.net/2020/08/27/7MqlOGDm8IAkiwx.jpg)

参考文档：[编写中间件](https://docs.microsoft.com/zh-cn/aspnet/core/fundamentals/middleware/write?view=aspnetcore-3.1)