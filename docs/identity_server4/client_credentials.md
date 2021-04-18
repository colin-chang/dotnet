# Client Credentials

在了解了Identity Server的基础知识后，本节我们简单演示如何使用最简单的`Client Credentials`方式来保护API资源。相关案例代码已分享到[Github](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServer)。

## 1. Identity Server
首先我们建立`Identity Server`，官方提供了`IdentityServer templates`项目模板。
```bash
# 安装 IdentityServer 官方项目模板
dotnet new -i IdentityServer4.Templates
```
我们使用`IdentityServer4 Empty`模板建立一个空的Identity Server4项目。

接下来我们配置被保护的资源和客户端。项目模板中默认会创建一个`Config.cs`文件用于演示在内存中配置被保护资源和客户端，生产项目中可以根据实际情况从配置文件或DB中加载配置。

```csharp{5,11,18-24}
public static class Config
{
    //Identity data
    public static IEnumerable<IdentityResource> IdentityResources =>
        new IdentityResource[] {new IdentityResources.OpenId(),};

    //APIs
    public static IEnumerable<ApiScope> ApiScopes =>
        new[]
        {
            new ApiScope("WeatherApi", "天气预报")
        };

    //Clients
    public static IEnumerable<Client> Clients =>
        new[]
        {
            new Client
            {
                ClientId = "ClientCredentialConsoleClient",
                ClientSecrets = {new Secret("ClientCredentialConsoleClient".Sha256())},
                AllowedGrantTypes = GrantTypes.ClientCredentials,
                AllowedScopes = {"WeatherApi"}
            }
        };
}
```
接下来我们注册`Identity Server`服务和中间件。
```csharp{3-6,9,17}
public void ConfigureServices(IServiceCollection services)
{
    var builder = services.AddIdentityServer(options => options.EmitStaticAudienceClaim = true)
        .AddInMemoryIdentityResources(Config.IdentityResources)
        .AddInMemoryApiScopes(Config.ApiScopes)
        .AddInMemoryClients(Config.Clients);

    // not recommended for production - you need to store your key material somewhere secure
    builder.AddDeveloperSigningCredential();
}

public void Configure(IApplicationBuilder app, IWebHostEnvironment environment)
{
    if (environment.IsDevelopment())
        app.UseDeveloperExceptionPage();

    app.UseIdentityServer();
}
```
至此`IdentityServer`已配置完成，运行后访问`https://localhost:5001/.well-known/openid-configuration`可以看到`discovery document`配置，注册到`IdentityServer`的客户端和API都通过此`discovery document`获取必要的配置数据。

## 2. API
我们创建一个标准的Asp.Net Core Web API程序，在`Startup`中注册认证授权服务和中间件。这里我们使用`JWT`认证方案，并通过其`Authority`属性将认证服务指向`IdentityServer`即可。

`IdentityServer`认证客户端访问被保护的API资源时会携带名为`scope`的`Claim`对象。在API中可以以此进行鉴权，本案例中我们使用`scope`建立对应授权策略进行鉴权。

```json
{
  "IdentityServerOptions": {
    "Address": "https://localhost:5000",
    "Scopes": [
      "WeatherApi"
    ]
}
```
```csharp{4-21,28-29}
public void ConfigureServices(IServiceCollection services)
{
    services.AddControllers();
    var identityServerOptions =
        Configuration.GetSection(nameof(IdentityServerOptions)).Get<IdentityServerOptions>();
    services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
        {
            options.Authority = identityServerOptions.Address;
            options.TokenValidationParameters = new TokenValidationParameters {ValidateAudience = false};
        });
    services.AddAuthorization(options =>
    {
        foreach (var scope in identityServerOptions.Scopes)
            options.AddPolicy(scope, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireClaim("scope", scope);
            });
    });
}

public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    app.UseHttpsRedirection();
    app.UseRouting();
    app.UseAuthentication();
    app.UseAuthorization();
    app.UseEndpoints(endpoints => endpoints.MapControllers());
}

public class IdentityServerOptions
{
    public string Address { get; set; }
    public IEnumerable<string> Scopes { get; set; }
}
```

API我们使用默认的`WeatherForecastController`即可，在控制器中使用`AuthorizationAttribute`鉴权。
```csharp{3}
[ApiController]
[Route("[controller]")]
[Authorize("WeatherApi")]
public class WeatherForecastController : ControllerBase
{
    private static readonly string[] Summaries =
    {
        "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
    };

    [HttpGet]
    public IEnumerable<WeatherForecast> Get()
    {
        var rng = new Random();
        return Enumerable.Range(1, 5).Select(index => new WeatherForecast
            {
                Date = DateTime.Now.AddDays(index),
                TemperatureC = rng.Next(-20, 55),
                Summary = Summaries[rng.Next(Summaries.Length)]
            })
            .ToArray();
    }
}
```
至此API项目配置完成，启动应用并访问`https://localhost:6000/WeatherForecast`得到`401`响应码，说明API需要授权且已被`IdentityServer`保护。

## 3. Client
本节我们创建一个控制台程序作为客户端。`IdentityModel`Nuget包对`HttpClient`进行了扩展用于与`IdentityServer`交互。

`IdentityServer`和API相关配置如下。

```json
"IdentityServerOptions": {
    "Address": "https://localhost:5000",
    "ClientId": "ClientCredentialConsoleClient",
    "ClientSecret": "ClientCredentialConsoleClient",
    "Scopes": [
      {
        "Name": "WeatherApi",
        "Url": "https://localhost:6000/WeatherForecast"
      }
    ]
  }
```
使用`HttpClient`的`GetDiscoveryDocumentAsync`方法连接`IdentitySever`的`discovery endpoint`可以获得相关认证服务器的相关配置。`IdentityServer`默认仅支持Https协议，本地开发环境第一次可以运行`dotnet dev-certs https --trust`信任开发证书。或者通过如下`16`行代码关闭Https验证。

```csharp{11-25,28-39,43-51}
static async Task Main(string[] args)
{
    var options = new ConfigurationBuilder()
        .AddJsonFile("appsettings.json")
        .Build()
        .GetSection(nameof(IdentityServerOptions))
        .Get<IdentityServerOptions>();

    using var client = new HttpClient();
    //发现IdentityServer配置
    var disco = await client.GetDiscoveryDocumentAsync(new DiscoveryDocumentRequest
    {
        Address = options.Address,
        // Policy = new DiscoveryPolicy
        // {
        //     RequireHttps = false,
        //     ValidateEndpoints = false,
        //     ValidateIssuerName = false
        // }
    });
    if (disco.IsError)
    {
        Console.WriteLine(disco.Error);
        return;
    }

    //获取Token
    var tokenResponse = await client.RequestClientCredentialsTokenAsync(new ClientCredentialsTokenRequest
    {
        Address = disco.TokenEndpoint,
        ClientId = options.ClientId,
        ClientSecret = options.ClientSecret,
        Scope = options.Scope
    });
    if (tokenResponse.IsError)
    {
        Console.WriteLine(tokenResponse.Error);
        return;
    }

    //API调用
    using var apiClient = new HttpClient();
    apiClient.SetBearerToken(tokenResponse.AccessToken);
    var response = await apiClient.GetAsync(options["WeatherApi"]);
    if (!response.IsSuccessStatusCode)
    {
        Console.WriteLine(response.StatusCode);
        return;
    }
    var content = await response.Content.ReadAsStringAsync();
    Console.WriteLine(JArray.Parse(content));
}
```
通过`HttpClient`的`RequestClientCredentialsTokenAsync`方法，使用`ClientId/ClientSecret/Scope`等认证数据在`IdentityServer`获取`Access Token`。获取`AccessToken`后就可以使用令牌调用被保护的API了。

发现`IdentityServer`配置并非必需，也可以直接请求`https://localhost:5000/connect/token`获取`AccessToken`。

## 4. 证书管理
`IdentitySever4`中Token一般采用JWT方案,它使用私钥来签名`JWT token`，公钥验证签名，一般情况下我们通过一个证书提供私钥和公钥。在开发环境中一般通过`IIdentityServerBuilder.AddDeveloperSigningCredential()`注册开发密钥签名。在程序第一次启动时`IdentityServer`会自动创建一个`tempkey.jwk`文件保存密钥，此文件不存在则会在程序启动时自动重建。打开`tempkey.jwk`文件即可得到密钥内容，此方式安全性较低，攻击者获得文件会导致密钥直接泄露。在生产环境中我们一般会生成一个加密的安全证书来提供私钥和公钥。

```csharp{8-13}
 public void ConfigureServices(IServiceCollection services)
{
    var builder = services.AddIdentityServer(options => options.EmitStaticAudienceClaim = true)
        .AddInMemoryIdentityResources(Config.IdentityResources)
        .AddInMemoryApiScopes(Config.ApiScopes)
        .AddInMemoryClients(Config.Clients);

    if (_env.IsDevelopment())
        builder.AddDeveloperSigningCredential();
    else
        builder.AddSigningCredential(
            new X509Certificate2(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "is4.pfx"),
                "5C6CE27CBA3DD15B4EFBE5A7EC679CBBE79D14F5"));
}
```

在上面代码中我们使用了`Pfx`证书，`Pfx`证书除了包含`cer/crt`证书的公钥，还可以选择性的包含`key`密钥文件，同时还可以设置证书密码保护。简而言之通过`Pfx`证书可以安全的提供一对公钥私钥。

生成`Pfx`证书的方式有很多，这里我们推荐一款免费跨平台的证书管理工具——[KeyManager](https://keymanager.org/)。

![screenshot-20210419-030135.jpg](https://i.loli.net/2021/04/19/h8DkEBPpmc7jJM2.jpg)

生成`Pfx`证书流程如上图所示，导出证书时的加密私钥从思源管理中获取即可。如果不确定哪个私钥可以通过相关证书确认。


> 参考文献
* [Identity Server4 官方文档](https://identityserver4.readthedocs.io/en/latest/quickstarts/1_client_credentials.html)
* [Identity Server4 官方案例](https://github.com/IdentityServer/IdentityServer4/tree/main/samples/Quickstarts/1_ClientCredentials)