# ELK

ELK是三个开源软件的缩写，分别表示：Elasticsearch , Logstash, Kibana。ELK是经典的分布日志框架组合。

## 1. 简介
* Elasticsearch

    Elasticsearch是个开源分布式搜索引擎，提供搜集、分析、存储数据三大功能。它的特点有：分布式，零配置，自动发现，索引自动分片，索引副本机制，restful风格接口，多数据源，自动搜索负载等。

* Logstash

    Logstash 主要是用来日志的搜集、分析、过滤日志的工具，支持大量的数据获取方式。一般工作方式为c/s架构，client端安装在需要收集日志的主机上，server端负责将收到的各节点日志进行过滤、修改等操作在一并发往elasticsearch上去。

* Kibana

    Kibana 也是一个开源和免费的工具，Kibana可以为 Logstash 和 ElasticSearch 提供的日志分析友好的 Web 界面，可以帮助汇总、分析和搜索重要数据日志。

## 2. ELK环境搭建
ELK分别安装配置部署工作比较繁琐，以Docker为代表的容器化技术让这一切变得异常简单。Docker三剑客之一的Compose主要负责容器编排，在Compose中单个容器称为Task，多个同镜像任务构成Service，多个关联服务称为Stack。这里我们就可以使用Compose来配置一个ELK Stack。关于Docker的基础知识，这里就不做赘述了。

网上有些爱好者分享了ELK的Docker Compose的配置，为了方便大家使用，笔者基于现有实际项目应用的Compose配置整理，分享在[Github](https://github.com/colin-chang/ELK.Stack)。大家可以fork后按需定制修改。Thanks @[deviantony](https://github.com/deviantony)

https://github.com/colin-chang/ELK.Stack

### 2.1 Clone Repository
```sh
$ git clone https://github.com/colin-chang/ELK.Stack.git && cd ELK.Stack
```

### 2.2 Logstash Configuration
如前面提到Logstash可以搜集、分析、过滤日志，我们可以按需定制 logstash pipeline,其包含两个必须的元素input和output，和一个可选元素filter。
![logstash pipeline](https://i.loli.net/2020/02/25/z2Of6jNIFBK1Awi.png)

input负责日志采集，output负责日志输出，而filter则负责日志分析和过滤。

#### 2.2.1 Filter

通过 grok 可以把非结构化日志数据通过正则解析成结构化和可查询化数据，grok语法如下表。

语法|适用|含义|示例
:-|:-|:-|:-
`%{SYNTAX:SEMANTIC}`|官方既定正则|%{正则:自定义字段名}|`%{DATE:timestamp}`
(?&lt;filed&gt; pattern)|自定义模式|(?&lt;字段&gt; 自定义正则)|(?&lt;phone&gt; \d{11})

[官方提供](https://github.com/logstash-plugins/logstash-patterns-core/blob/master/patterns)了一些常用正则的grok pattern可以直接使用，当然我们也可以自定义pattern分析日志。

**grok匹配时换行符会导致匹配失败，建议在匹配前将日志中换行替换掉。**

**在`/logstash/pipeline/logstash.conf`文件中默添加了以下 grok pattern,反注释即可使用。** 

例如，定义grok pattern如下。
```json
grok {
    match => {"message"=>"%{LOGLEVEL:level}#%{USERNAME:logger}#%{DATA:callsite}#%{DATA:msg}#%{DATA:event_property}#%{DATA:exception_message}\|%{GREEDYDATA:exception_stacktrace}"}
}
```
示例错误日志。
```
FATAL#Xiaoyang.EmotionAnalyze.Program#Xiaoyang.EmotionAnalyze.Program.RunThrift 61#RunThrift failed.##System.TypeInitializationException: “Xiaoyang.EmotionAnalyze.Contract.Implement.EmotionAnalyzer”的类型初始值设定项引发异常。 ---> System.IO.FileNotFoundException: 未能加载文件 或程序集“Affdex, Version=4.0.0.615, Culture=neutral, PublicKeyToken=null”或它的某一个依赖项。系统找不到指定的文件。|   在 Xiaoyang.EmotionAnalyze.Contract.Implement.EmotionAnalyzer..cctor()|   --- 内部异常堆栈跟踪的结尾 ---|   在 Xiaoyang.EmotionAnalyze.Contract.Implement.EmotionAnalyzer..ctor(RedisHelper redis, ILogger`1 logger)|   在 invoker-94fbbdc3-6029-4ba8-bd06-c3b11de6d8a1(Object[] )|   在 AspectCore.Injector.ServiceCallSiteResolver.<>c__DisplayClass4_0.<ResolveCallback>b__0(ServiceResolver resolver)|   在 AspectCore.Injector.ServiceCallSiteResolver.<>c__DisplayClass8_0.<ResolveProxyService>b__0(ServiceResolver resolver)|   在 AspectCore.Injector.ServiceCallSiteResolver.<>c__DisplayClass4_0.<ResolveCallback>b__0(ServiceResolver resolver)|   在 System.Collections.Concurrent.ConcurrentDictionary`2.GetOrAdd(TKey key, Func`2 valueFactory)|   在 Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetService[T](IServiceProvider provider)|   在 Xiaoyang.EmotionAnalyze.Program.RunThrift(Int32 port) 位置 Z:\桌面\Xiaoyang\smartclass\EmotionAnalyze\Xiaoyang.EmotionAnalyze\Program.cs:行号 61
```

我们通过使用[Grok Debugger(Pattern填写正则即可)](http://grokdebug.herokuapp.com/)来快速测试匹配结果。

![Grok Debugger](https://i.loli.net/2020/02/25/j85x9BITSrP4uap.jpg)


更多logstash配置详解，可以参阅 
* https://www.elastic.co/guide/en/logstash/6.7/event-dependent-configuration.html
* https://www.cnblogs.com/xiaobaozi-95/p/9214307.html

#### 2.2.2 Output
```json
output {
	elasticsearch {
		hosts => ["elasticsearch:9200"]
		index => "template"
		document_type => "logs"
	}
}
```
我们将日志输出到elasticsearch中，其中index参数为日志检索索引，后续在Kibana中要以此索引检索日志,读者可以根据项目修改index配置。

### 2.3 启动/停止 ELK
```sh
# 启动 stack
$ docker-compose up -d

# 查看 stack 服务信息
$ docker-compose ps

# 停止 stack 并删除相关资源
$ docker-compose down
```

## 3. 记录日志
在`Logstash pipeline > input` 中我们配置了日志输入为`tcp:5000`端口。这意味着，可以直接请求此地址以记录日志。此处我们以 `Asp.Net.Core + NLog` 为例进行演示。

[NLog](https://nlog-project.org/)是.Net平台下常用的日志框架，其支持日志记录Targets支持Network，即将日志发送到指定网络地址。

参照[NLog文档](https://github.com/NLog/NLog.web/wiki)进行简单配置，可以通过控制台输出测试的日志内容和格式是否正确。

以上基本配置完成后，在`nlog.config`文件中`nlong`下添加如下配置。
```xml    
  <targets>
    <!-- 打印日志到控制台 -->
    <target xsi:type="Console" name="console"
            layout="${date} | ${level:uppercase=true} | ${logger} | ${message} | ${replace-newlines:${exception:format=toString}}" />
    <!-- 记录日志到 logstash -->
    <target xsi:type="Network" name="logstash" keepConnection="false"
            address="tcp://192.168.0.211:5000"
            layout="${level:uppercase=true}#${logger}#${callsite:includeSourcePath=true} ${callsite-linenumber}#${message}#${replace-newlines:${event-properties:item=EventId}}#${replace-newlines:replacement=|:${exception:format=ToString}}"/>
  </targets>

  <rules>
    <!-- 忽略系统Info级别以下日志 -->
    <logger name="Microsoft.*" maxlevel="Info" final="true"/>
    <!-- Trace级别以上日志输出到控制台 -->
    <logger name="*" minlevel="Trace" writeTo="console"/>
    <!-- Info级别以上日志输出logstash -->
    <logger name="*" minlevel="Info" writeTo="logstash"/>
  </rules>
```

* **Targets**

  `address`为logstash服务地址和监听端口，此处`layout`设定的日志输出格式需要与`logstash pipeline > filter > grok`中日志解析规则一致。详细layout参数配置参见 https://nlog-project.org/config/?tab=layout-renderers

  需要注意的是`NLog.Web.AspNetCore 4.6.2`中`Web, ASP.NET and ASP.NET Core`相关的layout参数如`${aspnet-request} `在`Asp.Net Core 2.2`中不起作用。我们可以暂时可以通过其他参数代替，如`${event-properties}`,`${var}`等。在`ILogger`标准日志接口扩展中提供了含有`EventId`类型的日记记录方法，可以借此记录需要的附加信息，如Web请求地址等。

  ```csharp
  //将Web请求地址记录到EventId中，按照以上配置最终被logstash解析为event_property字段
  _logger.LogError(new EventId(500, Request.GetDisplayUrl()), e, "custom message");
  ```

* **Rules**
  详细Rules配置参阅 https://github.com/NLog/NLog/wiki/Configuration-file#rules

`.NET Core + NLog + ELK` 的完整[**使用案例**](https://github.com/colin-chang/ELK.Sample)已分享到 https://github.com/colin-chang/ELK.Sample


## 4. 查看日志
访问Kibana地址http://127.0.0.1:5601，

![Kibana创建索引](https://i.loli.net/2020/02/25/iC1EYAWF7lX4nGD.jpg)

根据`Logstash pipeline > output` 设置的`index`参数创建检索参数后即可检索相关日志。

![Kibana查看日志](https://i.loli.net/2020/02/25/GHLhx5roQMWd1nB.jpg)