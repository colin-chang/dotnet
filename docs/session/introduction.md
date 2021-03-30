# 会话

## 1. Session
在Asp.Net Core中使用Session需要首先添加对Session的支持,否则会报错`Session has not been configured for this application or request`。

Session使用步骤：
* 1) 注册服务。`ConfigureServices`中`services.AddSession()`;
* 2) 注册中间件。`Configure`中`app.UseSession()`;
* 3）使用Session

```csharp
HttpContext.Session.SetString("userName","Colin");
string userName = HttpContext.Session.GetString("userName")
```

目前`Session`默认仅支持存储`int`、`string`和`byte[]`类型，其它复杂类型可以使用json序列化后存储字符串。

`TempData`也依赖于`Session,`所以也要配置`Session`。

默认`Session`为服务器端进程内存储，我们也可以使用`Redis`做进程外`Session`。