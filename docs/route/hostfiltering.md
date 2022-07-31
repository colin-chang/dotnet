## 请求解析

## 1. 过滤主机名
如果应用程序对请求采用的主机名（`Host Name`）有要求，则可以利用`HostFilteringMiddleware`中间件对请求采用主机名进行验证。在使用`HostFilteringMiddleware`中间件时，我们可以指定一组有效的主机名，该中间件在处理请求时会验证当前请求采用的主机名是否在此范围之内，并拒绝采用不合法主机名的请求。 

`HostFilteringMiddleware`中间件定义在 NuGet包`Microsoft.AspNetCore.HostFiltering`中。

```csharp{6-9,12}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services
                .AddHostFiltering(options =>
                {
                    options.AllowedHosts.Add("a-nomad.com");
                    options.AllowedHosts.Add("colinchang.net");
                }))
            .Configure(app => app
                .UseHostFiltering()
                .Run(context => context.Response.WriteAsync($"{context.Request.Host} is valid"))
            ))
        .Build().Run();
}
```
`HostFilteringOptions` 类型具有一个字符串列表类型的`AllowedHosts`属性，表示允许的主机名称。除了指定一个确定的主机名称，还可以将添加的主机名设定为如下 3 种特殊的形式，它们都表示匹配任意的主机名称。

* `*`
* `0.0.0.0`
* `::`(`针对IP V6`)

`HostFilteringMiddleware`中间件提取的主机名称来源于请求的 `Host`报头。`HostFilteringOptions` 类型的 `AllowEmptyHosts` 属性表示不具有 `Host`报头或者`Host` 报头值为空的请求是否是合法的。该属性的默认值为 `True`，意味着在默认情况下这样的请求是合法的；如果将该属性显式设置为 `False`，`HostFilteringMiddleware` 中间件在处理这类请求时会返回一个状态码为`400 BadRequest`的响应。

## 2. HTTP重写
下面介绍两个可以改写 HTTP 请求消息的中间件，它们分别是用来改写请求HTTP方法的 `HttpMethodOverrideMiddleware`以及用来改写客户端 IP地址、主机名称和协议类型（HTTP 或者 HTTPS）的`ForwardedHeadersMiddleware` 中间件。按照惯例，我们先通过几个简单的实例来了解这两个中间件针对请求HTTP消息的改写功能。
### 2.1 HttpMethodOverrideMiddleware
由于一些网络设置、客户端软件或者选用服务器的限制，在一些场景下只允许发送或者接收 GET请求和 POST请求，这就要求服务端在进行路由之前改写当前请求的HTTP方法。

```csharp{6}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .Configure(app => app
                .UseHttpMethodOverride()
                .Run(context => context.Response.WriteAsync($"Http Method {context.Request.Method}"))
            ))
        .Build().Run();
}
```

应用启动后，我们发送如下这个POST请求，该请求具有一个`X-Http-Method-Override`报头，它将希望被改写的目标HTTP方法设置为PUT。

![重写Http Method](https://i.loli.net/2021/04/01/hwjQxgqCNGMXUVu.png)

`X-Http-Method-Override`虽然不属于 HTTP标准规定的请求报头，但是是事实上的标准，各个厂商基本都接受利用它来表示请求希望被改写的HTTP 方法，携带此报头的**一般要求是一个POST请求**。

### 2.2 ForwardedHeadersMiddleware
从传输层面来讲，Web服务器只会将 TCP连接的另一端视为客户端，但是应用程序视角的客户端一般指的是最初发送请求的终端。在大部分部署场景下，两者之间都会存在代理或者负载均衡器这样的中间节点（以下统称为代理），所以双方理解的客户端就存在不一致的情况。不仅如此，客户端与代理之间以及代理与服务器采用的协议也可能不一致，客户端与代理之间可能采用 HTTPS，代理与服务器之间则可能采用 HTTP。为了解决这个问题，厂商都会遵循这样一个事实标准（`de-facto Standard`）：代理会在转发的请求上添加如下3个报头来表示原始客户端的主机名、IP地址和传输协议。

请求头|服务端属性|含义
:-|:-|:-
`X-Forwarded-Host`|`Request.Host`|原始主机名
`X-Forwarded-For`|`Connection.RemoteIpAddress`|原始IP地址
`X-Forwarded-Proto`|`Request.Scheme`|原始传输协议

`ForwardedHeadersMiddleware`从请求中提取上述这 3 个报头，并修正当前的`HttpContext`中承载的对应信息，而修正前的内容会转存到另外 3个请求报头中，它们对应的名称如下。

请求头|含义
:-|:-|:-
`X-Original-Host`|代理主机名
`X-Original-For`|代理IP地址
`X-Original-Proto`|代理传输协议

```csharp{6,11-16}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .Configure(app => app
                .UseForwardedHeaders(new ForwardedHeadersOptions {ForwardedHeaders = ForwardedHeaders.All})
                .Run(async context =>
                {
                    var dict = new Dictionary<string, string>
                    {
                        ["Host"] = context.Request.Host.ToString(),
                        ["RemoteIpAddress"] = context.Connection.RemoteIpAddress?.ToString(),
                        ["Scheme"] = context.Request.Scheme,
                        ["X-Original-Host"] = context.Request.Headers["X-Original-Host"],
                        ["X-Original-For"] = context.Request.Headers["X-Original-For"],
                        ["X-Original-Proto"] = context.Request.Headers["X-Original-Proto"],
                    };

                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsync(JsonConvert.SerializeObject(dict));
                })
            ))
        .Build().Run();
}
```
我们使用Postman来模拟代理服务器请求以上应用得到结果如下图所示。
![ForwardedHeaders](https://i.loli.net/2021/04/01/1DI2To6KYveLzwP.png)

原始的客户端到目标服务器之间可能存在多个中间节点，所以 HTTP 报文在抵达服务器之前可能经过了多次转发。一般来说，某个代理在对请求进行转发之前会将针对它的客户端（可能是原始的客户端，也可能是上游代理）的 IP 地址、主机名称和协议名称追加到上述 3 个 `X-Forwarded-`报头上，所以`ForwardedHeadersMiddleware`处理的这3个`X-Forwarded-`报头可能包含多个值。

虽然客户端可以利用`X-Forwarded-For`报头和`X-Forwarded-Host`报头指定任意的 IP地址与主机名，但是它们能否被接受则由`ForwardedHeadersMiddleware`来决定。配置选项`ForwardedHeadersOptions`的`AllowedHosts`属性和`KnownProxies`属性表示的就是一组有效的主机名称与IP地址。

## 3. 基础路径
标准的 URL采用的格式为`protocol：//hostname[：port]/path/[；parameters][？query]＃fragment`，主机名称后边的就是路径（`Path`）。ASP.NET Core管道在创建`HttpContext`上下文的时会根据URL来解析请求的路径，具体的解析过程由设置的基础路径（`PathBase`）来决定。

`HttpContext`上下文体现的请求路径（对应`HttpRequest`对象的`Path`属性）与请求URL的路径可能是不一致的，它们之间的映射关系取决于我们为应用设置了怎样的基础路径（对应`HttpRequest`对象的`PathBase`属性），`HttpRequest`对象的路径实际上是针对基础路径的相对路径。

```csharp{6}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(builder => builder
            .Configure(app => app
                .UsePathBase("/dotnet")
                .Run(async context =>
                {
                    var url = context.Request.GetDisplayUrl();
                    var pathBase = context.Request.PathBase;
                    var path = context.Request.Path;
                    await context.Response.WriteAsync($"Url:{url}\r\nPathBase:{pathBase}\r\nPath:{path}");
                })
            ))
        .Build().Run();
}
```
启动以上应用并访问`https://localhost:5001/dotnet/route`可以得到如下相应
```
Url:https://localhost:5001/dotnet/route
PathBase:/dotnet
Path:/route
```

`UsePathBaseMiddleware` 中间件只会选择当前路径（默认为请求URL 的路径）以指定基础路径为前缀的请求。在设置了当前请求的基础路径之后，`Path` 属性表示的路径也会做相应的调整。当后续中间件完成了针对当前请求处理之后，`UsePathBaseMiddleware` 中间件还会将请求的基础路径和路径恢复到之前的状态，所以它针对请求基础路径和路径的修改**不会对前置中间件造成任何影响**。