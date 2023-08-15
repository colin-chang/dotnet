# OAuth2.0 / OpenID Connect

## 1. OAuth2.0

`OAuth2.0`是一个委托授权协议，它可以让控制资源的人(用户)允许某个应用代表它们来访问它们所控制的资源。应用从资源所有者处获得授权`(`Authorization`)和安全访问令牌(`Access Token`)，随后便可以使用`Token`进行资源访问。

![OAuth2.0](https://i.loli.net/2021/04/07/uZNBSAokXK3mQrM.jpg)

`OAuth2.0`授权协议中设计的对象主要涉及 资源所有者(`Resource Owner`)`,客户端应用（`Client Application`）和受保护资源(`Protected Resource`)。三者关系如上图所示。

### 1.1 授权服务器

资源所有者对客户端的授权一般是通过授权服务器(`Authorization Server`)作为中介完成的。

当客户端应用需要访问受保护的资源时，客户端会向资源所有者申请授权并将其重定向到授权服务器，资源所有者在授权服务器进行身份认证(登录)后执行授权操作(一般是点击同意授权)并生成授权码，之后重定向回到客户端应用。此时客户端应用携带授权码向授权服务器发出授权申请，授权服务器验证授权码并生成安全令牌返回给返回到客户端，客户端携带安全令牌申请访问受保护资源的服务器，服务器鉴权通过后返回响应。

![授权服务器工作流程](https://i.loli.net/2021/04/07/IFDMimE93XdtlTo.jpg)

如上图所示的是`OAuth2.0`协议中的较为流行的授权码(`Authorization Code`)类型的授权方式。

### 1.2 客户端类型

在OAuth2.0中我们常将客户端分为机密客户端（`Confidential Client`）和公开客户端（`Public Client`）两种类型。

机密客户端一般含有服务端，相对安全，有能力维护其凭证的机密性，如Asp.Net MVC应用。

公开客户端通常运行在客户端设备，内容相对相对透明且不安全，数据存在被篡改的风险，故而也无法维护其凭证的机密性，如Web端JavaScript应用，移动App，桌面端应用程序等。

### 1.3 授权类型

`OAuth2.0`协议中常用的授权类型([`Grant Type`](http://docs.identityserver.io/en/release/topics/grant_types.html))有以下几种：

* 客户端凭据授权（`Client Credential`）。
* 资源所有者密码凭据授权（`Resource Owner Password Credentials`）
* 授权码授权（`Authorization Code`）
* 隐式授权（`Implicit`）
* 刷新令牌授权（`Refresh Token`）

客户端凭据授权（`Client Credential`）是最简单的授权方式，适用于服务器间的交互，安全令牌用于标识一个客户端应用而不是一个具体用户。此模式仅作客户端认证，不需要使用授权服务器中的用户资源。客户端使用`Client ID`和`Client Secret`认证到授权服务器以获得安全令牌。这种模式是最方便但最不安全的模式。因此这就要求我们对客户端完全信任，且客户端自身也是安全的。

资源所有者密码凭据授权（`Resource Owner Password Credentials`）方式会需要资源所有者将用户名密码等安全认证数据提供给客户端，客户端使用资源所有者提供的密码等认证数据向授权服务器换取安全令牌，之后客户端使用安全令牌访问保护资源。此方式被称作“非交互式”授权，通常不推荐使用，只有资源所有者（用户）可以高度信任客户端应用且其它授权方式不可用时才会采用此方式。

授权码授权（`Authorization Code`）方式适用于机密客户端。授权服务器会对资源所有者和客户端进行双重认证。当资源所有者在授权服务器身份认证后，授权服务器会生成授权码返回给机密客户端的用户端，如浏览器。客户端再携带授权码请求授权服务器进行身份认证，授权服务器验证授权码无误后生成安全令牌返回给机密客户端的服务端，如Web服务器，客户端应用会将此安全令牌保存在自己的服务端。如果客户端是一个Web应用，单次有效的授权码会返回给相对不安全的客户端浏览器，而长期有效的安全令牌则返回并保存在相对安全的Web服务器。

隐式授权（`Implicit`）是授权码授权的简化版本，故也称为简化授权。它用户用于基于浏览器的客户端应用，如Web SPA。隐式授权不会对客户端进行身份认证故也没有授权码环节，授权服务器会在资源所有者认证通过后直接将安全令牌通过浏览器返回给客户端。因为所有令牌传输都通过浏览器进行，因此`Refresh Token`等高级特性不能在此模式下使用。

刷新令牌（Refresh Token）授权用于客户端访问令牌过期时向授权服务器申请新的访问令牌，它只能发送给授权服务器并不能用于访问被保护资源，刷新令牌可以让客户端逐渐降低访问权限。刷新令牌仅支持`Hybrid flow, Authorization Code, Device flow, Resource owner password`。

### 1.4 Endpoint

`OAuth2.0`中的授权服务器提供了授权端点（`Authorization Endpoint`）/ 令牌端点（`Token Endpoint`）等诸多端点。其中授权端点用于资源所有者访问授权服务器进行授权，令牌端点则用于客户端应用与授权服务器间的交互。

![OAuth2.0端点](https://i.loli.net/2021/04/09/2ErmGgCVWqKUMNT.jpg)

### 1.5 Scope

`Scope`代表资源所有者对被保护资源的权限范围划分。开发者可以根据实际业务需求自定义`Scope`划分粒度，比如把一组相关联的API资源划分为一个`Scope`。

`OAuth2.0`协议并有对定义访问令牌（`Access Token`）内容和格式，但要求令牌要能够描述出资源授权访问范围和有效期。

### 1.6 错误对象

授权服务器发生错误时会返回以下错误对象。

```json
{
    "error":"错误类型",
    "error_description":"错误描述",
    "error_uri":"错误详情页面地址",
    "state":"错误请求的相关数据"
}
```

错误对象中`error`表示的错误类型一定存在，而其它三个字段则可能不存在。`Authorization Endpoint`中错误信息体现在URL的`QueryString`中，而`Token Endpoint`中则会以`application/json`格式作为响应体返回。

错误类型包含以下6种，通过名称就能看出其含义，这里不再赘述。

* `invalid_request`
* `invalid_client(401)`
* `invalid_grant`
* `unauthorized_client`
* `unsuportted_grant_type`
* `invalid_scope`

## 2. OpenID Connect

`OpenID Connect`是建立在`OAuth2.0`授权协议上的一个简单的身份认证层。`OpenID Connect`是兼容`OAuth2.0`的开放标准和认证协议，它在`OAuth2.0`授权协议的基础上添加了一些组件来提供身份认证的能力。

![OAuth2.0与身份认证协议的角色映射](https://i.loli.net/2021/04/16/TJ9M2RzIexNuSiy.png)

`OAuth2.0`与`OpenID Connect`的成员角色映射关系如上图所示。

### 2.1 Access Token 与 Identity Token

`OAuth2.0`中的`Access Token`允许客户端访问API资源。访问令牌代表了登录用户（资源所有者）， 其包含了客户端和用户(非必要)信息。

`OpenID Connect`中提供的`Identity Token`包含了用户认证结果和会话状态，包含用户信息和其它身份数据一般通过一组声明(`Claims`)表示，使用JWT格式包装后与`Access Token`一起返回给客户端。

`OpenID Connect`提供了一个`UserInfo`端点，通过它可以获取用户信息。此外协议还提供了如下一组标识身份的`scopes`和`claims`。

* `profile`
* `email`
* `address`
* `phone`
  
### 2.2 Flow

`OpenID Connect`有以下几种常用流程(`Flow`)：

* `Authorization Code Flow`
* `Implicit Flow`
* `Hybrid Flow`
* `Device Flow`

`Authorization Code Flow` 和 `Implicit Flow` 两者的流程已在[OAuth2.0授权类型](#_1-3-授权类型)中讲解。

`Hybrid Flow` 是`Implicit`和`Authorization Code`的组合,它有多种授权类型组合，最典型的是`code id_token`。此模式下`Identity Token`会经由浏览器传输，其含有经过签名的授权码等响应内容，这减少了许多针对浏览器通道的攻击。此模式适用于需要使用安全令牌和刷新令牌的原生应用，如Web机密客户端，桌面端和移动应用。

`Device Flow`用于的无浏览器和输入设备的客户端，它将用户认证授权过程依附于设备，如智能手机等，它最典型的是应用于物联网设备客户端。

## 3. IdentityServer

`OpenID Connect和OAuth 2.0`的结合是在可预见的未来保护现代应用程序的最佳方法。[IdentityServer](https://identityserver4.readthedocs.io/en/latest/index.html)中间件是Asp.Net对`OpenID Connect`和`OAuth 2.0`的实现，其经过高度的优化用于解决当今移动、本机和web应用程序的典型安全认证授权等问题。

`IdentityServer`在不同场景中有不同称谓，如身份认证服务器、安全令牌服务器、身份提供者、授权服务器等。它通常有以下作用d：

* 保护资源
* 使用本地账户或第三方账号进行身份认证
* 提供会话管理和单点登录
* 管理和认证客户端应用
* 向客户端颁发`Identity Token`和`Access Token`
* 验证令牌

![IdentityServer](https://i.loli.net/2021/04/17/cohJnk7P5Furx9j.png)

客户端应用在申请认证授权之前要确保已经注册到`Identity Server`。

被保护资源可以是用户身份信息或API资源，每一个资源都有唯一名称标识。用户身份数据通常是一组身份声明(Claims)，包含诸如用户名、邮件等信息。API资源最典型的是Web API。
