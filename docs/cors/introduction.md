# 跨域资源共享

同源策略是所有浏览器都必须遵循的一项安全原则，它的存在决定了浏览器在默认情况下无法对跨域请求的资源做进一步处理。为了实现跨域资源的共享，W3C 制定了`CORS`规范，从而使授权的客户端可以处理跨域调用返回的资源。ASP.NETCore利用`CorsMiddleware`中间件提供了针对`CORS`规范的实现。

## 1. 资源提供者显式授权
`CorsMiddleware`中间件完全是基于`W3C CORS`规范实现的，该规范采用“由资源提供者显式授权”的策略来确定资源消费者是否具有进一步操作返回资源的权限。如果希望将提供的资源授权给某个应用程序，可以将作为资源消费者应用程序的“域”添加到授权域列表中。所谓的“域”是由协议前缀（如`http：//`或`https：//`）、主机名（或者域名）和端口号组成的。

```csharp{5,7-10}
public static void Main(string[] args)
{
    
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services.AddCors())
            .Configure(app => app
                .UseCors(cors => cors.WithOrigins(
                    "https://a-nomad.com",
                    "https://192.168.0.100:5001"
                ))
                .Run(async context => await context.Response.WriteAsync("Hello world"))
            ))
        .Build()
        .Run();
}
```
跨域访问响应头中会有两个名称分别为`Vary` 和 `Access-Control-Allow-Origin`的报头。前者与缓存有关，它要求在对响应报文实施缓存的时候，选用的`Key`应该包含请求的`Origin`报头值，它提供给浏览器授权访问当前资源的域。浏览器正是利用`Access-Control-Allow-Origin`报头确定当前请求采用的域是否有权对获取的资源做进一步处理的。

很多时候我们对跨域有更加灵活的要求，不能仅通过以上“白名单”的方式实现，比如，我们允许某些域名下所有的请求均可发送跨域请求。此时我们可以通过 `IApplicationBuilder` 对象的 `UseCors` 扩展方法注册`CorsMiddleware`中间件时调用`CorsPolicyBuilder`对象的`SetIsOriginAllowed`方法来设置授权策略。资源授权策略通过作为参数的 `Func＜string，bool＞`对象来表示，该委托对象的输入参数表示请求的域，所以可以利用提供的委托对象实现任何我们想要的资源授权策略。

```csharp{3-7,10,12}
public static void Main(string[] args)
{
    var corsWhileList = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "a-nomad.com",
        "colinchang.net"
    };
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services.AddCors())
            .Configure(app => app
                .UseCors(cors => cors.SetIsOriginAllowed(origin => corsWhileList.Contains(new Uri(origin).Host)))
                .Run(async context => await context.Response.WriteAsync("Hello world"))
            ))
        .Build()
        .Run();
}
```

## 2. 基于策略的资源授权
`CORS`本质上还是属于授权的问题，所以我们可以将资源授权的规则定义成相应的策略，`CorsMiddleware`中间件就可以针对某个预定义的策略来实施跨域资源授权。在调用`IServiceCollection`接口的`AddCors`扩展方法时注册一个`CORS`策略。

```csharp{10-11,13}
public static void Main(string[] args)
{
    var corsWhileList = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "a-nomad.com",
        "colinchang.net"
    };
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services.AddCors(options => options
                .AddDefaultPolicy(builder => builder.SetIsOriginAllowed(origin => corsWhileList.Contains(new Uri(origin).Host)))))
            .Configure(app => app
                .UseCors()
                .Run(async context => await context.Response.WriteAsync("Hello world"))
            ))
        .Build()
        .Run();
}
```
除了注册一个默认的匿名`CORS`策略，我们还可以注册一个非默认的具名策略。
```csharp{10-11,13}
public static void Main(string[] args)
{
    var corsWhileList = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "a-nomad.com",
        "colinchang.net"
    };
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services.AddCors(options => options
                .AddPolicy("ccPolicy", builder => builder.SetIsOriginAllowed(origin => corsWhileList.Contains(new Uri(origin).Host)))))
            .Configure(app => app
                .UseCors("ccPolicy")
                .Run(async context => await context.Response.WriteAsync("Hello world"))
            ))
        .Build()
        .Run();
}
```

## 3. CORS规范
### 3.1 同源策略
同源策略是浏览器的一项最基本的安全策略。毫不夸张地说，浏览器的整个安全体系均建立在此基础之上。同源策略限制了“源”自 A站点的脚本只能操作“同源”页面的`DOM`，“跨源”操作来源于 B 站点的页面将会被拒绝。所谓的“同源站点”，必须要求它们的 URI 在如下3个方面保持一致。
* 主机名称（域名/子域名或者IP地址）
* 端口号
* 网络协议（`Scheme`，分别采用`http`和`https`协议的两个URI被视为不同源）

值得注意的是，对于一段`JavaScript`脚本来说，其“源”与存储的地址无关，而是取决于脚本被加载的页面。如`<script src="https://cdn.baidu.com/jquery.js"></script>`标签引用了`cdn.baidu.com`地址的脚本，它仍与当前页面同源，基于JSONP跨域资源共享就是基于此实现。类似的HTML标签还有`＜img＞`、`＜iframe＞`和`＜link＞`等。它们均具有跨域加载资源的能力，同源策略对它们不做限制。对于这些具有`src`属性的 HTML 标签来说，标签的每次加载都伴随着针对目标地址的一次`GET`请求。

### 3.2 资源授权
基于 Web 的资源共享涉及两个基本角色，即资源的提供者和消费者。`CORS`旨在定义一种规范，从而使浏览器在接收到从提供者获取的资源时能够决定是否应该将此资源分发给消费者做进一步处理。`CORS`根据资源提供者的显式授权来决定目标资源是否应该与消费者分享。换句话说，浏览器需要得到提供者的授权之后才会将其提供的资源分发给消费者。

如果浏览器自身提供对`CORS`的支持，由它发送的请求会携带一个名为`Origin`的报头表明请求页面所在的站点。资源获取请求被提供者接收之后，可以根据该报头确定提供的资源需要与谁共享。资源提供者的授权结果通过一个名为`Access-Control-Allow-Origin`的响应报头来承载，它表示得到授权的站点列表。一般来说，如果资源的提供者认可当前请求的Origin 报头携带的站点，那么它会将该站点作为`Access-Control-Allow-Origin`报头的值。除了指定具体的“源”并对其做针对性授权，资源提供者还可以将 `Access-Control-Allow-Origin` 报头的值设置为`*`，从而对所有消费者进行授权。如果资源请求被拒绝，资源提供者可以将此响应报头值设置为`null`，或者让响应不具有此报头。

当浏览器接收到包含资源的响应之后，会提取`Access-Control-Allow-Origin` 报头的值。如果此值为“*”或者提供的站点列表包含此前请求的站点（即请求的`Origin`报头的值），就意味着资源的消费者获得了提供者授予的权限，在此情况下浏览器会允许 JavaScript 程序操作获取的资源。如果此响应报头不存在或者其值为 `null`，客户端 JavaScript 程序针对资源的操作就会被拒绝。