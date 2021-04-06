# 会话

HTTP 是一种采用请求/响应消息交换模式且无状态的传输协议。HTTP 协议旨在确保客户端将请求报文发送给目标服务器，并成功接收来自服务端的响应报文，这个基本的报文交换被称为一个HTTP事务（`Transaction`）。从协议角度来讲，即便在使用长连接的情况下，同一个客户端和服务器之间进行的多个 HTTP事务也是完全独立的，所以需要在应用层为二者建立一个上下文来保存多次消息交换的状态，我们将其称为会话（`Session`）。

## 1. Session
会话的目的就是在同一个客户端和服务器之间建立两者交谈的语境或者上下文（`Context`），ASP.NET Core利用一个名为`SessionMiddleware`的中间件实现会话，**在默认情况下会利用分布式缓存来存储会话状态**。

每个会话都有一个被称为`Session Key`的标识（不唯一），会话状态以一个数据字典的形式将 `Session Key`保存在服务端。当`SessionMiddleware`中间件在处理会话的第一个请求时，它会创建一个`Session Key`，并基于它创建一个独立的数据字典来存储会话状态，应用程序设置的会话状态总是自动保存在当前会话对应的数据字典中。这个`Session Key`最终以`Cookie`的形式写入响应并返回客户端，客户端在每次发送请求时会自动附加这个`Cookie`，从而使应用程序能够准确定位当前会话对应的数据字典。

```csharp{6-12,14,17,19-23}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services
                .AddDistributedRedisCache(options =>
                {
                    options.Configuration =
                        "192.168.0.203:6379,password=123123,connectTimeout=1000,connectRetry=1,syncTimeout=10000";
                    options.InstanceName = "demo";
                })
                .AddSession())
            .Configure(app => app
                .UseSession()
                .Run(async context =>
                {
                    await context.Session.LoadAsync();

                    string sessionTime;
                    if (context.Session.TryGetValue("SessionTime", out var val))
                        sessionTime = Encoding.UTF8.GetString(val);
                    else
                        context.Session.SetString("SessionTime", sessionTime = DateTime.Now.ToString());

                    await context.Response.WriteAsync(JsonConvert.SerializeObject(new
                    {
                        SessionID = context.Session.Id,
                        SessionTime = sessionTime,
                        CurrentTime = DateTime.Now
                    }));
                })
            ))
        .Build()
        .Run();
}
```
我们利用Chrome先后两次访问目标站点，由于两次访问是在同一个会话中，所以`SessionID`和会话状态值都是一致的。但利用Safari请求则会开启一个新的会话，所以我们会看到不一样的值。


## 2. 会话缓存
会话状态在默认情况下采用分布式缓存的形式来存储，而我们的实例采用的是基于Redis数据库的分布式缓存,缓存状态是基于作为会话标识的`Session Key`进行存储的，它是一个不同于`Session ID`的`GUID`。我们可以采用反射的方式得到代表当前会话的`DistributedSession`对象的私有`_sessionKey`字段值。

![Session缓存](https://i.loli.net/2021/03/30/ytB34IF9P7nCDWK.png)

当会话状态在采用默认的分布式缓存进行存储时，整个数据字典（包括`Key`和`Value`）会采用预定义的格式序列化成字节数组。基于会话状态的缓存默认采用的是基于滑动时间的过期策略，默认采用的滑动过期时间为20分（12000000000纳秒）。

## 3. Cookie
虽然整个会话状态数据存储在服务端，但是用来提取对应会话状态数据的`SessionKey`需要以 `Cookie` 的形式由客户端来提供。如果请求没有以 `Cookie` 的形式携带`Session Key`，`SessionMiddleware`中间件就会将当前请求视为会话的第一次请求，在此情况下，它会生成一个`GUID`作为`Session Key`，并最终以`Cookie`的形式返回客户端。

![cookie_response.png](https://i.loli.net/2021/03/30/YfpALeNO6wUK5FT.png)

如上所示的代码片段是响应报头中携带`Session Key`的`Set-Cookie`报头在默认情况下的表现形式。可以看出，`Session Key`的值不仅是被加密的，更具有一个`httponly`标签，以防止`Cookie`值被跨站读取。在默认情况下，`Cookie`采用的路径为“/”。当我们使用同一个浏览器访问目标站点时，发送的请求将以如下形式附加上这个`Cookie`。

![cookie_request.png](https://i.loli.net/2021/03/30/sxXfpvNIUKGjB9o.png)

`Session Key`和`Session ID`是两个不同的概念，`Session ID`可以作为会话的唯一标识，两个不同的`Session`肯定具有不同的`Session ID`，但是它们可能共享相同的`Session Key`。当`SessionMiddleware`接收到会话的第一个请求时，它会创建两个不同的`GUID`来分别表示`SessionKey`和`Session ID`。其中，`Session ID`将作为会话状态的一部分被存储起来，而`Session Key`以`Cookie`的形式返回客户端。会话过期，存储的会话状态数据（包括`Session ID`）会被清除，但是请求携带可能还是原来的`Session Key`。在这种情况下，`SessionMiddleware`会创建一个新的会话，该会话具有不同的`Session ID`，但是整个会话状态依然沿用这个`Session Key`，所以`Session Key`并不能唯一标识一个会话。

## 4. 其它操作
### 4.1 ISession
我们针对会话状态的所有操作（设置、提取、移除和清除）都是通过调用`ISession`接口相应的方法（`Set`、`TryGetValue`、`Remove`和 `Clear`）来完成的。我们可以利用`Id`属性得到当前会话的`Session ID`，通过`Keys`属性得到所有会话状态条目的`Key`。

```csharp
public interface ISession
{
    bool IsAvailable { get; }
    string Id { get; }
    IEnumerable<string> Keys { get; }

    Task LoadAsync(CancellationToken cancellationToken = default(CancellationToken));
    Task CommitAsync(CancellationToken cancellationToken = default(CancellationToken));

    bool TryGetValue(string key, [NotNullWhen(true)] out byte[]? value);
    void Set(string key, byte[] value);
    void Remove(string key);
    void Clear();
}
```
对于针对基本操作的 4个方法`Set`、`TryGetValue`、`Remove`和 `Clear`）来说，它们针对会话状态的设置、提取、移除和清除都是在内存中进行的。在调用这几个方法之前，`ISession`对象需要确保后备存储（如 Redis数据库）的会话状态被加载到内存之中。会话状态的异步加载可以直接调用 `LoadAsync`方法来完成，而上述 4个方法在会话状态未被加载的情况下会采用同步的方式加载它们。`IsAvailable`表示会话桩体是否已被加载到内存。

由于作用于`ISession`对象上的 4 个基本会话状态操作都是针对内存的，这些操作最终需要通过 CommitAsync方法做统一的提交。`SessionMiddleware`会在完成请求处理之前调用这个方法，该方法会将当前请求针对会话状态的改动保存到后备存储中。另外，只有在当前请求上下文中真正对会话状态做了相应改动的情况下，`ISession`对象的`CommitAsync`方法才会真正执行提交操作。

### 4.2 SessionOptions
由于保存会话状态的`Session Key`是通过`Cookie`进行传递的，所以`SessionOptions`承载的核心配置选项是`Cookie`属性表示的`CookieBuilder`对象。

```csharp
public class SessionOptions
{
    private CookieBuilder _cookieBuilder = new SessionCookieBuilder();
    public CookieBuilder Cookie
    {
        get => _cookieBuilder;
        set => _cookieBuilder = value ?? throw new ArgumentNullException(nameof(value));
    }

    public TimeSpan IdleTimeout { get; set; } = TimeSpan.FromMinutes(20);
    public TimeSpan IOTimeout { get; set; } = TimeSpan.FromMinutes(1);

    private class SessionCookieBuilder : CookieBuilder
    {
        public SessionCookieBuilder()
        {
            Name = SessionDefaults.CookieName;
            Path = SessionDefaults.CookiePath;
            SecurePolicy = CookieSecurePolicy.None;
            SameSite = SameSiteMode.Lax;
            HttpOnly = true;
            // Session is considered non-essential as it's designed for ephemeral data.
            IsEssential = false;
        }

        public override TimeSpan? Expiration
        {
            get => null;
            set => throw new InvalidOperationException(nameof(Expiration) + " cannot be set for the cookie defined by " + nameof(SessionOptions));
        }
    }
}

public static class SessionDefaults
{
    public static readonly string CookieName = ".AspNetCore.Session";
    public static readonly string CookiePath = "/";
}
```

`SessionOptions`的`Cookie`属性返回的是一个 SessionCookieBuilder 的对象，它对 `Cookie`的名称（`.AspNetCore.Session`）、路径（`/`）和安全策略（`None`）等做了一些默认设置。`CookieBuilder`对象的`HttpOnly`属性表示响应的`Cookie`是否需要添加一个`httponly`标签，在默认情况下这个属性为`True`。`SameSite`属性表示是否会在生成的`Set-Cookie`中设置`SameSite`属性以阻止浏览器将它跨域发送，该属性的默认值为`Lax`，表示 `SameSite` 属性会被设置。`CookieBuilder`对象的`IsEssential`属性与`Cookie`的许可授权策略（`Cookie` Consent Policy`）有关，该属性的默认值为`False`，表示为了实现会话支持针对 `Cookie` 的设置不需要得到最终用户的显式授权。

`SessionOptions` 的 `IdleTimeout` 属性表示会话过期时间，具体来说应该是客户端最后一次访问时间到会话过期之间的时长。如果这个属性未做显式设置，该属性会采用默认的会话过期时间 20 分，`SessionOptions`的 `IOTimeout`属性表示基于`ISessionStore`的会话状态的读取和提交所运行的最长时限，默认为1分。