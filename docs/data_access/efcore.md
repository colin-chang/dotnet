# EF Core 基础

## 1. EF Core 简介
`Entity Framework Core`是轻量化、可扩展、开源和跨平台版的常用`Entity Framework`数据访问技术。
`EF Core`可用作对象关系映射程序 (O/RM)，这可以实现以下两点：
* 使 .NET 开发人员能够使用 .NET 对象处理数据库。
* 无需再像通常那样编写大部分数据访问代码。
`EF Core`支持多个数据库引擎。

这里我们只是对EF做一点简单的介绍，更多详细内容请参阅其[官方文档](https://docs.microsoft.com/zh-cn/ef/core/)。

## 2. Quick Start

### 2.1 安装
`EF Core`是一个`.NET Standard`库。 因此，`EF Core`需要支持运行`.NET Standard`的实现。 其它`.NET Standard`库也可引用`EF Core`。要将`EF Core`添加到应用程序，请安装适用于要使用的数据库提供程序的NuGet包，它会自动依赖引入需要用到的`EF Core`的基础包。

数据库系统|NuGet 程序包
:-|:-
SQL Server / Azure SQL|[Microsoft.EntityFrameworkCore.SqlServer](https://www.nuget.org/packages/Microsoft.EntityFrameworkCore.SqlServer/)
MySQL / MariaDB | [Pomelo.EntityFrameworkCore.MySql](https://www.nuget.org/packages/Pomelo.EntityFrameworkCore.MySql/)
PostgreSQL | [Npgsql.EntityFrameworkCore.PostgreSQL](https://www.nuget.org/packages/Npgsql.EntityFrameworkCore.PostgreSQL/)
Oracle | [Oracle.EntityFrameworkCore](https://www.nuget.org/packages/Oracle.EntityFrameworkCore/)
SQLite | [	Microsoft.EntityFrameworkCore.Sqlite](https://www.nuget.org/packages/Microsoft.EntityFrameworkCore.Sqlite/)

### 2.2 模型
`EF Core`使用模型执行数据访问。模型由实体类和表示数据库会话的上下文对象构成。

本节示例项目代码已共享至[Github](https://github.com/colin-chang/EfDemo)。

#### 1) 实体
`EF Core`章节中我们使用下图所示实体为例进行简单的讲解和演示，数据库采用Mysql 8。
![实体关系图](https://i.loli.net/2021/02/06/iSmeUVH7ZLDg6TK.png)

默认不做任何限定的情况下，`EF Core`迁移数据库时会使用各数据类型的最大值，我们可以通过`Annotation Attribute`来约束实体属性,比如设置非空，长度，非默认数据类型，非默认名称等，示例如下。

```csharp {7,9,11,13}
/// <summary>
/// 俱乐部
/// </summary>
public class Club
{
    public int Id { get; set; }
    [Required, MaxLength(100)] 
    public string Name { get; set; }
    [MaxLength(20)] 
    public string City { get; set; }
    [Column(TypeName = "date")] // 自定义类型，默认情况为 datetime
    public DateTime EstablishedDate { get; set; }
    [MaxLength(200)] 
    public string History { get; set; }

    /// <summary>
    /// 所属联盟
    /// </summary>
    public League League { get; set; }

    /// <summary>
    /// 俱乐部球员
    /// </summary>
    public IEnumerable<Player> Players { get; set; } = new List<Player>();
}
```

除了`Annotation Attribute`方式，我们也可以在上下`OnModelCreating`中使用`fluent API`配置模型。**此配置方法最为有效，并可在不修改实体类的情况下指定配置。 Fluent API 配置具有最高优先级，并将替代约定和数据注释。**

```csharp {5-7}
public class DemoContext : DbContext
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Game>()
            .Property(g => g.Round)
            .IsRequired();
    }
}
```


实体间 `1:1`和`1:N`的关系都可以任意一方或双方通过导航属性体现，数据迁移时就会自动建立表的物理外键关联。`M:N`的关系则需要建立中间关系表，双方与中间关系表是两个`1:N`的关系。


#### 2）DbContext


#### ① Code First
EF Core常用以下模型开发方法：
* 从现有数据库生成模型，或对模型手动编码，使其符合数据库。
* 创建模型后，使用EF迁移从模型创建数据库。

第一种方式就是我们常说的`DB First`，市面上大多以数据库为核心的体量不大的系统多采用这种方式进行开发。

后面一种则称为`Code First`，此方式以业务为核心进而抽象成模型，最后通过模型迁移数据库，模型发生变化时，迁移可让数据库不断演进。这也是领域驱动设计(DDD)推荐的开发方式，众所周知，DDD正是当下最流行的服务架构设计思想，`Code First`正是其推崇的以业务为核心的设计思路的落地。

#### ② 配置数据库提供程序
下面示例采用`Code First`，首先手动创建一个数据库会话上下文`DemoContext`并继承自`DbContext`用于执行数据交互，每一个实体的数据集作为`DbSet<T>`属性最终映射为数据表。数据库的相应配置则可以在重写上下文的`OnConfiguring`方法中指定。

```csharp {5-6}
public class DemoContext : DbContext
{
    private const string ConnectionString = "Server=127.0.0.1;Port=3306;Database=demo;User=root;Password=123123;";

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder) =>
        optionsBuilder.UseMySql(ConnectionString, ServerVersion.AutoDetect(ConnectionString));

    public DbSet<League> Leagues { get; set; }
    public DbSet<Club> Clubs { get; set; }
    public DbSet<Player> Players { get; set; }
}
```

如果系统程序入口为Asp.Net Core或WorkService等则会使用DI方式管理EF Core等服务组件，那EF Core的配置会在服务注入时设置而不需要在`OnConfiguring`中设置了。
```csharp {3-4}
public void ConfigureServices(IServiceCollection services)
{
    services.AddDbContext<DemoContext>(options =>
            options.UseMySql(Configuration.GetConnectionString(nameof(DemoContext)),ServerVersion.AutoDetect(ConnectionString)));
}
```

#### ③ DbContext生命周期
* `DbContext`实例旨在用于单个工作单元，意味着`DbContext`实例的生存期通常很短。在Web应用中，每个HTTP请求都对应于单个工作单元，当请求结束是`DbContext`实例将被释放。
* 使用后释放`DbContext`非常重要。 这可确保释放所有非托管资源，并注销任何事件或其它挂钩，以防止在实例保持引用时出现内存泄漏。
* `DbContext`不是线程安全的。 不要在线程之间共享上下文。请确保在继续使用上下文实例之前，等待所有异步调用。

**EF Core不支持在同一DbContext实例上运行多个并行操作。** 这包括异步查询的并行执行以及从多个线程进行的任何显式并发使用。 因此，始终立即`await`异步调用，或对并行执行的操作使用单独的 `DbContext`实例。

### 2.3 迁移数据库
模型定义完成后就可以使用`dotnet-ef`工具创建`Migration`文件并应用和更新到数据库。

migration等EF Core工具命令需要在[`DbContext`设计时](https://docs.microsoft.com/zh-cn/ef/core/cli/dbcontext-creation?tabs=dotnet-core-cli)创建一个派生实例，以便收集有关该应用程序的实体类型及其如何映射到数据库架构的详细信息。

数据库迁移文件需要依赖一个可执行程序，如果模型所在项目是一个类库等非可执行程序那需要通过`-s`参数指定一个可执行程序，并且可执行程序中要安装`Microsoft.EntityFrameworkCore.Design`。

#### 1) dotnet-ef
首次使用时需要先安装`dotnet-ef`工具。
```bash
# 安装
dotnet tool install -g dotnet-ef
# 更新
dotnet tool update -g dotnet-ef
```

#### 2) nuget
首次迁移需要在项目中引用[Microsoft.EntityFrameworkCore.Design](https://www.nuget.org/packages/Microsoft.EntityFrameworkCore.Design/)`

```bash
dotnet add package Microsoft.EntityFrameworkCore.Design
```

#### 3) 创建Migration文件
```bash
# InitialCreate 为本次迁移的名称，生成迁移文件时会以此关键字创建迁移和相关文件，所以建议使用大驼峰命名

# 可执行程序
dotnet ef migrations add InitialCreate
# 非可执行程序
dotnet ef migrations add InitialCreate -s ../EfDemo.App/EfDemo.App.csproj
```

初次执行以上命令会在当前项目下生成`Migrations`目录并生成类似`xxx_InitialCreate.cs`和`DemoContextModelSnapshot.cs`的两个文件。前者带时间戳的文件是本次迁移对应的文件，而后者则是一个数据快照，`EF Core`以此来追踪模型状态。当模型变化后再次迁移数据库时，`EF Core`会对比快照文件来确定数据库的变化差异进。

迁移文件中包含一个我们命名的`Migration`子类，其中重写了`Up`/`Down`两个方法，前者用于对数据库进行修改，后者则是对修改的回滚。

如果要撤销迁移文件创建操作可以通过以下命令。
```bash
dotnet ef migrations remove -s ../EfDemo.App/EfDemo.App.csproj
```

#### 4) 更新数据库
生产环境中我们可以通过以下指令根据迁移文件生成SQL脚本，然后交由DBA执行SQL脚本更新数据库。
```bash
dotnet ef migrations script -o Migrations/InitialCreate.sql -s ../EfDemo.App/EfDemo.App.csproj
```

在开发环境中我们通常会跳过脚本生成，直接通过以下指令将迁移文件直接应用到数据库。
```bash
dotnet ef database update -s ../EfDemo.App/EfDemo.App.csproj
```

需要注意的是，`EF Core`迁移数据库时除了实体模型对应的数据表外，还会自动生成一个`__EFMigrationsHistory`表用于记录数据库历史记录。

### 2.4 CRUD


dotnet ef migrations remove -s ../EfDemo.App/EfDemo.App.csproj