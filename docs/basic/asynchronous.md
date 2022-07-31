# 异步编程

.Net 中很多的类接口设计的时候都考虑了多线程问题,简化了多线程程序的开发。不用自己去写`WaitHandler`等这些底层的代码。随着历史的发展,这些类的接口设计演化经历过三种不同的风格:`EAP`、`APM`和`TPL`。

## 1. EAP
`EAP`是`Event-based Asynchronous Pattern`(基于事件的异步模型)的简写。

```csharp
// 注：WebClient类在.Net中不被支持，推荐使用HttpClient替代
var wc = new WebClient();
wc.DownloadStringCompleted += (s,e)=>{
    MessageBox.Show(e.Result);
};

wc.DownloadStringAsync(new Uri("https://www.baidu.com"));
```

`EAP`特点是一个异步方法配一个`***Completed`事件。使用简单，但业务复杂的时比较麻烦,比如下载 A 成功后再下载 B,如果下载 B 成功再下载 C,否则就下载 D,会出现类似JS的多层回调函数嵌套的问题。

## 2. APM
`APM`是`Asynchronous Programming Model`(异步编程模型)的缩写。是.Net 旧版本中广泛使用的异步编程模型。

`APM`方法名字以 `BeginXXX` 开头,调用结束后需要 `EndXXX`回收资源。

.Net 中有如下的常用类支持`APM`:`Stream`、`SqlCommand`、`Socket` 等。

### 2.1 简单使用

```csharp
//异步非阻塞方式
var fs = File.OpenRead("/Users/zhangcheng/test.txt");
var buffer = new byte[10 * 1024];
fs.BeginRead(buffer, 0, buffer.Length, ar =>
{
    using (fs)
    {
        fs.EndRead(ar);
        Console.WriteLine(Encoding.UTF8.GetString(buffer));
    }
}, fs);
```

### 2.2 同步调用
`APM`方法名字以 `BeginXXX` 开头,返回类型为`IAsyncResult`的对象，该对象有一个`AsyncWaitHandle`属性是用来等待异步任务执行结束的一个同步信号。如果等待`AsyncWaitHandle`则，异步会阻塞并转为同步执行。

```csharp
// 同步阻塞方式
using(var fs = File.OpenRead("/Users/zhangcheng/test.txt"))
{
    var buffer = new byte[10*1024];
    var aResult =
        fs.BeginRead(buffer, 0, buffer.Length, null, null);
    aResult.AsyncWaitHandle.WaitOne(); //同步等待任务执行结束
    fs.EndRead(aResult);

    Console.WriteLine(Encoding.UTF8.GetString(buffer));
}
```

### 2.3 委托异步调用
旧版.NET中,委托类型具有`Invoke`和`BeginInvoke`两个方法分别用于同步和异步调用委托。其中`BeginInvoke`使用的就是APL风格。

**通过`BeginInvoke`异步调用委托在.NET中不被支持。**

```csharp
var addDel = new Func<int, int, string>((a, b) =>
{
    Thread.Sleep(500); //模拟耗时操作
    return (a + b).ToString();
});


//委托同步调用
var res = addDel.Invoke(1, 2);
res = addDel(1, 2); //简化写法


//委托异步调用
addDel.BeginInvoke(1, 2, ar =>
{
    var result = addDel.EndInvoke(ar);
    Console.WriteLine(result);
}, addDel);
```

## 3. TPL
### 3.1 简单使用

`TPL`是`Task Parallel Library`(并行任务库存)是.Net 4.0 之后带来的新特性,更简洁,更方便。现在.Net 平台下已经广泛使用。

```csharp
static async Task Test()
{
    using (var fs = File.OpenRead("/Users/zhangcheng/test.txt"))
    {
        var buffer = new byte[10 * 1024];
        await fs.ReadAsync(buffer, 0, buffer.Length);
        Console.WriteLine(Encoding.UTF8.GetString(buffer));
    }
}
```

* **`TPL`风格运行我们用线性方式编写异步程序。** .NET中目前大多数耗时操作都提供了TPL风格的方法。
* **`TPL`风格编程可以大幅提升系统吞吐量**，B/S程序效果更为显著，可以使用异步编程的地方尽量不要使用同步。
* `await`会确保异步结果返回后再执行后续代码，不会阻塞主线程。
* `TPL`风格方法都习惯以 `Async`结尾。
*  使用`await`关键字方法必须使用`async`修饰
*  接口中声明方法时不能使用`async`关键字，在其实现类中可以。

###### `TPL`风格方法允许以下三种类型的返回值：
* `Task/ValueTask`。异步Task做返回类型，相当于无返回值。方法被调用时支持`await`等待。
* `Task<T>/ValueTask<T>`。  `T`为异步方法内部实际返回类型。
* `void`。使用`void`做返回类型的异步方法，被调用时不支持`await`等待。

### 3.2 ValueTask

C# 7.0提供了`ValueTask/ValueTask<T>`两种可用于异步编程的值类型，其用法与`Task/Task<T>`相似。

由于`Task/Task<T>`是一个引用类型，从异步方法返回一个`Task`对象意味着每次调用该方法时都需要在托管堆中分配内存。如果异步方法结果立即可用或同步完成，此方式的内存开销代价就不值得了，而这也正是作为值类型的`ValueTask/ValueTask<T>`存在的意义。

每个`ValueTask`只能被消费一次，其可以异步等待（`await`）操作完成，或者利用`AsTask`转换为`Task`。

`ValueTask`是具有两个字段的值类型，而`Task`是具有单个字段的引用类型。因此，使用`ValueTask`意味着要处理更多的数据，如果`await`一个返回`ValueTask`的方法，那么该异步方法的状态机也会更大，它必须容纳一个包含两个字段的结构体而不是在使用`Task`时的单个引用。

此外，如果异步方法的使用者使用`Task.WhenAll`或者`Task.WhenAny`，在异步方法中使用`ValueTask<T>`作为返回类型可能会代价很高。这是因为您需要使用`AsTask`方法将`ValueTask<T>`转换为`Task<T>`，这会引发一个分配，而如果使用起初缓存的`Task<T>`，则可以轻松避免这种分配。

经验法则是这样的，**当异步方法结果立即可用或需要同步执行时，异步方法返回`ValueTask/ValueTask<T>`代替`Task/Task<T>`，可以避免不必要的内存开销**。

### 3.3 同步调用

返回`Task`或`Task<T>``TPL`方法可以同步调用。调用`Task`对象的`Wait()`方法会同步阻塞线程直到任务执行完成，然后可以通过其`Result`属性拿到最终执行结果。

在同步方法中不使用`await`而直接使用`Task`对象的`Result`属性也会导致等待阻塞。

```csharp
Task<string> task = TestAsync();
task.Wait(); //同步等待
Console.Writeline(task.Result); //拿到执行结果
```

**使用APL风格编程，一定要全程使用异步，中间任何环节使用同步，不仅不会提升程序性能，而且容易造成死锁。**

### 3.4 并行异步

如果存在多个相互无关联的异步任务，使用`await`语法会让多个任务顺序执行，如果想实现并发执行，我们可以使用`Task.WhenAll()`方式。

```csharp
static async Task GetWeatherAsync()
{
    using (var hc = new HttpClient())
    {
        //三个顺序执行
        Console.WriteLine(await hc.GetStringAsync("https://baidu.com/getweather"));
        Console.WriteLine(await hc.GetStringAsync("https://google.com/getweather"));
        Console.WriteLine(await hc.GetStringAsync("https://bing.com/getweather"));
    }
}
```
使用`Task.WhenAll()`改造后如下：<span id="whenall" />
``` csharp{10}
static async Task GetWeatherAsync()
{
    using (var hc = new HttpClient())
    {
        var task1 = hc.GetStringAsync("https://baidu.com/getweather");
        var task2 = hc.GetStringAsync("https://google.com/getweather");
        var task3 = hc.GetStringAsync("https://bing.com/getweather");

        // 三个任务并行执行
        var results = await Task.WhenAll(task1, task2, task3);
        foreach (var result in results)
            Console.WriteLine(result);
    }
}
```

### 3.5 自定义异步方法

```csharp
Task DoAsync()
{
    return Task.Run(() =>
    {
        // do something 
    });
}

Task<string> DoAsync()
{
    return Task.Run(() =>
    {
        //do something
        return "Hello";
    });
}

Task<DateTime> GetDateAsync()
{
    // 从简单对象Task 可以使用 Task.FromResult()
    return Task.FromResult(DateTime.Today);
}

ValueTask<DateTime> GetTimeAsync()
{
    // 返回值立即可用时建议使用值类型ValueTask<T>
    return new ValueTask<DateTime>(DateTime.Now);
}
```

### 4. 异步本地存储
异步是基于线程池的，它可以高效地使用有限的线程完成大量并行任务。异步方法存在一个负责状态检查并执行回调的线程和若干任务处理线程，其线程调度由系统完成，执行异步任务和回调的线程可能不同，因此线程本地存储并不适用于异步场景，而异步本地存储因此而生。

```csharp{4}
//异步共享变量
private static string _name = "Colin";
//异步本地变量    各异步任务中独享变量复本
private static readonly AsyncLocal<int> _age = new AsyncLocal<int> {Value = 18};

public static async Task Main()
{
    await Task.Run(() =>
    {
        _name = "Robin";
        _age.Value = 19;
        Console.WriteLine($"{_name} is {_age.Value} years old");
    });

    await Task.Run(() =>
    {
        _name = "Sean";
        _age.Value = 20;
        Console.WriteLine($"{_name} is {_age.Value} years old");
    });

    Console.WriteLine($"{_name} is {_age.Value} years old");
    Console.ReadKey();
}
```
异步本地存储保存在异步任务执行上下文中，切换不同异步任务时会自动切换对应任务的执行上下文，任务切换回来后会恢复之前保存的执行上下文。

子任务可以读取父任务上下文中的本地存储，但是子任务修改后不会影响父任务。类似于JavaScript中的变量名提升。但如果本地存储是一个引用类型，在子任务中修改了父任务的本地存储对象的某个属性是可以影响到父任务的。

为了避免异步上下文中本地存储在不同任务间的相互影响，可以使用`ExecutionContext.SuppressFlow()`方法来禁止捕捉执行上下文。

### 5. 异常处理
**TPL风格编程中,有些情况下程序出现异常而不会抛出，也不会导致程序异常退出，此时会导致一些莫名的错误**。但是显式的使用`try...catch`可以捕获到这些异常，这就要求开发者在代码编写过程中谨慎权衡，在可能出现的异常的地方进行手动异常处理。

TPL编程有时会抛出`AggregateException`,这通常发生在并行有多个任务执行的情况下,如上面[并行异步](#whenall)案例的情况。多个并行任务可能有多个异常, 因此`AggregateException`是一个聚合型异常类型，通过其`InnerExceptions` 属性可以获得多个异常对象信息，逐个解析即可。

