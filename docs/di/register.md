# .Net 服务注册

**服务注册本质是创建相应的`ServiceDescriptor`对象并将其添加到指定`IServiceCollection`集合对象中的过程，期间并不会实例化服务对象。服务对象实例化是在从容器中获取服务实例(`ServiceProvider.GetService<T>`)时才会被创建。**

## 1. ServiceDescriptor

`ServiceDescriptor`提供对服务的描述信息，这些信息将指导`ServiceProvider`正确地实施服务提供操作。

```csharp
public class ServiceDescriptor
{
    public Type ServiceType { get; }
    public ServiceLifetime Lifetime { get; }

    public Type ImplementationType { get; }
    public Func<IServiceProvider, object> ImplementationFactory { get; }
    public object ImplementationInstance { get; }
    
    public ServiceDescriptor(Type serviceType, object instance);
    public ServiceDescriptor(Type serviceType, Func<IServiceProvider, object> factory, ServiceLifetime lifetime);
    public ServiceDescriptor(Type serviceType, Type implementationType, ServiceLifetime lifetime);
}
```

`ServiceType`属性代表提供服务的类型，由于标准化的服务一般会定义成接口，所以在绝大部分情况下体现为一个接口类型。

类型为`ServiceLifetime`的属性`Lifetime`体现了`ServiceProvider`针对服务实例生命周期的控制方式。如下面的代码片段所示，`ServiceLifetime`是一个枚举类型，定义其中的三个选项（`Singleton`、`Scoped`和`Transient`）体现三种对服务对象生命周期的控制形式，我们在后续对此作专门的介绍。

```csharp
public enum ServiceLifetime
{
    Singleton,
    Scoped,
    Transient
}
```

`ServiceDescriptor`的其它三个属性体现了服务实例的三种提供方式，并对应着三个构造函数。如果我们指定了服务的实现类型（对应于`ImplementationType`属性），那么最终的服务实例将通过调用定义在实现类型中某一个构造函数来创建。如果指定的是一个`Func<IServiceProvider, object>`对象（对应于`ImplementationFactory`属性），那么`IServiceProvider`对象将会将自身作为输入参数调用该委托对象来提供服务实例。如果我们直接指定一个现有的对象（对应的属性为`ImplementationInstance`），那么该对象就是最终提供的服务实例。

如果我们采用直接提供服务实例的形式来创建`ServiceDescriptor`对象，意味着服务注册默认采用`Singleton`生命周期模式。对于通过其它两个构造函数创建的`ServiceDescriptor`对象来说，则需要显式指定采用的生命周期模式。

除了调用上面介绍的三个构造函数来创建对应的`ServiceDescriptor`对象之外，我们还可以提供定义在`ServiceDescriptor`类型中一系列静态方法来创建该对象。如下面的代码片段所示，`ServiceDescriptor`提供了如下两个名为`Describe`的方法重载来创建对应的`ServiceDescriptor`对象。

```csharp
public class ServiceDescriptor
{   
    public static ServiceDescriptor Describe(Type serviceType, Func<IServiceProvider, object> implementationFactory, ServiceLifetime lifetime);
    public static ServiceDescriptor Describe(Type serviceType, Type implementationType, ServiceLifetime lifetime);
}
```

当我们调用上面两个`Describe`方法来创建`ServiceDescriptor`对象的时候总是需要指定采用的生命周期模式，为了让对象创建变得更加简单，`ServiceDescriptor`中还定义了一系列针对三种生命周期模式的静态工厂方法。如下所示的是针对`Singleton`模式的一组`Singleton`方法重载的定义，针对其它两种模式的`Scoped`和`Transient`方法具有类似的定义。

```csharp
public class ServiceDescriptor
{
    public static ServiceDescriptor Singleton<TService, TImplementation>() where TService: class where TImplementation: class, TService;
    public static ServiceDescriptor Singleton<TService, TImplementation>(Func<IServiceProvider, TImplementation> implementationFactory) where TService: class where TImplementation: class, TService;
    public static ServiceDescriptor Singleton<TService>(Func<IServiceProvider, TService> implementationFactory) where TService: class;
    public static ServiceDescriptor Singleton<TService>(TService implementationInstance) where TService: class;
    public static ServiceDescriptor Singleton(Type serviceType, Func<IServiceProvider, object> implementationFactory);
    public static ServiceDescriptor Singleton(Type serviceType, object implementationInstance);
    public static ServiceDescriptor Singleton(Type service, Type implementationType);
}
```

## 2. IServiceCollection

`IServiceCollection`对象本质上就是一个元素类型为`ServiceDescriptor`的列表。在默认情况下我们使用的是实现该接口的`ServiceCollection`类型。

```csharp
public interface IServiceCollection : IList<ServiceDescriptor>
{}
public class ServiceCollection : IServiceCollection
{}
```

#### 1) Add

考虑到服务注册是一个高频调用的操作，所以`DI`框架为`IServiceCollection`接口定义了一系列扩展方法完成服务注册的工作，比如下面的这两个`Add`方法可以将指定的一个或者多个`ServiceDescriptor`对象添加到`IServiceCollection`集合中。

```csharp
public static class ServiceCollectionDescriptorExtensions
{
    public static IServiceCollection Add(this IServiceCollection collection, ServiceDescriptor descriptor);
    public static IServiceCollection Add(this IServiceCollection collection, IEnumerable<ServiceDescriptor> descriptors);
}
```

#### 2) Add{Lifetime}

`DI`框架还针对具体生命周期模式为`IServiceCollection`接口定义了一系列的扩展方法，它们会根据提供的输入创建出对应的`ServiceDescriptor`对象并将其添加到指定的`IServiceCollection`对象中。如下所示的是针对`Singleton`模式的`AddSingleton`方法重载的定义，针对其它两个生命周期模式的`AddScoped`和`AddTransient`方法具有类似的定义。

```csharp
public static class ServiceCollectionServiceExtensions
{   
    public static IServiceCollection AddSingleton<TService>(this IServiceCollection services) where TService: class;
    public static IServiceCollection AddSingleton<TService, TImplementation>(this IServiceCollection services) where TService: class where TImplementation: class, TService;
    public static IServiceCollection AddSingleton<TService>(this IServiceCollection services, TService implementationInstance)  where TService: class;
    public static IServiceCollection AddSingleton<TService, TImplementation>(this IServiceCollection services, Func<IServiceProvider, TImplementation> implementationFactory)  where TService: class where TImplementation: class, TService;
    public static IServiceCollection AddSingleton<TService>(this IServiceCollection services, Func<IServiceProvider, TService> implementationFactory)  where TService: class;
    public static IServiceCollection AddSingleton(this IServiceCollection services, Type serviceType);
    public static IServiceCollection AddSingleton(this IServiceCollection services, Type serviceType, Func<IServiceProvider, object> implementationFactory);
    public static IServiceCollection AddSingleton(this IServiceCollection services, Type serviceType, object implementationInstance);
    public static IServiceCollection AddSingleton(this IServiceCollection services, Type serviceType, Type implementationType);
}
```

#### 3) TryAdd

虽然针对同一个服务类型可以添加多个`ServiceDescriptor`，但这情况只有在应用需要使用到同一类型的多个服务实例的情况下才有意义，比如我们可以注册多个`ServiceDescriptor`来提供同一个主题的多个订阅者。如果我们总是根据指定的服务类型来提取单一的服务实例，这种情况下一个服务类型只需要一个`ServiceDescriptor`对象就够了。对于这种场景我们可能会使用如下两个名为`TryAdd`的扩展方法，该方法会根据指定`ServiceDescriptor`提供的服务类型判断对应的服务注册是否存在，只有**不存在指定类型的服务注册情况下**，我们提供的`ServiceDescriptor`才会被添加到指定的`IServiceCollection`对象中。

```csharp
public static class ServiceCollectionDescriptorExtensions
{
    public static void TryAdd(this IServiceCollection collection, ServiceDescriptor descriptor);
    public static void TryAdd(this IServiceCollection collection, IEnumerable<ServiceDescriptor> descriptors);
}
```

#### 4) TryAdd{Lifetime}

扩展方法`TryAdd`同样具有基于三种生命周期模式的版本，如下所示的针对`Singleton`模式的`TryAddSingleton`方法的定义。在指定服务类型对应的`ServiceDescriptor`不存在的情况下，它们会采用提供的实现类型、服务实例创建工厂以及服务实例来创建生命周期模式为`Singleton`的`ServiceDescriptor`对象并将其添加到指定的`IServiceCollection`对象中。针对其它两种生命周期模式的`TryAddScoped`和`TryAddTransient`方法具有类似的定义。

```csharp
public static class ServiceCollectionDescriptorExtensions
{    
    public static void TryAddSingleton<TService>(this IServiceCollection collection)  where TService: class;
    public static void TryAddSingleton<TService, TImplementation>(this IServiceCollection collection)  where TService: class  where TImplementation: class, TService;
    public static void TryAddSingleton(this IServiceCollection collection,  Type service);
    public static void TryAddSingleton<TService>(this IServiceCollection collection,  TService instance) where TService: class;
    public static void TryAddSingleton<TService>(this IServiceCollection services,  Func<IServiceProvider, TService> implementationFactory)  where TService: class;
    public static void TryAddSingleton(this IServiceCollection collection,  Type service, Func<IServiceProvider, object> implementationFactory);
    public static void TryAddSingleton(this IServiceCollection collection,  Type service, Type implementationType);
}
```

#### 5) TryAddEnumerable

除了上面介绍的扩展方法`TryAdd`和`TryAdd{Lifetime}`之外，`IServiceCollection`接口还具有如下两个名为`TryAddEnumerable`的扩展方法。当`TryAddEnumerable`方法在决定将指定的`ServiceDescriptor`添加到`IServiceCollection`对象之前，它也会做存在性检验。与`TryAdd`和`TryAdd{Lifetime}`方法不同的是，该方法在**判断执行的`ServiceDescriptor`是否存在时会同时考虑服务类型和实现类型。**

```csharp
public static class ServiceCollectionDescriptorExtensions
{   
    public static void TryAddEnumerable(this IServiceCollection services, ServiceDescriptor descriptor);
    public static void TryAddEnumerable(this IServiceCollection services, IEnumerable<ServiceDescriptor> descriptors);
}
```

`TryAddEnumerable`判断存在性的实现类型不只是`ServiceDescriptor`的`ImplementationType`属性。如果`ServiceDescriptor`是通过一个指定的服务实例创建的，那么该实例的类型会作为用来判断存在与否的实现类型。如果`ServiceDescriptor`是服务实例工厂来创建的，那么代表服务实例创建工厂的`Func<in T, out TResult>`对象的第二个参数类型将被用于判断`ServiceDescriptor`的存在性。扩展方法`TryAddEnumerable`的实现逻辑可以通过如下这段程序来验证。

```csharp
var services = new ServiceCollection();

services.TryAddEnumerable(ServiceDescriptor.Singleton<IFoobarbazgux, Foo>());
Debug.Assert(services.Count == 1);
services.TryAddEnumerable(ServiceDescriptor.Singleton<IFoobarbazgux, Foo>());
Debug.Assert(services.Count == 1);
services.TryAddEnumerable(ServiceDescriptor.Singleton<IFoobarbazgux>(new Foo()));
Debug.Assert(services.Count == 1);
Func<IServiceProvider, Foo> factory4Foo = _ => new Foo();
services.TryAddEnumerable(ServiceDescriptor.Singleton<IFoobarbazgux>(factory4Foo));
Debug.Assert(services.Count == 1);

services.TryAddEnumerable(ServiceDescriptor.Singleton<IFoobarbazgux, Bar>());
Debug.Assert(services.Count == 2);
services.TryAddEnumerable(ServiceDescriptor.Singleton<IFoobarbazgux>(new Baz()));
Debug.Assert(services.Count == 3);
Func<IServiceProvider, Gux> factory4Gux = _ => new Gux();
services.TryAddEnumerable(ServiceDescriptor.Singleton<IFoobarbazgux>(factory4Gux));
Debug.Assert(services.Count == 4);
```

如果通过上述策略得到的实现类型为`Object`，那么`TryAddEnumerable`会因为实现类型不明确而抛出一个`ArgumentException`类型的异常。这种情况主要发生在提供的`ServiceDescriptor`对象是由服务实例工厂创建的情况，所以上面实例中用来创建`ServiceDescriptor`的工厂类型分别为`Func<IServiceProvider, Foo>`和`Func<IServiceProvider, Gux>`，而不是`Func<IServiceProvider, object>`。

```csharp
var service = ServiceDescriptor.Singleton<IFoobarbazgux>(_ => new Foo());
new ServiceCollection().TryAddEnumerable(service);
```

假设我们采用如上所示的方式利用一个Lamda表达式来创建一个`ServiceDescriptor`对象，对于创建的`ServiceDescriptor`来说，其服务实例工厂是一个`Func<IServiceProvider, object>`对象，所以当我们将它作为参数调用`TryAddEnumerable`方法的会抛出如下图所示的`ArgumentException`异常。

![ArgumentException类型的异常](https://i.loli.net/2020/02/26/GSMgkrhYCRnw5fT.png)

#### 6) RemoveAll & Replace

上面介绍的这些方法最终的目的都是添加新的`ServiceDescriptor`到指定的`IServiceCollection`对象中，有的时候我们还希望删除或者替换现有的某个`ServiceDescriptor`，这种情况下通常发生在需要对当前使用框架中由某个服务提供的功能进行定制的时候。由于`IServiceCollection`实现了`IList<ServiceDescriptor>`接口，所以我们可以调用其`Clear`、`Remove`和`RemoveAt`方法来清除或者删除现有的`ServiceDescriptor`。除此之外，我们还可以选择如下这些扩展方法。

```csharp
public static class ServiceCollectionDescriptorExtensions
{
    public static IServiceCollection RemoveAll<T>( this IServiceCollection collection);
    public static IServiceCollection RemoveAll(this IServiceCollection collection,  Type serviceType);
    public static IServiceCollection Replace(this IServiceCollection collection,  ServiceDescriptor descriptor);
}
```

`RemoveAll`和`RemoveAll<T>`方法帮助我们针对指定的服务类型来删除添加的`ServiceDescriptor`。`Replace`方法会使用指定的`ServiceDescriptor`去替换第一个具有相同服务类型（对应`ServiceType`属性）的`ServiceDescriptor`，实际操作是先删除后添加。如果从目前的`IServiceCollection`中找不到服务类型匹配的`ServiceDescriptor`，指定的`ServiceDescriptor`会直接添加到`IServiceCollection`对象中，这一逻辑也可以利用如下的程序来验证。

```csharp
var services = new ServiceCollection();
services.Replace(ServiceDescriptor.Singleton<IFoobarbazgux, Foo>());
Debug.Assert(services.Any(it => it.ImplementationType == typeof(Foo)));

services.AddSingleton<IFoobarbazgux, Bar>();
services.Replace(ServiceDescriptor.Singleton<IFoobarbazgux, Baz>());
Debug.Assert(!services.Any(it=>it.ImplementationType == typeof(Foo)));
Debug.Assert(services.Any(it => it.ImplementationType == typeof(Bar)));
Debug.Assert(services.Any(it => it.ImplementationType == typeof(Baz)));
```

> 参考文献
<https://www.cnblogs.com/artech/p/net-core-di-07.html>
