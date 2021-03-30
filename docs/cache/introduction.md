# 缓存

缓存是提高应用程序性能最常用和最有效的“银弹”。借助.NET Core 提供的缓存框架，我们不仅可以将数据缓存在应用进程的本地内存中，还可以采用分布式的形式将缓存数据存储在一个“中心数据库”中。ASP.NET Core 框架还借助一个中间件实现了所谓的“响应缓存”，即按照HTTP缓存规范对整个响应内容实施缓存。

## 1. 本地内存缓存
### 1.1 基本使用
相较于针对数据库和远程服务调用这种 IO操作来说，针对内存的访问在性能上将获得不只一个数量级的提升，所以将数据对象直接缓存在应用进程的内容中具有最佳的性能优势。基于内存的缓存框架实现在 NuGet 包`Microsoft.Extensions.Caching.Memory`中，具体的缓存功能承载于通过`IMemoryCache`接口表示的服务对象。由于缓存的数据直接存放在内存中，并且不涉及持久化存储，所以无须考虑针对缓存对象的序列化问题，这种内存模式对缓存数据的类型也就没有任何限制。

```csharp{9-11}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services.AddMemoryCache())
            .Configure(app => app
                .Run(async context =>
                {
                    var cache = app.ApplicationServices.GetRequiredService<IMemoryCache>();
                    if (!cache.TryGetValue<DateTime>("CurrentTime", out var currentTime))
                        cache.Set("CurrentTime", currentTime = DateTime.Now);

                    await context.Response.WriteAsync($"cachedTime:{currentTime}\r\nserverTime:{DateTime.Now}");
                })
            ))
        .Build()
        .Run();
}
```
以上Asp.NET Core Web应用多次请求，`cachedTime`在过期之前是不变的，而`serverTime`则是随时间变化的。

### 1.2 过期策略
#### 1.2.1 过期时间
缓存数据仅仅是真实数据的一份副本而已，应用程序应该尽可能保证两者的一致性。缓存一致性可以通过过期策略来实现。当我们调用`IMemoryCache`接口的`TryGetValue`方法通过指定的`Key`试图获取对应的缓存数据时，该方法会进行过期检验，过期的内存条目会被直接从缓存字典中移除，此时该方法会返回`False`。本地内存缓存会采用两种针对时间的过期策略，分别是针对绝对时间（`Absolute Time`）和滑动时间（`Sliding Time`）的过期策略。绝对时间过期策略利用`ICacheEntry`对象的`AbsoluteExpiration`属性和`AbsoluteExpirationRelativeToNow`属性判断缓存是否过期，如果这两个属性都做了设置`IMemoryCache`在这种情况下会选择距离当前时间最近的那个时间过期。

```csharp
// 缓存数据并设置绝对过期时间
cache.Set("key", "value", TimeSpan.FromMinutes(5));

// 缓存并设置活动过期时间
var entry= cache.CreateEntry("key");
entry.SetValue("value");
entry.SetSlidingExpiration(TimeSpan.FromMinutes(5));
```

#### 1.2.2 过期通知
除了设置缓存过期时间，开发者可以利用`IChangeToken`对象来发送缓存过期通知。比如需要从一个物理文件中读取文件内容，为了最大限度地避免针对文件系统的 IO操作，可以将文件内容进行缓存。缓存的内容将永久有效，直到物理文件的内容被修改。
```csharp{17-31,33}
static async Task Main(string[] args)
{
    var cache = new ServiceCollection()
        .AddMemoryCache()
        .BuildServiceProvider()
        .GetRequiredService<IMemoryCache>();

    var fileProvider = new PhysicalFileProvider(Directory.GetCurrentDirectory());
    const string filename = "appsettings.json";
    async Task<string> ReadAsync()
    {
        var file = fileProvider.GetFileInfo(filename);
        using var reader = new StreamReader(file.CreateReadStream());
        return await reader.ReadToEndAsync();
    }

    var options = new MemoryCacheEntryOptions();
    options.ExpirationTokens.Add(fileProvider.Watch(filename));
    options.PostEvictionCallbacks.Add(new PostEvictionCallbackRegistration
    {
        EvictionCallback =
            async (key, value, reason, state) =>
            {
                var content = await ReadAsync();
                Console.WriteLine($"oldValue:{value}\r\nnewValue{content}");

                options.ExpirationTokens.Clear();
                options.ExpirationTokens.Add(fileProvider.Watch(filename));
                cache.Set(key, content, options);
            }
    });

    cache.Set("configuration", await ReadAsync(), options);

    Console.ReadKey();
}
```

### 1.3 缓存压缩
虽然基于内存的缓存具有最好的性能，但是如果当前进程的内存资源被缓存数据大量占据，基于内存的缓存采用了一种被称为“内存压缩”的机制，该机制确保在运行时执行垃圾回收会按照相应的策略以一定的比率压缩缓存占据的内存空间。实际上就是根据预定义的策略删除那些“重要性低”的`ICacheEntry`对象。如果`MemoryCache`对象被设置为需要压缩缓存占用的内存空间（该选项通过`MemoryCacheOptions`类型的`CompactOnMemoryPressure`属性来设置，该属性默认返回`True`。

```csharp
//缓存数据并设置数据重要性
cache.Set("key", "value", new MemoryCacheEntryOptions {Priority = CacheItemPriority.Low});
```

## 2. 分布式缓存
虽然本地内存缓存可以获得最高的性能优势，但对于部署在集群的应用程序会出现缓存数据不一致的情况。对于这种部署场景，我们需要将数据缓存在某个独立的存储中心，以便让所有的 Web 服务器共享同一份缓存数据，我们将这种缓存形式称为分布式缓存。.NET Core为分布式缓存提供了两种原生的存储形式：一种是基于NoSQL的Redis数据库，另一种是关系型数据库SQL Server。Redis 是目前较为流行的 NoSQL 数据库，很多编程平台都将其作为分布式缓存的首选，SQL Server等关系型数据库作缓存使用较少，所以这里我们仅对Redis缓存做探讨。

不论采用Redis、SQL Server还是其他的分布式存储方式，缓存的读和写都是通过由 `IDistributedCache`接口表示的服务对象来完成的。承载Redis 分布式缓存框架的 NuGet包`Microsoft.Extensions.Caching.Redis`。

```csharp {5-10,15-24}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services.AddDistributedRedisCache(options =>
            {
                options.Configuration =
                    "192.168.0.203:6379,password=123123,connectTimeout=1000,connectRetry=1,syncTimeout=10000";
                options.InstanceName = "demo";
            }))
            .Configure(app => app
                .Run(async context =>
                {
                    var cache = app.ApplicationServices.GetRequiredService<IDistributedCache>();
                    var currentTime = await cache.GetStringAsync("CurrentTime");
                    if (string.IsNullOrWhiteSpace(currentTime))
                        // await cache.SetStringAsync("CurrentTime", currentTime = DateTime.Now.ToString());
                        await cache.SetStringAsync("CurrentTime", currentTime = DateTime.Now.ToString(),new DistributedCacheEntryOptions
                        {
                            //绝对过期时间
                            AbsoluteExpiration = DateTimeOffset.FromUnixTimeSeconds(600),
                            //滑动过期时间
                            SlidingExpiration = TimeSpan.FromMinutes(5)
                        });

                    await context.Response.WriteAsync($"cachedTime:{currentTime}\r\nserverTime:{DateTime.Now}");
                })
            ))
        .Build()
        .Run();
}
```
分布式缓存涉及网络传输和持久化存储，置于缓存中的数据类型只能是字节数组，所以我们需要自行负责对缓存对象的序列化和反序列化工作。存数据在 Redis 数据库中是以`Hash`结构存储的，对应的`Key`会将设置的`InstanceName`属性作为前缀。存入 Redis数据库的不仅包括指定的缓存数据（`Sub-Key`为`data`），还包括其他两组针对该缓存条目的描述信息，对应的`Sub-Key`分别为 `absexp`和`sldexp`，表示缓存的绝对过期时间和滑动过期时间。

## 3. 响应缓存
上面两种缓存都要求利用注册的服务对象以手动方式存储和提取具体的缓存数据，而下面演示的缓存则不再基于某个具体的缓存数据，而是将服务端生成的HTTP 响应的内容予以缓存，我们将这种缓存形式称为响应缓存（`ResponseCaching`）。

**HTTP 规范下的缓存只针对方法为`GET`的请求或者`HEAD`的请求**，这样的请求旨在获取URL所指向的资源或者描述资源的元数据。

缓存会根据一定的规则在本地存储一份原始服务器提供的响应副本，并赋予它一个“保质期”，保质期内的副本可以直接用来作为后续匹配请求的响应，所以缓存能够避免客户端与原始服务器之间不必要的网络交互。即使过了保质期，缓存也不会直接从原始服务器中获取最新的响应副本，而是选择向其发送一个请求来检验目前的副本是否与最新的内容一致，如果原始服务器做出“一致”的答复，原本过期的响应副本又变得“新鲜”并且被继续使用。所以，缓存还能避免冗余资源在网络中的重复传输。

```csharp{5,7,10-14,23-24}
public static void Main(string[] args)
{
    Host.CreateDefaultBuilder()
        .ConfigureWebHostDefaults(builder => builder
            .ConfigureServices(services => services.AddResponseCaching())
            .Configure(app => app
                .UseResponseCaching()
                .Run(async context =>
                {
                    context.Response.GetTypedHeaders().CacheControl = new CacheControlHeaderValue
                    {
                        Public = true,
                        MaxAge = TimeSpan.FromSeconds(3600)
                    };

                    await context.Response.WriteAsync(
                        context.Request.Query.ContainsKey("utc")
                            ? DateTime.UtcNow.ToString()
                            : DateTime.Now.ToString());

                            context.Features.Get<IResponseCachingFeature>().VaryByQueryKeys = new[] {"utc"};

                    // 查询字符串“utc” 纳入缓存路径
                    //context.Features.Get<IResponseCachingFeature>().VaryByQueryKeys = new[] {"utc"};
                })
            ))
        .Build()
        .Run();
}
```
Asp.Net Core借助`ResponseCachingMiddleware`中间件实现响应缓存。对于最终实现的请求处理逻辑来说，我们仅仅是为响应添加了一个`Cache-Control`报头（`public`表示共享缓存，而 `max-age`则表示过期时限，单位为秒）。私有缓存为单一客户端存储响应副本，所以它不需要过多的存储空间，如浏览器利用私有缓存空间（本地物理磁盘或者内存）存储常用的响应文档，它的前进/后退、保存、查看源代码等操作访问的都是本地私有缓存的内容。有了私有缓存，我们还可以实现脱机浏览文档。共享缓存又称为公共缓存，它存储的响应文档可以被所有的客户端共享，这种类型的缓存一般部署在一个私有网络的代理服务器上，我们将这样的服务器称为缓存代理服务器。缓存代理服务器可以从本地提取相应的响应副本对来自本网络的所有主机的请求予以响应，同时代表它们向原始服务器发送请求。

`ResponseCachingMiddleware`中间件在默认情况下是针对请求的路径对响应实施缓存的，它会忽略请求URL携带的查询字符串。对于演示的这个实例，我们希望将查询字符串“utc”纳入缓存的范畴，这可以利用`IResponseCachingFeature`接口表示的特性来实现，实现如23-24行代码。
