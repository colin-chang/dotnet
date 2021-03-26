# 前言

## 1.Net Core 简介
.NET Core是一个可以用来构建现代、可伸缩和高性能的跨平台软件应用程序的通用开发框架。可用于为Windows、Linux和MacOS构建软件应用程序。与其它软件框架不同，.NET Core是最通用的框架，可用于构建各种软件，包括Web应用程序、移动应用程序、桌面应用程序、云服务、微服务、API、游戏和物联网应用程序。与其它框架不同，.NET Core并不局限于单一的编程语言，它支持C#、VB.NET、F#、XAML和TypeScript。这些编程语言都是开源的，由独立的社区管理。

.NET Core提供了最先进、最成熟和最广泛的类库、公共API、多语言支持和工具。借助于Visual Studio 2019和Visual Studio Code 这些最先进和最现代的开发工具，使得.NET Core成为开发人员最高效的平台之一。

::: tip .NET 5
微软最近宣布了.NET 5，这是.NET Core的未来。将来，.NET Core将改名为.NET，下一个版本的.NET Core将是.NET 5.0。
:::

## 2.Net Core 特点
.NET Core的主要特性包括开源、跨平台、现代、灵活、轻量级、快速、友好、可共享，以及为未来的软件开发而构建的。

### 免费开源
.NET Core平台是免费的、开源的。.NET Core的源代码托管在Github上。任何开发人员都可以参与到.NET Core的开发。有数千名参与.NET Core开发的活跃开发人员正在改进特性、添加新特性以及修复bug和问题。

.NET Core由一个名为.NET Foundation的独立的非营利组织管理。60000多名开发人员和3700多家公司正在为.NET生态系统做出贡献。

.NET Core是免费的，并且采用MIT和Apache协议作为开源协议。对商业十分友好。

### 跨平台
.NET Core支持并运行在Windows、MacOS和Linux操作系统上。.NET Core跨体系结构(包括x64、x86和ARM)是一致的。可以导入相同的程序集和库，并在多个平台上使用。这些程序集和库都可以使用如下的.NET语言进行构建，如：C#、VB.NET或F#。

### 高性能
.NET Core 3.x 是快速的。与.NET Framework和.NET Core 2.2及以前的版本相比，.NET Core 3.0的速度很快。.NET Core比其它服务器端框架(如Java Servlet和Node.js)快得多。

![.Net Core性能对比](https://i.loli.net/2020/06/01/34rnGaw1CqkAdcR.jpg)

根据TechEmpowers发布的一份报告，.NET Core比任何其它框架都要快得多。 TechEmpower基准测试通过对多个Web应用程序框架做如下比较：数据库的单表查询，多表查询，文件访问，数据更新，明文和JSON序列化等任务进行比较。

### 共享友好
.NET Core使用一种用.NET Standard编写的一致API模型，这种模型对所有.NET应用程序都是通用的。相同的API或库可以与多种语言的多个平台一起使用。.NET Core通过.NET Standard与.NET Framework，Xamarin和Mono兼容。 .NET Core还支持使用各种流行的Web框架和库，如React，Angular和JavaScript。 TypeScript是.NET Core和Visual Studio生态系统的关键组件之一。

## 3.Net Core应用场景
.NET Core是一个通用的软件开发框架。它允许开发人员构建各种软件，包括Web，桌面，移动，云，游戏，物联网等。

![.Net Core应用场景](https://i.loli.net/2020/06/01/RtYWVF2AbTQSJcq.jpg)

### Web应用
ASP.NET Core是一个跨平台、高性能、开源的流行Web框架，用于构建现代云网络服务。

### 桌面应用
NET Core提供各种框架和工具来构建桌面应用程序。Windows窗体、WPF、UWP和Xamarin是构建桌面应用程序的四个主要框架。.NET Core还支持这些框架之间的互操作性。

### 微服务
微服务是一种新的设计模式，它允许开发人员构建软件服务的小模块，这些模块可以使用定义良好的契约相互通信。微服务使开发、测试和部署应用程序的独立部分更加容易。一旦部署完毕，每个微服务都可以根据需要独立地进行缩放。.NET Core支持微服务体系结构，它允许跨平台服务与.NET Core一起工作，包括使用.NET Framework、Java、Ruby或其它开发的服务。

容器是今天的越野车。.NET Core的模块化、轻量级和灵活性使得将.NET Core应用程序部署到容器中变得更加容易。容器把一个应用程序的所有的配置文件和依赖关系，包含在一个单独的、小型的和独立的软件部署单元中。容器可以部署在任何平台、云、Linux和Windows上。.NET Core与Docker和Azure Kubernetes服务都很好地协作。

### 云应用程序
云应用程序现在越来越受欢迎。Azure支持各种云应用程序。.NET Core和C#应用程序可以通过Visual Studio 2019部署在Azure上。

### 物联网
物联网应用正在增长。.NET Core支持通过UWP框架为运行Windows 10 IoT Core的物联网设备进行物联网开发。UWP可用于构建在由Raspberry Pi，MinnowBoard MAX，DragonBoard 410c等提供支持的物联网上运行的应用程序。


## 4.Net Core组件
通常情况下我们所说的.NET Core并不是一个开源项目，而是由多个开源项目构成的一个项目集，其包含的四个核心项目`CoreCLR`,`CoreFx`,`CLI`和`Roslyn`是.NET Core的重要组件。

### CoreCLR
`CoreCLR`是由.NET Framework CLR迁移而来，是.NET Core的公共语言运行时(本质上就是.NET 虚拟机)，也是最核心的组件，类似Java世界的JVM。`CoreCLR`主要是C++编写，主要负责代码解析编译、类型安全、异常处理、线程管理、GC等基础工作。

### CoreFx
`CoreFx`完全由C#编写，是.NET Core提供给开发者的库函数项目。它将`partial`关键字将多平台公用代码文放在一个源码文件中，具体操作系统相关的代码放在平台相关的源码文件中，通过 部分类 + 条件编译 实现代码的跨平台兼容性，避免了大量使用适配器模式，提醒类库执行效率，同时针对.NET Standard进行了优化调整。

### CLI
`CLI`(Command Line Interface)是.NET Core命令行工具。.NET Core针对不同平台编译出的二进制文件都是`.dll`的PE格式文件，这意味着.NET Core需要提供一个容器来保证所有平台可以正确加载`.dll`文件，于是`CLI`应运而生，目前所有.NET Core交互都是通过`CLI`来完成，Visual Studio等IDE也是通过调用`CLI`来进行.NET Core交互。

### Roslyn
`Roslyn`是.NET平台新一代语言编译平台，支持`C#/VB.NET/F#`编译，且其编译效率相较`CSC`有大幅提升，编译时间大大缩短。此外还支持代码分析已经相关API，这意味着开发者可以使用`Roslyn`创建自定义代码编译分析工具。

## 5. 本书简介
.NET Core已经被微软视作 .NET 未来的发展方向，.NET Core与以往版本最大的不同就是跨平台和开源。跨平台意味着你可以有更多的开发环境和部署环境的选择，尤其是对Docker和Kubernetes，.NET Core都具有良好的支持，开发者可以基于.NET Core快速构建微服务架构并部署到Kubernetes云基础设施中，并且实现高可用、可伸缩的系统架构搭建。同时，由于其开源的性质，开源社区也贡献了大量的 .NET Core 核心代码，各类主流组件库也都有对.NET Core 的支持，这样，开发者就可以更多的关注业务设计与实现，快速实现商业价值。

.NET Core云原生微服务架构的开发，不仅涉及到.NET Core重要组件的知识，还涉及到DDD、远程调用RPC、熔断限流、网关、身份认证、安全等微服务架构的各个方面，同时也要求技术人员对 DevOps 协作模式有一定的掌握。

因此，本套.NET Core开发实战教程将强化你的.NET Core必备基础知识，带你一步步完整构建一个基于 .NET Core 的微服务应用，并将其部署到Kubernetes上。帮你从一个普通开发者成长为架构师，让你熟练掌握 .NET Core 开发最佳实践，并拥有保障系统可维护性、可检测性和故障隔离的能力。

1. 熟知.NET Core核心组件设计原理；
2. 基于DDD开发云原生微服务应用；
3. 掌握.NET Core工程设计最佳实践；
4. 提升K8s微服务部署与维护技能。

> .NET常用工具推荐
* [.NET API 目录查询](https://apisof.net/catalog)
* [.NET 在线源码](https://source.dot.net/)
* [dnSpy 反编译](https://github.com/0xd4d/dnSpy)
* [迁移分析工具](https://github.com/microsoft/dotnet-apiport)