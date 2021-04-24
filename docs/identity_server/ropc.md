# Resource Owner Password Credentials

`Resource Owner Password Credentials`授权方式要求资源所有者直接将用户名密码等认证凭证直接提供给客户端端应用，客户端以此向`Identity Server`请求`Access Token`。此方式要求资源所有者可以高度信任客户端应用，否则很容易造成用户名密码等安全信息泄露。由于安全性不高，多用于其它授权方式不可用的历史遗留项目中。本节案例代码已分享到[Github](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServer.ResourceOwnerPasswordCredentialWpfClient)。

![Resource Owner Password Credentials flow](https://i.loli.net/2021/04/22/a8WVMBP9DTlvszg.png)


## 1. Identity Server
本节示例基于[Client Credentials](./cc.md)的案例代码。下面我简单演示本节内容的怎量部分代码。


```csharp{4-5,15,19-20}
public static IEnumerable<IdentityResource> IdentityResources =>
    new IdentityResource[]
    {
        new IdentityResources.OpenId(),
        new IdentityResources.Profile()
    };

public static IEnumerable<Client> Clients =>
    new[]
    {
        new Client
        {
            ClientId = "ResourceOwnerPasswordCredentialClient",
            ClientSecrets = {new Secret("ResourceOwnerPasswordCredentialClient".Sha256())},
            AllowedGrantTypes = GrantTypes.ResourceOwnerPassword,
            AllowedScopes =
            {
                "WeatherApi",
                IdentityServerConstants.StandardScopes.OpenId,
                IdentityServerConstants.StandardScopes.Profile
            }
        }
    };
```
本节案例中客户端要访问的被保护资源包括`Identity data`和`API`,这里我们在`IdentityResources`中开放`OpenId`(必选)和`Profile`(可选)。最后在`IdentityServer`中注册新的客户端。

```csharp{7}
public void ConfigureServices(IServiceCollection services)
{
    var builder = services.AddIdentityServer(options => options.EmitStaticAudienceClaim = true)
        .AddInMemoryIdentityResources(Config.IdentityResources)
        .AddInMemoryApiScopes(Config.ApiScopes)
        .AddInMemoryClients(Config.Clients)
        .AddTestUsers(TestUsers.Users);
}
```
因为需要使用用户名密码登录，此处我们使用`IIdentityServerBuilder.AddTestUsers()`方法注册用户数据用于测试。IdentityServer模板中项目中提供了`TestUser`类定模拟了两个用户的数据。此方式仅作演示，不建议在生产环境中使用，实际生产中用户数据一般从数据库中读取。

```csharp
// 模拟用户数据，仅作演示
public static class TestUsers
{
    public static List<TestUser> Users
    {
        get
        {
            var address = new
            {
                street_address = "One Hacker Way",
                locality = "Heidelberg",
                postal_code = 69118,
                country = "Germany"
            };

            return new List<TestUser>
            {
                new TestUser
                {
                    SubjectId = "818727",
                    Username = "alice",
                    Password = "alice",
                    Claims =
                    {
                        new Claim(JwtClaimTypes.Name, "Alice Smith"),
                        new Claim(JwtClaimTypes.GivenName, "Alice"),
                        new Claim(JwtClaimTypes.FamilyName, "Smith"),
                        new Claim(JwtClaimTypes.Email, "AliceSmith@email.com"),
                        new Claim(JwtClaimTypes.EmailVerified, "true", ClaimValueTypes.Boolean),
                        new Claim(JwtClaimTypes.WebSite, "http://alice.com"),
                        new Claim(JwtClaimTypes.Address, JsonSerializer.Serialize(address),
                            IdentityServerConstants.ClaimValueTypes.Json)
                    }
                },
                new TestUser
                {
                    SubjectId = "88421113",
                    Username = "bob",
                    Password = "bob",
                    Claims =
                    {
                        new Claim(JwtClaimTypes.Name, "Bob Smith"),
                        new Claim(JwtClaimTypes.GivenName, "Bob"),
                        new Claim(JwtClaimTypes.FamilyName, "Smith"),
                        new Claim(JwtClaimTypes.Email, "BobSmith@email.com"),
                        new Claim(JwtClaimTypes.EmailVerified, "true", ClaimValueTypes.Boolean),
                        new Claim(JwtClaimTypes.WebSite, "http://bob.com"),
                        new Claim(JwtClaimTypes.Address, JsonSerializer.Serialize(address),
                            IdentityServerConstants.ClaimValueTypes.Json)
                    }
                }
            };
        }
    }
}
```



## 2. Client
这里[API项目](https://github.com/colin-chang/AuthSamples/tree/main/ColinChang.IdentityServer.Api)使用[Client Credentials](./cc.md#_2-api)中的代码，不再赘述。

`Resource Owner Password Credentials`授权方式客户端需要采集资源所有者的用户名密码等数据，所以客户端一般是带UI的交互式应用，如桌面程序、手机App等。这里我们以一个简单的`WPF`程序作为客户端。

```json
{
  "IdentityServerOptions": {
    "Address": "https://localhost:5000",
    "ClientId": "ResourceOwnerPasswordCredentialClient",
    "ClientSecret": "ResourceOwnerPasswordCredentialClient",
    "Scopes": [
      {"Name": "openid"},
      {"Name": "profile"},
      {
        "Name": "WeatherApi",
        "Url": "https://localhost:6000/WeatherForecast"
      }
    ]
  }
}
```
以上是客户端配置，需要注意的是`openid/profile`是`Identity data`中预定义的`scope`，直接请求`UserInfoEndpoint`即可（参考如下代码第`68`行），因此没有为其声明URL。

```csharp{45-46,68}
public partial class MainWindow : Window
{
    private readonly IdentityServerOptions _options;
    private readonly DiscoveryDocumentResponse _disco;

    public MainWindow()
    {
        InitializeComponent();

        _options = new ConfigurationBuilder().AddJsonFile("appsettings.json").Build()
            .GetSection(nameof(IdentityServerOptions)).Get<IdentityServerOptions>();

        using var client = new HttpClient();
        _disco = client.GetDiscoveryDocumentAsync(new DiscoveryDocumentRequest
        {
            Address = _options.Address,
            // Policy = new DiscoveryPolicy
            // {
            //     RequireHttps = false,
            //     ValidateEndpoints = false,
            //     ValidateIssuerName = false
            // }
        }).Result;
        if (_disco.IsError)
            MessageBox.Show(_disco.Error);
    }

    private async void Signin_ButtonClick(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(txtUsername.Text) || string.IsNullOrWhiteSpace(txtPassword.Password))
        {
            MessageBox.Show("Username and password are required!");
            return;
        }

        //获取Token
        using var client = new HttpClient();
        var tokenResponse = await client.RequestPasswordTokenAsync(new PasswordTokenRequest
        {
            Address = _disco.TokenEndpoint,
            ClientId = _options.ClientId,
            ClientSecret = _options.ClientSecret,
            Scope = _options.Scope,

            UserName = txtUsername.Text,
            Password = txtPassword.Password
        });
        if (tokenResponse.IsError)
        {
            MessageBox.Show(tokenResponse.Error);
            return;
        }

        txtToken.Text = tokenResponse.AccessToken;
    }

    private async void RequestIdentityData_ButtonClick(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(txtToken.Text))
        {
            MessageBox.Show("Please signin first.");
            return;
        }

        using var client = new HttpClient();
        client.SetBearerToken(txtToken.Text);

        var response = await client.GetAsync(_disco.UserInfoEndpoint);
        if (!response.IsSuccessStatusCode)
        {
            MessageBox.Show(response.StatusCode.ToString());
            return;
        }
        txtIdentityData.Text = await response.Content.ReadAsStringAsync();
    }

    private async void RequestApi_ButtonClick(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(txtToken.Text))
        {
            MessageBox.Show("Please signin first.");
            return;
        }

        using var client = new HttpClient();
        client.SetBearerToken(txtToken.Text);

        var response = await client.GetAsync(_options["WeatherApi"]);
        if (!response.IsSuccessStatusCode)
        {
            MessageBox.Show(response.StatusCode.ToString());
            return;
        }

        txtApiResult.Text = await response.Content.ReadAsStringAsync();
    }
}
```

可以看到`Resource Owner Password Credentials`授权方式除了需要采集用户名密码外，其它编码方式与`Client Credentials`无异。当然`Client Credentials`用户访问不属于特定用户的资源因此无法直接通过`UserInfoEndpoint`访问`Identity data`，而`Resource Owner Password Credentials`则可以。

![Resource Owner Password Credentials Client](https://i.loli.net/2021/04/22/BEwfyi9NGKmzsXk.png)

上面案例`Identity data`中我们演示了`OpenId Connect`协议的`profile`标准`scope`。实际`OpenID Connect`中定义了如下4个标准`scope`,其分别包含了一组`Claim`。需要特别注意的是，**如果要访问`OpenId Connect`协议定义的用户数据，务必要在`IdentityResources`中开放`IdentityResources.OpenId()`**

<dl>
<dt><b>profile</b></dt>
<dd>name, family_name, given_name, middle_name, nickname, preferred_username, profile, picture, website, gender, birthdate, zoneinfo, locale, updated_at.
</dd>
<dt><b>email</b></dt>
<dd>email, email_verified</dd>
<dt><b>address</b></dt>
<dd>address</dd>
<dt><b>phone</b></dt>
<dd>phone_number, phone_number_verified</dd>
</dl>

