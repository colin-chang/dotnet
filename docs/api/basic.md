# WebAPI基础

`WebAPI`是一种用来开发系统间接口、设备接口`API`的技术,基于`Http`协议,请求和返回格式结果默认是`json`格式。比`WCF`更简单、更通用,比 `WebService`更节省流量、更简洁。

普通`ASP.Net MVC`甚至`HttpHandler`也可以开发`API`,但 `WebAPI`是更加专注于此的技术，更专业。

`Asp.Net WebAPI`和`Asp.Net MVC`有着非常密切的联系，`WebAPI`中可以复用`MVC`的路由、`ModelBinder`、`Filter` 等知识,但是只是相仿, 类名、命名空间等一般都不一样,用法也有一些差别。

Asp.Net WebAPI 具有以下特点：
* `Action`方法更专注于数据处理
* 更适合于`Restful`风格 
* 不依赖于`Web服务器 `,可以`selfhost`,或者寄宿于控制台或服务程序等
* 没有界面。`WebAPI`是接口开发技术,普通用户不会直接和`WebAPI`打交道

## 1. Restful
`Http`设计之初是有 **“谓词语义”** 的。这里谓词是指`HttpMethod`,常用的包括`Get`、`Post`、`Put`、`Delete` 等。

通常情况下，使用`Get`获取数据，使用`Post`新增数据，使用`Put`修改数据，使用`Delete`删除数据。使用`Http`状态码表示处理结果。如 找不到资源使用`404`，没有权限使用`401`。此设计倾向于把所有业务操作抽象成对资源的CRUD操作。

如果`API`设计符合`Http`谓词语义规则，那么就可以称其符合`Restful`风格。Asp.Net WebAPI 设计之初就符合`Restful`风格。

`Restful`风格设计具有以下优势：
* 方便按类型操作做权限控制，如设置`Delete`权限只需处理`Delete`请求方式即可。
* 不需要复杂的`Action`方法名，转而根据`HttpMethod`匹配请求
* 充分利用`Http`状态码,不需要另做约定
* 浏览器可以自动缓存`Get`请求,有利于系统优化

`Restful`风格设计同时也有许多弊端。仅通过谓词语义和参数匹配请求理论性太强，许多业务很难完全拆分为CRUD操作，如用户登录同时更新最后登录时间。另外，`Http`状态码有限，在很多业务场景中不足以表述处理结果，如“密码错误”和“AppKey错误”。

由于以上问题，导致`Restful`设计在很多业务场景中使用不便，很多大公司`API`也鲜少都能满足`Restful`规范。因此我们的原则是，尽可能遵守`Restful`规范，灵活变通，不追求极端。

## 2. WebAPI基础
### 2.1 ApiController
* WebAPI中`Controller`直接即继承自`ControllerBase`。在ASP.NET Core 2.1之后引入`[ApiController]`用于批注 Web API 控制器类。`[ApiController]`特性通常结合`ControllerBase`来为控制器启用特定 REST 行为。

    ```csharp
    [Route("api/[controller]")]
    [ApiController]
    public class ProductsController : ControllerBase
    ```

* 在 ASP.NET Core 2.2 或更高版本中，可将`[ApiController]`特性应用于程序集。以这种方式进行注释，会将 web API 行为应用到程序集中的所有控制器。 建议将程序集级别的特性应用于 Startup 类。
    ```csharp
    [assembly: ApiController]
    namespace WebApiSample.Api._22
    {
        public class Startup
        {
        }
    ```

### 2.2 参数
`GET`、`POST`、`PUT`、`DELETE`等所有请求方式均可使用 URL参数 和 对象参数 进行参数传递。

`GET`和`DELETE`请求通常传递数据量较少，多使用URL参数。`POST`和`PUT`请求通常传递数量较大，多使用对象参数。

#### 2.2.1 URL参数
简单参数有两种，QueryString参数和路由参数，这两种都参数以不同形式体现在URL中，所以我们统称为URL参数。

在参数少且简单对安全性要求不高的情况下，可以使用URL参数。

```csharp
[Route("api/test")]
public class TestController : ControllerBase
{
    //GET api/test?name=colin&age=18
    [HttpGet]
    public ActionResult<string> Get(string name, int age)
    {
        return name + age;
    }

    //DELETE api/test/1
    [HttpDelete("{id}")]
    public ActionResult Delete(int id)
    {
        return NoContent();
    }
}
```

#### 2.2.2 对象参数
参数内容多且复杂或安全性较高的情况下，在API中接收参数时我们常把参数字段封装到一个参数模型类中。**使用非URL参数而不在服务端封装对象会遇到很多麻烦，不建议使用。**

客户端传递对象参数的方式有很多中，一般需要约定`Content-Type`报文头。服务端接收对象参数常使用`[FromXXX]`特性。

特性|ContentType|传参方式
:-|:-|:-
`[FromQuery]`| - |`?name=colin&age=18`
`[FromHeader]`| - 或 `application/x-www-form-urlencoded` 或 `multipart/form-data`  |`?name=colin&age=18` 或 `key-value`对
`[FromForm]`|`multipart/form-data` 或 `application/x-www-form-urlencoded`| `name-value`对
`[FromBody]` 或 无标记|`application/json`|`{name:'colin',age:18}`

```csharp
[Route("api/test")]
public class TestController : ControllerBase
{
    [HttpPost]
    public ActionResult Post([FromForm] Person p)
    {
        return CreatedAtAction(nameof(Post), new {id = p.Id}, p);
    }

    [HttpPut("{id}")]
    public ActionResult Put(int id, [FromBody] Person p)
    {
        return NoContent();
    }
```

![POST请求表单参数](https://i.loli.net/2020/02/26/BK8ALvHeqthEYG5.png)

![PUT请求JSON参数](https://i.loli.net/2020/02/26/QwxlN83juSkFMWI.png)

> JSON

ContentType为applciation/json时，传递参数必须是[JSON格式](https://www.json.org/)。

按照JSON官网的规范（"A value can be a string in double quotes, or a number, or true or false or null, or an object or an array. These structures can be nested."），JSON可以直接传递字符串、数字和布尔三种简单类型。需要特别注意的是，字符串需要包裹在双引号直接(**双引号作为字符串的一部分**)。

```csharp
[HttpPost]
public void Post([FromBody] string value)
{
}
```

![POST字符串](https://i.loli.net/2020/02/26/ISQYUX3DcBlH7om.jpg)

![POST Ajax](https://i.loli.net/2020/02/26/IbmZe26jgABL8yu.jpg)

### 2.3 返回值

ASP.NET Core 提供以下 Web API 控制器操作返回类型选项：
* 特定类型
* IActionResult
* ActionResult&lt;T&gt;

多数情况下返回数据时统一使用`ActionResult`&lt;T&gt;类型。`T`是实际属数据类型，在`Action`方法中编码时直接返回`T`类型数据即可。ASP.NET Core 自动将对象序列化为 JSON，并将 JSON 写入响应消息的正文中。

三种返回类型具体区别和使用参见[官方文档](https://docs.microsoft.com/zh-cn/aspnet/core/web-api/action-return-types?view=aspnetcore-2.2)。

### 2.4 安全传输
* [认证授权](auth.md)。对API做认证授权，每次请求接口需要携带认证信息，如`JWT Token`
* 请求重放。重复请求一个接口，如充值接口。要避免重复业务处理。每次请求的时候都带着当前时间(时间戳),服务器端比 较一下如果这个时间和当前时间相差超过一定时间,则失效。因此最多被重放一段时间, 这个要求客户端的时间和服务器端的时间要保持相差不大。有些业务场景下要使用一次性验证。
* HTTPS。如果API暴露于外网建议使用HTTPS协议，可以增加被抓包难度。