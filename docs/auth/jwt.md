# JWT

[`JWT`](https://jwt.io/)(`JSON WEB TOKEN`)是一个开放标准(RFC 7519)方法实现，它通过`Json`对象进行网络信息传输，其所传输信息是可以被加密和验证以保证数据安全。`JWT`常用于授权验证和信息传输。

## 1. JWT Token

### 1.1 JWT 认证

`JWT`常用于身份认证，其工作过程与Asp.Net的基于票据的认证模型吻合，具体流程如下图所示。

![JWT验证流程图](https://i.loli.net/2020/02/26/sQbX5qamjrDlGSu.png)

1. 客户端(浏览器等)提交用户凭证(用户名密码等)进行登录
2. 服务端在确定对方真实身份后，将用户身份信息写到一个`Json`对象中并进行签名生成安全令牌( `Token`)
3. 服务端返回安全令牌给给客户端
4. 客户端携带安全令牌(一般通过请求头)并以此令牌所携带身份执行目标操作或者访问目标资源
5. 服务端校验安全令牌签名确认信息未被篡改并获取身份信息，检查授权无误后处理客户端请求
6. 服务端返回请求响应给客户端

### 1.2 JWT与Session

传统在Web开发中常使用[`Session`](/session/introduction.html)进行用户认证，因而很多人常会比较基于`JWT`的认证模型与`Session`的异同优劣。

首先要清楚一点，**`Session`与Asp.Net提供的基于`Cookie`的认证方案完全不同。`Session`会话机制并不包含完整的认证过程，它仅是一种记录用户会话状态的方法，完全可以用于认证无关的场景，在认证场景中，我们在确认用户身份后将数据存储在服务器内存并返回`session_id`标识给客户端，可以简单的认为这是认证的一部分过程。基于`Cookie`的认证方案则与`JWT`有一定相似，认证方颁发的包含用户数据的的票据对应`JWT` `Token`，两者都存储在客户端，两者数据加密方式不同，令牌的传输和存储也有所区别。`Cookie`认证方案使用`Cookie`进行存储和传输票据，`JWT`多使用`localStorage`存储，使用请求头进行数据传输**。

#### 1.2.1 Session

`Session`机制下用户信息记录到称为`Session`的服务端内存中,`Session`是一个`key-value`集合，`key`一般名称为`session_id`唯一标识用户的一次会话，服务端会把`session_id`记录到`Cookie`中并返回给客户端，之后客户端每次请求都会带上这个`session_id`，服务端则可以根据`session_id`值来识别用户。

因为数据存储在服务端，`Session`在一定程度上可以避免敏感数据的泄露，提高了数据安全性。`Session`机制下我们也可以非常方便的控制用户的在线状态。除了以上提到的两点优势，`Session`还存在着以下问题，正因如此使用`Session`鉴权的方式也在逐渐淡出市场。

##### 服务端内存开销

`Session`的实现原理决定了它会造成服务器内存开销，随着认证用户量的增长，服务端的开销会明显增大。进程内`Session`还存在多实例的状态丢失问题，当然开发者有可以使用`Redis`等进程外`Session`来解决。

##### 非Web平台支持度低

因为`Session`是基于`Cookie`实现的，`Cookie`也会带来一定的问题。`Cookie`在Web开发中使用较广泛，但在其它平台如移动端中则较少使用。

##### XSS/XSRF漏洞

由于 `Cookie`可以被`JavaScript`读取导致`session_id`泄露，而作为后端识别用户的标识，`Cookie`的泄露意味着用户信息不再安全。设置 `httpOnly`后`Cookie`将不能被 JS 读取，那么`XSS`注入的问题也基本不用担心了。浏览器会自动的把它加在请求的`header`当中，设置`secure`的话，`Cookie`就只允许通过`HTTPS`传输。`secure`选项可以过滤掉一些使用`HTTP`协议的`XSS`注入，但并不能完全阻止，而且还存在`XSRF`风险。当你浏览器开着这个页面的时候，另一个页面可以很容易的跨站请求这个页面的内容，因为`Cookie`默认被发了出去。

##### 跨域问题

前后端分离的架构中，`Cookie`会阻止域共享访问，需要开发人员解决跨域问题。

#### 1.2.2 JWT

相比于`Session`，`JWT`最大的不同是其数据会被签名后存储在客户端。

优势：

* 节省服务器内存开销。
* `SSO`。因为用户数据保存在客户端，只要保证服务端鉴权逻辑统一即可实现`SSO`
* 跨平台/跨语言支持。不同开发平台和语言对`JWT`支持良好
* 无跨域问题。`Token`多通过请求报文头传输可以避免跨域问题

劣势：

* 不能强制客户端下线。配置不变且`Token`未过期前，无法让客户端下线
* 不可存储敏感信息。数据存储在客户端，虽有签名不可篡改，但信息对用户透明，故不可存储敏感数据
* 不可存储大量数据。每次请求都携带`Token`，`Payload`中数据过多会降低网络传输效率。

## 2. JWT结构

![JWT结构图](https://i.loli.net/2020/02/26/yYPQqZsNBSz2wFC.jpg)

如上图所示，`JWT`由`Header`、`Payload`、`Signature`三部分构成。

### 2.1 Header

属性|含义
:-|:-
`alg`|声明加密的算法 通常使用`HMAC`或`SHA256`
`typ`|声明类型，这里是`JWT`

### 2.2 Payload

这部分是我们存放信息的地方。 包含三个部分"标准注册声明"、"公共声明"、"私有声明"。

标准注册声明是固定名称，存放固定内容但不强制使用。

属性|含义
:-|:-
`iss`|签发者
`sub`|所面向的用户
`aud`|接收方
`exp`|过期时间，这个过期时间必须要大于签发时间
`nbf`|定义在什么时间之前，该`JWT`都是不可用的.
`iat`|签发时间
`jti`|唯一身份标识，主要用来作为**一次性`Token`,从而回避重放攻击**。

公共声明可以添加任何的信息，一般添加用户的相关信息或其它业务需要的必要信息，但不建议添加敏感信息，因为该部分在客户端可解密。私有声明是提供者和消费者所共同定义的声明。

### 2.3 Signature

这部分是防篡改签名。`base64`编码`Header`和`Payload`后使用`.`连接组成的字符串，然后通过`Header`中声明的加密方式进行加盐`SecretKey`组合加密，然后就构成了签名。

对头部以及负载内容进行签名，可以防止内容被窜改。虽然`Header`和`Payload`可以使用`base64`解码后得到明文，但由于不知道`SecretKey`所以客户端或任何第三方篡改内容后无法获得正确签名，服务端校验签名不正确便会得知认证内容被篡改了进而拒绝请求。

`SecretKey`保存在服务器端，用来进行`JWT`的签发和验证，务必确保其安全，一旦泄漏，任何人都可以自我签发`JWT`。

## 3. JWT.NET

### 3.1 创建和验证JWT

我们可以通过以下方式手动创建和验证`JWT`。参考[JWT.NET](https://github.com/jwt-dotnet/jwt)。

```csharp
public static string CreateJwt(Dictionary<string, object> payload, string secret)
{
    var builder = new JwtBuilder()
        .WithAlgorithm(new HMACSHA256Algorithm())
        .WithSecret(secret);

    foreach (var key in payload.Keys)
        builder.AddClaim(key, payload[key]);

    return builder.Build();
}

public static bool VerifyJwt(string token, string secret, out IDictionary<string, object> payload)
{
    try
    {
        payload = new JwtBuilder()
            .WithSecret(secret)
            .MustVerifySignature()
            .Decode<IDictionary<string, object>>(token);

        return true;
    }
    catch (TokenExpiredException)
    {
        //JWT过期
        payload = null;
        return false;
    }
    catch (SignatureVerificationException)
    {
        //签名错误
        payload = null;
        return false;
    }
}
```

### 3.2 JWT 认证方案

Asp.Net在[`Microsoft.AspNetCore.Authentication.JwtBearer`](https://www.nuget.org/packages/Microsoft.AspNetCore.Authentication.JwtBearer)中提供了`JwtBearer`认证方案。接下来我们通过一个`WebAPI`项目基于`JwtBearer`认证方案来重构一下 [上一节认证授权案例](authorize.md#_3-3-%E6%8E%88%E6%9D%83%E4%B8%AD%E9%97%B4%E4%BB%B6%E4%B8%8Emvc%E8%BF%87%E6%BB%A4%E5%99%A8)。

```csharp{11-32}
public class Startup
{
    public Startup(IConfiguration configuration) =>
        Configuration = configuration;

    public IConfiguration Configuration { get; }

    public void ConfigureServices(IServiceCollection services)
    {
        services.AddControllers();
        services.Configure<JwtOptions>(Configuration.GetSection(nameof(JwtOptions)));
        services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                var jwt = Configuration.GetSection(nameof(JwtOptions)).Get<JwtOptions>();
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuer = jwt.ValidIssuer,
                    ValidAudience = jwt.ValidAudience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.IssuerSigningKey)),
                    ValidateIssuerSigningKey = true
                };
            });
            services.AddAuthorization(options => options.AddPolicy("admin", policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireRole("Administrator");
            }));
        services.AddSwaggerGen(c =>
        {
            c.SwaggerDoc("v1", new OpenApiInfo {Title = "ColinChang.ApiSample", Version = "v1"});
        });
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
            app.UseSwagger();
            app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "ColinChang.ApiSample v1"));
        }

        app.UseHttpsRedirection();
        app.UseRouting();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseEndpoints(endpoints => { endpoints.MapControllers(); });
    }
}
```

注册`JWT`认证服务并读取`appsettings.json`中声明的以下配置初始化`JWT`基础配置选项。

```json
{
  "JwtOptions": {
    "ValidIssuer": "https://a-nomad.com",
    "ValidAudience": "https://a-nomad.com",
    "IssuerSigningKey": "~!@#$%^&*()_+[];",
    "Expires": 21600
  }
}
```

在以下API中使用不同的授权认证，但用户未获得授权时API会响应`401 Unauthorized`，当无权访问时API会响应`403 Forbidden`。

```csharp{5,9,13}
[ApiController]
[Route("[controller]")]
public class HomeController : ControllerBase
{
    [Authorize]
    [HttpGet]
    public string Get() => $"{User.Identity.Name} is authenticated";

    [Authorize("admin")]
    [HttpPost]
    public string Post() => $"{User.Identity.Name} is authorized with policy admin";

    [Authorize(Roles = "Administrator")]
    [HttpPut]
    public string Put() => $"{User.Identity.Name} is authorized with role Administrator\nroles:{string.Join(",", User.Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value))}";
}
```

下面是最关键的`JWT`认证过程。需要注意的是`JWT`认证方案中核心认证处理器`JwtBearerHandler`类型继承自`AuthenticationHandler<JwtBearerOptions>`，但并未实现`IAuthenticationSignOutHandler`和`IAuthenticationSignInHandler`，也就没有提供`SignIn`和`SignOut`方法。

```csharp{22-23,25-30}
[ApiController]
[Route("[controller]")]
public class AccountController : ControllerBase
{
    private static readonly IEnumerable<User> Users = new[]
    {
        new User("Colin", "123123", new[] {new Role("Administrator")}),
        new User("Robin", "123123", new[] {new Role("User")})
    };

    [HttpPost]
    public IActionResult Post([FromServices] IOptions<JwtOptions> options, [FromBody]User user)
    {
        if (user == null)
            return BadRequest("user cannot be null");

        var usr = Users.SingleOrDefault(u =>
            string.Equals(u.Username, user.Username, StringComparison.OrdinalIgnoreCase));
        if (!string.Equals(usr?.Password, user.Password, StringComparison.OrdinalIgnoreCase))
            return BadRequest("invalid username or password");

        var claims = new List<Claim> {new Claim(ClaimTypes.Name, user.Username)};
        claims.AddRange(usr.Roles.Select(role => new Claim(ClaimTypes.Role, role.Name)));

        var jwtOptions = options.Value;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.IssuerSigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(jwtOptions.ValidIssuer, jwtOptions.ValidAudience, claims, DateTime.Now,
            DateTime.Now.AddMinutes(jwtOptions.Expires), credentials);
        var jwt = new JwtSecurityTokenHandler().WriteToken(token);

        return Ok(jwt);
    }
}
```

在`JWT`认证方案中生成`Token`时直接使用声明对象，而不需要开发人员构建`IIdentity`身份或`IPrincipal`用户对象。但在客户端携带`Token`发起请求时，服务端依然会自动`decode`并解析客户端用户信息到`HttpContext.User`对象中。

以上案例的模型类和相关视图不涉及认证授权逻辑，此处不再展示。完整案例代码参见[Github](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.ApiSample)。
