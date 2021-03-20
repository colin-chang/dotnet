# 多线程

## 1. 进程
进程(`Process`)是操作系统中的一个基本概念，它包含着一个运行程序所需要的资源。进程之间是相对独立的，一个进程无法直接访问另 一个进程的数据（除非利用分布式计算方式），一个进程运行的失败也不会影响其他进程的运行，操作系统就是利用进程把工作划分为多个独立的区域的。进程可以理解为一个程序的基本边界。

操作系统分配资源的最小单位是进程，进程之间是相互隔离的，即每个进程有属于自己的数据段、程序段、进程控制块。

.NET中使用`Process`类管理维护进程信息。`Process`常用成员如下。

成员|含义
:-|:-
`Threads`|获取当前进程的所有线程
`Kill()`|杀掉指定进程
`Process.GetCurrentProcess()`|拿到当前程序进程
`Process.GetProcesses()`|拿到系统当前所有进程
`Process.GetProcessById()`|拿到指定Id的进程
`Process.Start()`|启动一个进程。

```csharp
// 启动IE浏览器并访问百度
Process.Start("iexplore","https://www.baidu.com");
```

## 2. 线程
线程(`Thread`)是任务调度的最小单位。一个线程是一个进程里面的代码执行流，每个线程都有自己的专有寄存器(栈指针、程序计数器等)，但代码区是共享的。

在.NET中线程可以分为原生线程和托管线程两类。前者有操作系统直接管理，后者则是.NET维护的统一线程模型。

### 2.1 原生线程

由操作系统直接管理的线程称为原生线程。

计算机CPU通常有多个物理核心，每个物理核心又分为多个逻辑核心，在每个逻辑核心中同时只能运行单个线程。单个逻辑核心中执行多个线程时，实际上是多个线程在不断进行切换轮流执行。

线程切换方式有主动切换和被动切换两种。主动切换是线程自身主动要求CPU挂起，被动切换则是CPU在某个线程执行到最大时间时强制进行线程切换，也称为抢占模式，每个线程最大执行时间称为“时间片”。

![线程切换](https://i.loli.net/2021/03/14/kAzbBcMhDFgINmW.jpg)

如上图所示在每个原生线程中都有一个栈空间，它是有操作系统分配的用于存储线程执行函数的参数列表等信息，并在线程执行结束后由操作系统统一回收。

每个CPU逻辑核心内部存在着多个寄存器用于数据运算，它们保存着每个线程运行时的执行现场数据，我们称之为线程上下文，当线程切换时首先要将CPU寄存器中现场数据存储到当前线程，再将接下来执行的线程中记录的上下文恢复到CPU寄存器，这一操作我们称之为“线程上下文切换”，这是一项耗时操作。大量线程的频繁切换会降低CPU执行效率，线程数太少则无法利用充分利用多核CPU的性能，合适的线程数量要根据不同的计算机配置情况酌情而定。


### 2.2 托管线程
多线程在不同操作系统中有不同的实现，.NET基于操作系统原生线程构建了一套统一的线程模型，称为托管线程。托管线程允许开发者在不同平台上具有统一的多线程开发体验。

一个托管线程最多可以关联零个或一个原生线程。一个托管线程在.NET中体现为一个`Thread`对象，只有运行中的托管线程才能关联一个原生线程。

![托管线程](https://i.loli.net/2021/03/14/euICJATNtwB13oR.jpg)

托管代码必须在托管线程中执行。非托管代码在原生线程中调用托管代码，则需要先创建托管线程然后关联到原生线程。.NET CLR负责管理托管线程对象和关联原生线程(通过调用操作系统API方式)。

### 2.3 多线程基础
* 多线程可以让一个程序“同时”处理多个事情。后台运行程序，提高程序的运行效率，同时解决耗时操作时GUI出现无响应的情况。
* 一个进程的多个线程之间可以共享程序代码。每个线程会将共享的代码分别拷贝一份去执行，每个线程是单独执行的。
* 线程有前台线程和后台线程，创建一个线程默认为前台线程。
* 只有所有的前台线程都关闭时程序才能退出。只要所有前台线程都关闭后台线程自动关闭。
* 线程被释放时，线程中定义的内容都会自动被释放。
  
.NET中使用`Thread`类管理维护线程信息。`Thread`常用成员如下。

成员|含义
:-|:-
`Name`|线程名
`IsBackground`|获取或设置是否是后台线程
`IsAlive`|表示当前线程的执行状态
`ManagedThreadId`|获取当前托管线程的唯一标示符Id
`Priority`|获取或设置线程的优先级，只是推荐给OS，并不一定执行
`Start()`|启动线程
`Interrupt()`|用于提前唤醒一个在Sleep的线程
`Abort()`|强制终止线程
`Join()`|等待指定线程执行完毕后再接着执行当前线程
`Thread.CurrentThread`|获得当前的线程引用
`Thread.Sleep()`|让当前线程休眠。只能当前线程自身主动休眠，不能被其他线程控制。 


* `Abort()`方法会引发线程内当前在执行的代码抛出`ThreadAbortException`，可能会造成线程占用资源无法释放，一般情况下不推荐使用。可以通过结束线程执行的方法来结束并释放线程。
* `Interrupt()`唤醒`Sleep`的线程时`Sleep`方法会抛出 `ThreadInterruptedException`，需要我们`catch`异常，否则异常会导致程序崩溃退出。

    ```csharp
    var t1 = new Thread(() =>
    {
        try
        {
            Thread.Sleep(5000);
        }
        catch (ThreadInterruptedException)
        {
            Console.WriteLine("t1线程被意外唤醒");
        }

        Console.WriteLine("Fuck");
    }) {IsBackground = true};

    t1.Start();
    t1.Interrupt();
    ```

### 2.4 线程本地存储
如果多个线程中都使用某个同名变量，但又不想在每个线程中单独定义可以考虑使用全局变量，但普通全局变量不是线程安全的，被多个线程修改会造成相互干扰。在全局变量上使用`[ThreadStatic]`标记可以实现每个线程中只修改变量独立复本而互不干扰则。除此之外，也可以使用`ThreadLocal`类型来实现相同的功能。类似于Python中的`threading.local()`方法。

```csharp{2,6,26}
// 各线程独享变量复本
[ThreadStatic] 
private static string _name = "Colin";

// 与[ThreadStatic]功能类似
private static readonly ThreadLocal<int> _age = new() {Value = 18};

public static void Main()
{
    new Thread(() =>
    {
        _name = "Robin";
        _age.Value = 19;
        Console.WriteLine($"{_name} is {_age.Value} years old");
    }).Start();

    new Thread(() =>
    {
        _name = "Sean";
        _age.Value = 20;
        Console.WriteLine($"{_name} is {_age.Value} years old");
    }).Start();

    Console.WriteLine($"{_name} is {_age.Value} years old");
    Console.ReadKey();
    _age.Dispose();// 释放资源
}
```

线程本地变量最常用于为每个线程绑定一个数据库连接，HTTP请求，用户身份信息等，这样一个线程的所有调用到的处理函数都可以非常方便地访问这些资源。

特别需要注意的一点是，**线程本地存储不适用与异步操作**，因为异步任务和异步回调可能是不同的线程执行，异步场景中可以使用异步本地存储。

## 3. 应用程序域
应用程序域(`AppDomain`)提供安全而通用的处理单元，公共语言运行库可使用它来提供应用程序之间的隔离。我们可以单个进程中运行几个应用程序域，而不会造成进程间调用或进程间切换等方面的额外开销。在一个进程内运行多个应用程序的能力显著增强了服务器的可伸缩性。

应用程序域允许我们在一个应用程序中出现的错误不会影响其他应用程序。能够在不停止整个进程的情况下停止单个应用程序。应用程序域形成了托管代码的隔离、卸载和安全边界。

![进程线程和应用程序域的关系](https://i.loli.net/2020/02/26/OPNaQuS3lg7GKWe.jpg)

## 4. 线程同步
当一个方法同时被多个线程调用并修改同一变量时就可能存在脏数据的问题，我们称之为“多线程方法重入”。

### 4.1 Join

`Join()`方法可以让当前线程等待指定线程执行结束后再**接着**运行当前线程。

```csharp{11}
var t1 = new Thread(() =>
{
    for (int i = 0; i < 20; i++)
    {
        Console.WriteLine("t1 " + i);
    }
});

var t2 = new Thread(() =>
{
    t1.Join(); //等着 t1 执行结束后接着执行以下代码

    for (int i = 0; i < 20; i++)
    {
        Console.WriteLine("t2 " + i);
    }
});

t1.Start();
t2.Start();
```

### 4.2 Interlocked
.NET中`Interlocked`静态类提供了一些类工具方法用于多线程间共享简单变量的原子操作。
```csharp
var n = 5;
//自增
Interlocked.Increment(ref n);
// 自减
Interlocked.Decrement(ref n);
// 加
Interlocked.Add(ref n, 2);
// 按位与
Interlocked.And(ref n, 3);
// 按位或
Interlocked.Or(ref n, 3);
// 交换值
Interlocked.Exchange(ref n, 3);
// 比较并交换值 
Interlocked.CompareExchange(ref n, 2, 5);
```

### 4.3 线程安全集合
.NET在`System.Collections.Concurrent`命名空间下为开发者提供了一些基于无锁算法实现的线程安全集合。
* `ConcurrentBag<T>`
* `ConcurrentDictionary<T,K>`
* `ConcurrentQueue<T>`
* `ConcurrentStack<T>`

### 4.4 MethodImplAttribute
在线程不安全的方法上打上`[MethodImpl(MethodImplOptions.Synchronized)]`标记后，此方法同时只能被一个线程调用，变成了同步方法。

```csharp{1}
[MethodImpl(MethodImplOptions.Synchronized)]
public void Count()
{
    // do something ...
}
```

### 4.5 自旋锁
自旋锁基于原子操作实现，比如0表示未获取锁，1表示已获取锁。自旋锁并不会阻塞线程执行，避免了线程上下文切换导致的资源消耗。自旋锁模式中所有线程都会一直保持执行并竞争获取锁，长时间保持运行会导致CPU占用率过高，因此不适用于耗时较长的操作，同时自旋锁并不会公平的分配资源，使用不当也可能会导致线程饥饿，即有的线程可能一直无法竞争到资源。

```csharp{1,13,15,16,26}
private static int _lock = 0;

public static void Main()
{
    new Thread(() => SayHi("Colin")).Start();
    new Thread(() => SayHi("Robin")).Start();

    Console.ReadKey();
}

private static void SayHi(string name)
{
    var spinWait = new SpinWait();
    // 获取锁
    while (Interlocked.Exchange(ref _lock, 1) != 0)
        spinWait.SpinOnce();
    try
    {
        // 模拟耗时操作
        Thread.Sleep(2000);
        Console.WriteLine($"Hi {name}");
    }
    finally
    {
        // 释放锁
        Interlocked.Exchange(ref _lock, 0);
    }
}
```
以上案例中`spinWait.SpinOnce();`执行逻辑如下：
* 一定次数内，CPU逻辑核心>1 会执行 `Thread.SpinWait()` 
* 超过一定次数，CPU逻辑核心=1， 交替使用`Thread.Sleep(0)`和`Thread.Yield()`切换线程
* 再超过一定次数 执行`Thread.Sleep(1)`CPU休眠

在Windows系统中`Thread.Sleep()`方法最终会调用操作系统的`SleepEx`API，它会切换任意CPU逻辑核心关联的待运行队列中的线程，而`Thread.Yield()`则会调用操作系统的`SwithToThread`API,它只会在当前CPU逻辑核心的待运行队列中切换线程。但两者在Linux系统中则无差别。

除了以上方式，.NET还为开发者封装了`SpinLock`来简化`SpintWait`的使用。
```csharp{1,13,15,26,27}
private static SpinLock _lock = new();

public static void Main()
{
    new Thread(() => SayHi("Colin")).Start();
    new Thread(() => SayHi("Robin")).Start();

    Console.ReadKey();
}

private static void SayHi(string name)
{
    var lockTaken = false;
    // 获取锁
    _lock.Enter(ref lockTaken);

    try
    {
        // 模拟耗时操作
        Thread.Sleep(2000);
        Console.WriteLine($"Hi {name}");
    }
    finally
    {
        // 释放锁
        if (lockTaken)
            _lock.Exit();
    }
}
```

### 4.6 互斥锁
互斥锁基于原子操作和操作系统的线程调度，支持方法重入，递归调用，故而也称递归锁。`Mutex`锁甚至支持跨进程使用，可以实现跨进程保护资源。

互斥锁可以在线程无法竞争到锁时阻塞线程并让其进入等待队列减少等待期间的资源消耗，但在线程切换时相对于自旋锁会有较大的资源消耗，线程唤醒时间较长，这也导致了互斥锁执行效率较低。


```csharp{1,9,15,25}
private static readonly Mutex _lock = new Mutex();

public static void Main()
{
    new Thread(() => SayHi("Colin")).Start();
    new Thread(() => SayHi("Robin")).Start();

    Console.ReadKey();
    _lock.Dispose(); //销毁锁
}

private static void SayHi(string name)
{
    // 获取锁
    _lock.WaitOne();
    try
    {
        // 模拟耗时操作
        Thread.Sleep(2000);
        Console.WriteLine($"Hi {name}");
    }
    finally
    {
        //释放锁
        _lock.ReleaseMutex();
    }
}
```

### 4.7 混合锁
自旋锁高性能但容器导致CPU高占用，互斥锁较安全但效率低，于是.NET还为开发者提供了高效且通用的混合锁。**混合锁在线程获取锁失败后，会像自旋锁一样重试一定次数，仍无法获得锁才进入等待状态。**

混合锁可以用任何引用类型实例作为锁定对象,锁定同一对象的所有线程均互斥，而且涉及的非托管资源也由CLR自动释放，无需手动干预。混合锁适用于绝大部分应用场景。

锁对象选择很重要,选不对起不到同步的作用和可能会造成其他地方被锁,比如用字符串做锁(因为字符串拘留池导致可能用的是其他地方也在用的锁)。
```csharp{1,14,15,25,26}
private static readonly object _lock = new();

public static void Main()
{
    new Thread(() => SayHi("Colin")).Start();
    new Thread(() => SayHi("Robin")).Start();

    Console.ReadKey();
}

private static void SayHi(string name)
{
    // 获取锁
    var lockTaken = false;
    Monitor.Enter(_lock, ref lockTaken);
    try
    {
        // 模拟耗时操作
        Thread.Sleep(2000);
        Console.WriteLine($"Hi {name}");
    }
    finally
    {
        //释放锁
        if (lockTaken)
            Monitor.Exit(_lock);
    }
}
```
因为混合锁使用频繁但`Monitor`使用较为繁琐，于是.NET进一步对其进行了简化封装，示例如下。

```csharp{1,13}
private static readonly object _lock = new();

public static void Main()
{
    new Thread(() => SayHi("Colin")).Start();
    new Thread(() => SayHi("Robin")).Start();

    Console.ReadKey();
}

private static void SayHi(string name)
{
    lock (_lock)
    {
        // 模拟耗时操作
        Thread.Sleep(2000);
        Console.WriteLine($"Hi {name}");
    }
}
```





### 4.8 读写锁
类似于数据读写分离的机制，.NET在多线程中为开发者提供了读写锁(读取锁/写入锁)，读写锁的概念很简单，允许多个线程同时获取读锁，但同一时间只允许一个线程获得写锁，因此也称作共享-独占锁。

某些场合下，对一个对象的读取次数远远大于修改次数，如果只是简单的用`lock`方式混合锁，会影响读取的效率。如果采用读写锁，则多个线程可以同时读取该对象，只有等到对象被写入锁占用的时候，才会阻塞，需要注意的是当某个线程获取写入锁时，其他只读线程也会被阻塞，直到写入锁被释放。

```csharp{2,21,30,37,45}
//读写锁
private static readonly ReaderWriterLockSlim Lock = new();

public static void Main()
{
    // 一个线程写，会阻塞其它读写
    // new Thread(Write).Start();
    // new Thread(Read).Start();
    // new Thread(Write).Start();

    // 多线程可以同时读
    new Thread(Read).Start();
    new Thread(Read).Start();

    Console.ReadKey();
}

private static void Write()
{
    // 获取写入锁
    Lock.EnterWriteLock();
    try
    {
        Console.WriteLine($"Write\t{Thread.CurrentThread.ManagedThreadId}\t{DateTime.Now}");
        Thread.Sleep(2000);
    }
    finally
    {
        //释放写入锁
        Lock.ExitWriteLock();
    }
}

private static void Read()
{
    // 获取读取锁
    Lock.EnterReadLock();
    try
    {
        Console.WriteLine($"Read\t{Thread.CurrentThread.ManagedThreadId}\t{DateTime.Now}");
    }
    finally
    {
        // 释放读取锁
        Lock.ExitReadLock();
    }
}
```


### 4.9 信号量
.NET在多线程控制中为我们提供了一种信号量机制，信号量以数字表示可用资源数量，例如一个自习室是否可以进入取决于空座数量，这里空座数量就是信号量，类似的场景还有一定数量的银行柜台窗口等。
```csharp{5,27,36}
//自习室
private static readonly ConcurrentBag<string> StudyRoom = new();

//信号量 默认自习室无人，有三个空座，且最多有三个空座
private static readonly SemaphoreSlim _semaphore = new SemaphoreSlim(3, 3);


public static void Main()
{
    //自习室最多容纳3人，以下必有一人等待
    new Thread(() => Enter("Colin")).Start();
    new Thread(() => Enter("Robin")).Start();
    new Thread(() => Enter("Sean")).Start();
    new Thread(() => Enter("Jerry")).Start();

    Thread.Sleep(2000);

    //一人离开自习室释放一个信号量，上面等待的一人才可进入
    new Thread(Exit).Start();

    Console.ReadKey();
}

private static void Enter(string name)
{
    //获取信号量，如果 信号量<=0 则阻塞等待
    _semaphore.Wait();
    StudyRoom.Add(name);
    Console.WriteLine($"{name} enters the study room");
}

private static void Exit()
{
    StudyRoom.TryTake(out var name);
    //释放一个信号量
    _semaphore.Release();
    Console.WriteLine($"{name} exits the study room");
}
}
```

### 4.10 WaitHandle

除了前面提到的“锁”机制外，.NET中`WaitHandle`还提供了一些线程间协同的方法，使得线程可以通过“信号”进行通讯。

WaitHandle是一个抽象类，`EventWaitHandle`是其实现类，我们常用`EventWaitHandle`两个子类`ManualResetEvent`和`AutoResetEvent`。

信号通讯在`EventWaitHandle`中被通俗的比喻为“门”，主要体现为以下三个方法：

```csharp
Set();      // 开门
WaitOne();  // 等待开门
Reset();    // 关门
```

等待开门除了`WaitOne()`之外还有以下用法。
```csharp
//等待所有信号都变为“开门状态”
WaitHandle.WaitAll(WaitHandle[] waitHandles);

//等待任意一个信号变为“开门状态”
WaitHandle.WaitAny(WaitHandle[] waitHandles);
```

#### 4.10.1 ManualResetEvent
`ManualResetEvent`被比喻为手动门，一旦开门后就保持开门状态，除非手动关门，如同“城门”。

```csharp{1,4,17,20}
var mre = new ManualResetEvent(false); //创建"手动门"，默认状态为"关门"
new Thread(() =>
{
    mre.WaitOne(); //等待开门。开门之后后续代码方可执行，否则该线程一直阻塞在此处
    Console.WriteLine("开门了...");

    while (true)
    {
        Console.WriteLine(DateTime.Now);
        Thread.Sleep(1000);
    }
}){IsBackground = true}.Start();

Console.WriteLine("按任意键开门...");
Console.ReadKey();

mre.Set(); //开门

Thread.Sleep(5000);
mre.Reset(); //关门
Console.WriteLine("关门了...");
```

`WaitOne(5000); //最长等待5s`。

#### 4.10.2 AutoResetEvent
`AutoResetEvent`被比喻为自动门，一次开门完成后自动关门，如同“地铁的闸机口”。

```csharp{1,4,13}
var are = new AutoResetEvent(false); //创建"手动门"，默认状态为"关门"
new Thread(() =>
{
    are.WaitOne(); //等待开门。开门之后后续代码方可执行，否则该线程一直阻塞在此处
    Console.WriteLine("开门了...");
    
    //do something ...
}){IsBackground = true}.Start();

Console.WriteLine("按任意键开门...");
Console.ReadKey();

are.Set(); //开门
```

`WaitHandle`现在.NET中较少直接使用了，更多的是作为简单易用的多线程语法的底层实现。


### 4.11 多线程版单例模式
```csharp
class God
{
    private static God _instance = null;
    private static readonly object Locker = new object();

    private God(){}

    public static God GetInstance()
    {
        if (_instance == null)
        {
            lock (Locker)
            {
                if (_instance == null)
                    _instance = new God();
            }
        }

        return _instance;
    }
}
```
以上方式保证线程安全，但是书写较为繁琐，日常开发中推荐使用静态单例方式。
```csharp
class God
{
    private God(){}

    private static readonly God Instance = new God();
    public static God GetInstance() => Instance;
}
```

### 4.12 生产者消费者模式
多个线程同时修改共享数据可能会发生错误，此时我们常用生产者消费者模式来处理此问题。

在生成者和消费者关系中，生产者线程负责产生数据，并把数据存到公共数据区，消费者线程使用数据，从公共数据去中取出数据。我们使用资源加锁的方式来解决线程并发引起的方法重入问题。

```csharp{18,36}
public static void Main()
{
    var products = new Queue<Guid>();

    //2个生产者
    for (var i = 0; i < 2; i++)
    {
        new Thread(() =>
        {
            while (true)
            {
                lock (products)
                {
                    var id = Guid.NewGuid();
                    Console.WriteLine($"{Thread.CurrentThread.ManagedThreadId} 生产{id}");
                    products.Enqueue(id);
                    // 唤醒 线程等待队列中一个消费线程 
                    Monitor.Pulse(products);
                    Thread.Sleep(2000);
                }
            }
        }).Start();
    }

    //3个消费者
    for (var i = 0; i < 3; i++)
    {
        new Thread(() =>
        {
            while (true)
            {
                lock (products)
                {
                    if (products.Count <= 0)
                        //添加当前线程到等待队列并释放锁
                        Monitor.Wait(products);
                    //线程被唤醒后会重新获取锁并继续执行代码
                }

                if (products.TryDequeue(out var product))
                    Console.WriteLine($"{Thread.CurrentThread.ManagedThreadId} 消费{product}");
            }
        }).Start();
    }

    Console.ReadKey();
}
```


## 5. 线程池
### 5.1 线程池简介
* 系统中创建一个线程就会开辟一个至少 1M 的内存空间
* 线程还可能会占用部分寄存器
* 线程非常多的时候,OS需要花费大量的时间在不同的线程之间进行切换。

我们可以通过线程池对以上问题进行优化。线程池是一组已经创建好且处于唤醒状态的线程,随用随取,用完了不是销毁线程,然后放到线程池中,供其他人用。当需要创建大量线程时,我们推荐使用线程池技术。

系统同时处理的线程的个数与系统的硬件资源有关,线程数量与系统运行效率大概呈正态分布。在达到最高值之后,线程数量再增加 OS 将花费大量的时间和资源来切换线程,执行效率反而会下降。

### 5.2. 线程池特点
#### 5.2.1 线程池特点

* 线程池线程本身默认都是后台线程，不需要手动启动
* 线程池中的线程可以进行重用，线程使用完成后不会马上释放而是进入线程池等待重用
* 当程序中需要创建大量线程执行小数据量操作时，线程池可以大幅调高线程执行效率。
* 使用线程池操作线程的灵活性较差，我们无法获取线程池中的线程信息，所以无法干预线程池中的线程
* 虽然工作项进入线程池队列的时候保证了先进先出，但是各个工作线程获取工作项放到本地的队列后是使用的先进后出的方式，所以不能保证整体的请求项之间是请求处理的顺序。
* 线程池有最大线程数，最小线程数和默认线程数。`ThreadPool.GetMaxThreads()`获取线程池的最大线程数和当前线程池大小，线程池大小会根据CPU自动计算获得，不推荐手动修改。`ThreadPool.GetMinThreads()`，获取线程池最小线程数
* 线程池提高了线程的利用率，非常**适合工作任务非常小，而且又需要使用单独的线程来解决的问题**。

#### 5.2.2 手动创建线程与线程池对比

* 能用线程池的就用线程池，但线程池处理顺序不确定
* 线程池的优势在于线程执行大量小运算
* 要手动干预线程的话必须手动创建线程
* 要设置线程的优先级时，必须手动创建线程
* 线程执行时间较长是，两种方式差异不大

线程切换的代价主要损耗在需要将等待状态的线程激活为唤醒状态，而线程池中的线程都是唤醒状态，因此在一定程度上比手动线程更加高效。

#### 5.2.3 使用方式
```csharp
//有参
ThreadPool.QueueUserWorkItem((s) => Console.WriteLine(s),"Hello");

//参数
ThreadPool.QueueUserWorkItem(s => Console.WriteLine("Hello"));
```

## 6. UI资源跨线程调用

在`WinForm`或`WPF`程序中，默认只允许在创建控件的线程(一般为UI线程)中访问控件，如果想在其他线程中访问UI资源，需要做特殊处理。

### 6.1 WPF
`Window`类有一个`Dispatcher`对象，该对象是一个队列，用来保存应用程序主线程需要执行的任务。其他线程需要访问UI资源时只需要将操作加入到`Dispatcher`中，然后由主线程负责代为执行。

```csharp{10-14}
private void Button_Click(object sender, RoutedEventArgs e) =>
    new Thread(() => ChangeText()).Start();

private void ChangeText()
{
    Random rdm = new Random();
    string num = rdm.Next().ToString();
    
    //当前线程不是主线程
    if (Dispatcher.Thread != Thread.CurrentThread)
        Dispatcher.Invoke(new Action<string>(s => txt.Text = s), num);
    //当前线程是主线程
    else
        txt.Text = num;
}
```

### 6.2 WinForm
`WinForm`当中，我们有两种方式来解决UI资源跨线程访问的问题。

在`Form`构造函数中设置`CheckForIllegalCrossThreadCalls = false`，禁止窗体进行非法跨线程调用的校验，这只是屏蔽了非法校验，并没有真正解决问题，不推荐使用。

推荐使用以下方式：

```csharp{10-14}
private void button1_Click(object sender, EventArgs e)
{
    new Thread(() => ChangeText()).Start();
}
private void ChangeText()
{
    Random rdm = new Random();
    string num = rdm.Next().ToString();
    //当前线程是创建此控件的线程
    if (txt.InvokeRequired)
        txt.Invoke(new Action<string>(s => txt.Text = s), num);
    //当前线程不是创建此控件的线程
    else
        txt.Text = num;
}
```