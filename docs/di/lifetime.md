# 服务生命周期

生命周期决定了`ServiceProvider`采用怎样的方式创建和回收服务实例。`ServiceProvider`具有三种基本的生命周期管理模式，分别对应着枚举类型`ServiceLifetime`的三个选项（`Singleton`、`Scoped`和`Transient`）。对于`ServiceProvider`支持的这三种生命周期管理模式，`Singleton`和`Transient`的语义很明确，前者（`Singleton`）表示以“单例”的方式管理服务实例的生命周期，意味着`ServiceProvider`对象多次针对同一个服务类型所提供的服务实例实际上是同一个对象；而后者（`Transient`）则完全相反，对于每次服务提供请求，`ServiceProvider`总会创建一个新的对象。那么`Scoped`又体现了`ServiceProvider`针对服务实例怎样的生命周期管理方式呢？
 
## 1. 服务范围
`Scoped`代表一种怎样的生命周期模式，很多初学者往往搞不清楚。这里所谓的`Scope`指的是由`IServiceScope`接口表示的“服务范围”，该范围由`IServiceScopeFactory`接口表示的“服务范围工厂”来创建。如下面的代码片段所示，`IServiceProvider`的扩展方法`CreateScope`正是利用提供的`IServiceScopeFactory`服务实例来创建作为服务范围的`IServiceScope`对象。

```csharp
public interface IServiceScope : IDisposable
{
    IServiceProvider ServiceProvider { get; }
}

public interface IServiceScopeFactory
{
    IServiceScope CreateScope();
}

public static class ServiceProviderServiceExtensions
{
   public static IServiceScope CreateScope(this IServiceProvider provider) => provider.GetRequiredService<IServiceScopeFactory>().CreateScope();
}
```

`ServiceScope`为某个`ServiceProvider`对象圈定了一个“作用域”，枚举类型`ServiceLifetime`中的`Scoped`选项指的就是这么一个`ServiceScope`。若要充分理解`ServiceScope`和`ServiceProvider`之间的关系，我们需要简单了解一下`ServiceProvider`的层级结构。除了直接通过一个`ServiceCollection`对象创建一个独立的`ServiceProvider`对象之外，一个`ServiceProvider`还可以根据另一个`ServiceProvider`对象来创建，如果采用后一种创建方式，我们指定的`ServiceProvider`与创建的`ServiceProvider`将成为一种“父子”关系。

```csharp
internal class ServiceProvider : IServiceProvider, IDisposable
{
    private readonly ServiceProvider _root;
    internal ServiceProvider(ServiceProvider parent)
    {
        _root = parent._root;
    }
    //其它成员
}
```

虽然在创建过程中体现了`ServiceProvider`之间存在着一种树形化的层级结构，但是`ServiceProvider`对象本身并没有一个指向“父亲”的引用，它仅仅会保留针对根节点的引用。如上面的代码片段所示，针对根节点的引用体现为`ServiceProvider`类的字段`_root`。当我们根据作为“父亲”的`ServiceProvider`创建一个新的`ServiceProvider`的时候，父子均指向同一个“根”。我们可以将创建过程中体现的层级化关系称为“逻辑关系”，而将`ServiceProvider`对象自身的引用关系称为“物理关系”，下图清楚地揭示了这两种关系之间的转化。

![ServiceProvider层级关系](https://i.loli.net/2020/02/26/Ab1HpIkl28tqWdB.png)

由于`ServiceProvider`自身是一个内部类型，我们不能采用调用构造函数的方式根据一个作为“父亲”的`ServiceProvider`创建另一个作为“儿子”的`ServiceProvider`，但是这个目的可以间接地通过创建`ServiceScope`的方式来完成。如下面的代码片段所示，我们首先创建一个独立的`ServiceProvider`并调用其`CreateScope`方法创建一个新的`ServiceScope`，它的`ServiceProvider`就是前者的“儿子”。

```csharp
class Program
{
    static void Main(string[] args)
    {
        IServiceProvider serviceProvider1 = new ServiceCollection().BuildServiceProvider();
        IServiceProvider serviceProvider2 = serviceProvider1.CreateScope().ServiceProvider;
 
        object root = serviceProvider2.GetType().GetField("_root", BindingFlags.Instance| BindingFlags.NonPublic).GetValue(serviceProvider2);
        Debug.Assert(object.ReferenceEquals(serviceProvider1, root));        
    }
}
```

如果读者朋友们希望进一步了解`ServiceScope`的创建以及它和`ServiceProvider`之间的关系，我们不妨先来看看作为`IServiceScope`接口默认实现的内部类型`ServiceScope`的定义。如下面的代码片段所示，`ServiceScope`仅仅是对一个`ServiceProvider`对象的简单封装而已。值得一提的是，当`ServiceScope`的`Dispose`方法被调用的时候，这个被封装的`ServiceProvider`的同名方法同时被执行。

```csharp
internal class ServiceScope : IServiceScope
{
    private readonly ServiceProvider _scopedProvider;
    public ServiceScope(ServiceProvider scopedProvider)
    {
        this._scopedProvider = scopedProvider;
    }
 
    public void Dispose()
    {
        _scopedProvider.Dispose();
    }
 
    public IServiceProvider ServiceProvider
    {
        get {return _scopedProvider; }
    }
}
```

`IServiceScopeFactory`接口的默认实现类型是一个名为`ServiceScopeFactory`的内部类型。如下面的代码片段所示，`ServiceScopeFactory`的只读字段`_provider`表示当前的`ServiceProvider`。当`CreateScope`方法被调用的时候，这个`ServiceProvider`的子`ServiceProvider`被创建出来，并被封装成返回的`ServiceScope`对象。

```csharp
internal class ServiceScopeFactory : IServiceScopeFactory
{
    private readonly ServiceProvider _provider;
    public ServiceScopeFactory(ServiceProvider provider)
    {
        _provider = provider;
    }
 
    public IServiceScope CreateScope()
    {
        return new ServiceScope(new ServiceProvider(_provider));
    }
}
```

## 2. 生命周期管理模式
只有在充分了解`ServiceScope`的创建过程以及它与`ServiceProvider`之间的关系之后，我们才会对`ServiceProvider`支持的三种生命周期管理模式（`Singleton`、`Scope`和`Transient`）具有深刻的认识。就服务实例的提供方式来说，它们之间具有如下的差异：

* `Singleton`：`IServiceProvider`创建的服务实例保存在作为根容器的`IServiceProvider`上，所有多个同根的`IServiceProvider`对象提供的针对同一类型的服务实例都是同一个对象。
* `Scoped`：`IServiceProvider`创建的服务实例由自己保存，所以同一个`IServiceProvider`对象提供的针对同一类型的服务实例均是同一个对象。
* `Transient`：针对每一次服务提供请求，`IServiceProvider`总是创建一个新的服务实例。

在一个控制台应用中定义了如下三个服务接口（`IFoo`、`IBar`和`IBaz`）以及分别实现它们的三个服务类(`Foo`、`Bar`和`Baz`)。

```csharp
public interface IFoo {}
public interface IBar {}
public interface IBaz {}
 
public class Foo : IFoo {}
public class Bar : IBar {}
public class Baz : IBaz {}
```

现在我们在作为程序入口的`Main`方法中创建一个`ServiceCollection`对象，并采用不同的生命周期管理模式完成针对三个服务接口的注册(`IFoo`/`Foo`、`IBar`/`Bar`和`IBaz`/`Baz`分别`Transient`、`Scoped`和`Singleton`)。我们接下来针对这个`ServiceCollection`对象创建一个`ServiceProvider`（`root`），并采用创建`ServiceScope`的方式创建它的两个子`ServiceProvider`（`child1`和`child2`）。

```csharp
class Program
{
    static void Main(string[] args)
    {
        IServiceProvider root = new ServiceCollection()
            .AddTransient<IFoo, Foo>()
            .AddScoped<IBar, Bar>()
            .AddSingleton<IBaz, Baz>()
            .BuildServiceProvider();
        IServiceProvider child1 = root.CreateScope().ServiceProvider;
        IServiceProvider child2 = root.CreateScope().ServiceProvider;
 
        Console.WriteLine("ReferenceEquals(root.GetService<IFoo>(), root.GetService<IFoo>() = {0}",ReferenceEquals(root.GetService<IFoo>(), root.GetService<IFoo>()));
        Console.WriteLine("ReferenceEquals(child1.GetService<IBar>(), child1.GetService<IBar>() = {0}",ReferenceEquals(child1.GetService<IBar>(), child1.GetService<IBar>()));
        Console.WriteLine("ReferenceEquals(child1.GetService<IBar>(), child2.GetService<IBar>() = {0}",ReferenceEquals(child1.GetService<IBar>(), child2.GetService<IBar>()));
        Console.WriteLine("ReferenceEquals(child1.GetService<IBaz>(), child2.GetService<IBaz>() = {0}",ReferenceEquals(child1.GetService<IBaz>(), child2.GetService<IBaz>()));
    }
}
```
为了验证`ServiceProvider`针对`Transient`模式是否总是创建新的服务实例，我们利用同一个`ServiceProvider`（`root`）获取针对服务接口`IFoo`的实例并进行比较。为了验证`ServiceProvider`针对`Scope`模式是否仅仅在当前`ServiceScope`下具有“单例”的特性，我们先后比较了同一个`ServiceProvider`（`child1`）和不同ServiceProvider（`child1`和`child2`）两次针对服务接口`IBar`获取的实例。为了验证具有“同根”的所有`ServiceProvider`针对`Singleton`模式总是返回同一个服务实例，我们比较了两个不同`child1`和`child2`两次针对服务接口`IBaz`获取的服务实例。如下所示的输出结构印证了我们上面的论述。
 
```
ReferenceEquals(root.GetService<IFoo>(), root.GetService<IFoo>()         = False
ReferenceEquals(child1.GetService<IBar>(), child1.GetService<IBar>()     = True
ReferenceEquals(child1.GetService<IBar>(), child2.GetService<IBar>()     = False
ReferenceEquals(child1.GetService<IBaz>(), child2.GetService<IBaz>()     = True
```

## 3. 服务对象回收
`ServiceProvider`除了为我们提供所需的服务实例之外，对于由它提供的服务实例，它还肩负起回收之责。这里所说的回收与.NET自身的垃圾回收机制无关，仅仅针对于自身类型实现了`IDisposable`接口的服务实例，所谓的回收仅仅体现为调用它们的`Dispose`方法。`ServiceProvider`针对服务实例所采用的回收策略取决于服务注册时采用的生命周期管理模式，具体采用的服务回收策略主要体现为如下两点：

* `Singleton`：提供`Disposable`服务实例保存在作为根容器的`IServiceProvider`对象上，只有后者被释放的时候这些`Disposable`服务实例才能被释放。
* `Scoped`和`Transient`：`IServiceProvider`对象会保存由它提供的`Disposable`服务实例，当自己被释放的时候，这些`Disposable`会被释放。

综上所述，每个作为`DI`容器的`IServiceProvider`对象都具有如下图所示两个列表来存放服务实例，我们将它们分别命名为`Realized Services`和`Disposable Services`，对于一个作为非根容器的`IServiceProvider`对象来说，由它提供的`Scoped`服务保存在自身的`Realized Services`列表中，`Singleton`服务实例则会保存在根容器的`Realized Services`列表。如果服务实现类型实现了`IDisposable`接口，`Scoped`和`Transient`服务实例会被保存到自身的`Disposable Services`列表中，而`Singleton`服务实例则会保存到根容器的`Disposable Services`列表。

![服务对象回收示意图](https://i.loli.net/2020/02/26/quHZgaCOjxEWUQt.png)

当`IServiceProvider`提供服务实例时，它会提取出对应的`ServiceDescriptor`对象并读取其生命周期模式。

如果生命周期为`Singleton`，且根容器`Realized Services`列表中已包含对应的服务实例，后者将作为最终提供的服务实例。若服务实例尚未创建，那么将创建新服务对象作为提供的服务实例。返回的该服务对象将被添加到根容器`Realized Services`列表中，如果服务类型实现了`IDisposable`接口，该实例会添加到根容器的`Disposable Services`列表中。

如果生命周期为`Scoped`，那么`IServiceProvider`会先确定自身的`Realized Services`列表中是否存在对应的服务实例，存在的服务实例将作为最终返回的服务实例。如果`Realized Services`列表不存在对应的服务实例，那么将创建新的服务实例。在最终服务实例返回之前，该实例将添加到自身的`Realized Services`列表中，如果实例类型实现了`IDisposable`接口，该实例会被添加到自身的`Disposable Services`列表中。

如果生命周期为`Transient`，那么`IServiceProvider`会直接创建一个新的服务实例。在作为最终的服务实例被返回之前，该实例会被添到的自身的`Realized Services`列表中，如果实例类型实现了`IDisposable`接口，创建的服务实例会被添加到自身的`Disposable Services`列表中。

对于非根容器的`IServiceProvider`对象来说，它的生命周期是由“包裹”着它的`IServiceScope`对象控制的。从上面给出的定义可以看出`IServiceScope`实现了`IDisposable`接口，`Dispose`方法的执行不仅标志着当前服务范围的终结，也意味着对应`IServiceProvider`对象生命周期的结束。一旦`IServiceProvider`因自身`Dispose`方法的调用而被释放的时候，它会从自身的`Disposable Services`列表中提取出所有需要被释放的服务实例，并调用它们的`Dispose`方法。在这之后，`Disposable Services`和`Realized Services`列表会被清空，列表中的服务实例和`IServiceProvider`对象自身会成为垃圾对象被`GC`回收。

我们通过以下示例来体会。

在控制台应用中定义了如下三个服务接口（`IFoo`、`IBar`和`IBaz`）以及三个实现它们的服务类（`Foo`、`Bar`和`Baz`），这些类型具有相同的基类`Disposable`。`Disposable`实现了`IDisposable`接口，我们在`Dispose`方法中输出相应的文字以确定对象回收的时机。

```csharp
public interface IFoo {}
public interface IBar {}
public interface IBaz {}
 
public class Foo : Disposable, IFoo {}
public class Bar : Disposable, IBar {}
public class Baz : Disposable, IBaz {}
 
public class Disposable : IDisposable
{
    public void Dispose()
    {
        Console.WriteLine("{0}.Dispose()", this.GetType());
    }
}
```

我们在作为程序入口的`Main`方法中创建了一个`ServiceCollection`对象，并在其中采用不同的生命周期管理模式注册了三个相应的服务（`IFoo`/`Foo`、`IBar`/`Bar`和`IBaz`/`Baz`分别采用`Transient`、`Scoped`和`Singleton`模式）。我们针对这个`ServiceCollection`创建了一个`ServiceProvider`（`root`），以及它的两个“儿子”（`child1`和`child2`）。在分别通过`child1`和`child2`提供了两个服务实例（`child1：IFoo`， `child2：IBar/IBaz`）之后，我们先后调用三个`ServiceProvider`（`child1=>child2=>root`）的`Dispose`方法。

```csharp
class Program
{
    static void Main(string[] args)
    {
        IServiceProvider root = new ServiceCollection()
            .AddTransient<IFoo, Foo>()
            .AddScoped<IBar, Bar>()
            .AddSingleton<IBaz, Baz>()
            .BuildServiceProvider();
        IServiceProvider child1 = root.CreateScope().ServiceProvider;
        IServiceProvider child2 = root.CreateScope().ServiceProvider;
 
        child1.GetService<IFoo>();
        child1.GetService<IFoo>();
        child2.GetService<IBar>();
        child2.GetService<IBaz>();
 
        Console.WriteLine("child1.Dispose()");
        ((IDisposable)child1).Dispose();
 
        Console.WriteLine("child2.Dispose()");
        ((IDisposable)child2).Dispose();
 
        Console.WriteLine("root.Dispose()");
        ((IDisposable)root).Dispose();
    }
}
```

运行该程序输出结果如下。`child1`提供的两个`Transient`模式服务实例，其回收是在`child1`的`Dispose`方法执行之后自动完成。当`child2`的`Dispose`方法被调用的时候，采用`Scope`模式的`Bar`对象被自动回收了，而采用`Singleton`模式的`Baz`对象的回收工作，是在`root`的`Dispose`方法被调用之后自动完成的。

```
child1.Dispose()
Foo.Dispose()
Foo.Dispose()
child2.Dispose()
Bar.Dispose()
root.Dispose()
Baz.Dispose()
```

了解`ServiceProvider`针对不同生命周期管理模式所采用的服务回收策略还会帮助我们正确的使用它。具体来说，当我们在使用一个现有的`ServiceProvider`的时候，由于我们并不能直接对它实施回收（因为它同时会在其它地方被使用），如果直接使用它来提供我们所需的服务实例，由于这些服务实例可能会在很长一段时间得不到回收，进而导致一些内存泄漏的问题。如果所用的是一个与当前应用具有相同生命周期（`ServiceProvider`在应用终止的时候才会被回收）的`ServiceProvider`，而且提供的服务采用`Transient`模式，这个问题就更加严重了，这意味着每次提供的服务实例都是一个全新的对象，但是它永远得不到回收。

为了解决这个问题，我想很多人会想到一种解决方案，那就是按照如下所示的方式显式地对提供的每个服务实例实施回收工作。实际上这并不是一种推荐的编程方式，因为这样的做法仅仅确保了服务实例对象的`Dispose`方法能够被及时调用，但是`ServiceProvider`依然保持着对服务实例的引用，后者依然不能及时地被`GC`回收。

```csharp
public void DoWork(IServiceProvider serviceProvider)
{
    using (IFoobar foobar = serviceProvider.GetService<IFoobar>())
    {
        // ...
    }
}
```

由于提供的服务实例总是被某个`ServiceProvider`引用着[[1]](#comment)（直接提供服务实例的`ServiceProvider`或者是它的根），所以服务实例能够被`GC`从内存及时回收的前提是引用它的`ServiceProvider`及时地变成垃圾对象。要让提供服务实例的`ServiceProvider`成为垃圾对象，我们就必须创建一个新的`ServiceProvider`，通过上面的介绍我们知道`ServiceProvider`的创建可以通过创建`ServiceScope`的方式来实现。除此之外，我们可以通过回收`ServiceScope`的方式来回收对应的`ServiceProvider`，进而进一步回收由它提供的服务实例（仅限`Transient`和`Scoped`模式）。下面的代码片段给出了正确的编程方式。

```csharp
public void DoWork(IServiceProvider serviceProvider)
{
    using (IServiceScope serviceScope = serviceProvider.CreateScope())
    {
        IFoobar foobar = serviceScope.ServiceProvider.GetService<IFoobar>();
        // ...
    }
}
```

接下来我们通过一个简单的实例演示上述这两种针对服务回收的编程方式之间的差异。我们在一个控制台应用中定义了一个继承自`IDisposable`的服务接口`IFoobar`和实现它的服务类`Foobar`。如下面的代码片段所示，为了确认对象真正被`GC`回收的时机，我们为`Foobar`定义了一个析构函数。在该析构函数和`Dispose`方法中，我们还会在控制台上输出相应的指导性文字。

```csharp
public interface IFoobar: IDisposable
{}
 
public class Foobar : IFoobar
{
    ~Foobar()
    {
        Console.WriteLine("Foobar.Finalize()");
    }
 
    public void Dispose()
    {
        Console.WriteLine("Foobar.Dispose()");
    }
}
```

在作为程序入口的`Main`方法中，我们创建了一个`ServiceCollection`对象并采用`Transient`模式将`IFoobbar`/`Foobar`注册其中。借助于通过该`ServiceCollection`创建的`ServiceProvider`，我们分别采用上述的两种方式获取服务实例并试图对它实施回收。为了强制`GC`实时垃圾回收，我们显式调用了`GC`的`Collect`方法。

```csharp
class Program
{
    static void Main(string[] args)
    {
        IServiceProvider serviceProvider = new ServiceCollection()
            .AddTransient<IFoobar, Foobar>()
            .BuildServiceProvider();
 
        serviceProvider.GetService<IFoobar>().Dispose();
        GC.Collect();
 
        Console.WriteLine("----------------");
        using (IServiceScope serviceScope = serviceProvider.GetService<IServiceScopeFactory>().CreateScope())
        {
            serviceScope.ServiceProvider.GetService<IFoobar>();
        }
        GC.Collect();
 
        Console.Read();
    }
}
```

该程序执行之后会在控制台上产生如下所示的输出结果。从这个结果我们可以看出，如果我们使用现有的`ServiceProvider`来提供所需的服务实例，后者在`GC`进行垃圾回收之前并不会从内存中释放。如果我们利用现有的`ServiceProvider`创建一个`ServiceScope`，并利用它所在的`ServiceProvider`来提供我们所需的服务实例，`GC`是可以将其从内存中释放出来的。

```
Foobar.Dispose()
----------------
Foobar.Dispose()
Foobar.Finalize()
```

另外需要注意的是，DI容器只负责释放由其创建的对象实例，我们手动创建并放到容器中的对象并不会被释放，开发中应避免以上情况。

## 4. Asp.Net Core 服务生命周期
`DI`框架所谓的服务范围在ASP.NET Core应用中具有明确的边界，指的是针对每个HTTP请求的上下文，也就是服务范围的生命周期与每个请求上下文绑定在一起。如下图所示，ASP.NET Core应用中用于提供服务实例的`IServiceProvider`对象分为两种类型，一种是作为根容器并与应用具有相同生命周期的`IServiceProvider`，另一个类则是根据请求及时创建和释放的`IServiceProvider`，我们可以将它们分别称为`Application ServiceProvider`和`Request ServiceProvider`。

![Asp.Net Core 服务生命周期](https://i.loli.net/2020/02/26/QoOeufjVxMagdcr.png)

在ASP.NET Core应用初始化过程中，即请求管道构建过程中使用的服务实例都是由`Application ServiceProvider`提供的。在具体处理每个请求时，ASP.NET Core框架会利用注册的一个中间件来针对当前请求创建一个服务范围，该服务范围提供的`Request ServiceProvider`用来提供当前请求处理过程中所需的服务实例。一旦服务请求处理完成，上述的这个中间件会主动释放掉由它创建的服务范围。

## 5. ASP.NET Core 服务范围检验
如果我们在一个ASP.NET Core应用中将一个服务的生命周期注册为`Scoped`，实际上是希望服务实例采用基于请求的生命周期。

假定以下场景。

在一个ASP.NET Core应用中采用`Entity Framework Core`来访问数据库，我们一般会将对应的`DbContext`类型（姑且命名为`FoobarDbContext`）注册为一个`Scoped`服务，这样既可以保证在`FoobarDbContext`能够在同一个请求上下文中被重用，也可以确保`FoobarDbContext`在请求结束之后能够及时将数据库链接释放掉。

假定有另一个`Singleton`服务（姑且命名为`Foobar`）具有针对`FoobarDbContext`的依赖。由于`Foobar`是一个`Singleton`服务实例，所以被它引用的`FoobarDbContext`也只能在应用关闭的时候才能被释放。

为了解决以上这个问题，可以让`IServiceProvider`在提供`Scoped`服务实例的时候进行针对性的检验。针对服务范围验证的开关由`ServiceProviderOptions`的`ValidateScopes`属性来控制，默认情况下是关闭的。如果希望开启针对服务范围的验证，我们可以在调用`IServiceCollection`接口的`BuildServiceProvider`方法的时候指定一个`ServiceProviderOptions`对象作为参数，或者直接调用另一个扩展方法并将传入的参数`validateScopes`设置为`True`。

```csharp
public class ServiceProviderOptions
{
    public bool ValidateScopes { get; set; }
}

public static class ServiceCollectionContainerBuilderExtensions
{
    public static ServiceProvider BuildServiceProvider(this IServiceCollection services, ServiceProviderOptions options);
    public static ServiceProvider BuildServiceProvider(this IServiceCollection services, bool validateScopes);
}
```

针对服务范围的验证对于`IServiceProvider`来说是一项额外附加的操作，会对性能带来或多或少的影响，所以一般情况下这个开关只会在开发（`Development`）环境被开启，对于产品（`Production`）或者预发（`Staging`）环境下最好将其关闭。

<small id='comment'>
[1] 对于分别采用 Scoped和Singleton模式提供的服务实例，当前ServiceProvider和根ServiceProvider分别具有对它们的引用。如果采用Transient模式，只有服务类型实现了IDisposable接口，当前ServiceProvider才需要对它保持引用以完成对它们的回收，否则没有任何一个ServiceProvider保持对它们的引用。
</small>

> 参考文献
* http://www.cnblogs.com/artech/p/asp-net-core-di-life-time.html
* https://www.cnblogs.com/artech/p/net-core-di-08.html