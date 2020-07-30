# 多线程

## 1. 进程
进程(Process)是操作系统中的一个基本概念，它包含着一个运行程序所需要的资源。进程之间是相对独立的，一个进程无法直接访问另 一个进程的数据（除非利用分布式计算方式），一个进程运行的失败也不会影响其他进程的运行，操作系统就是利用进程把工作划分为多个独立的区域的。进程可以理解为一个程序的基本边界。

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
线程(Thread)是任务调度的最小单位。一个线程是一个进程里面的代码执行流，每个线程都有自己的专有寄存器(栈指针、程序计数器等)，但代码区是共享的。

* 多线程可以让一个程序“同时”处理多个事情。后台运行程序，提高程序的运行效率，同时解决耗时操作时GUI出现无响应的情况。
* 一个进程的多个线程之间可以共享程序代码。每个线程会将共享的代码分别拷贝一份去执行，每个线程是单独执行的。
* 线程有前台线程和后台线程，创建一个线程默认为前台线程。
* 只有所有的前台线程都关闭时程序才能退出。只要所有前台线程都关闭后台线程自动关闭。
* 线程被释放时，线程中定义的内容都会自动被释放

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

## 3. 应用程序域
应用程序域(App Domain)提供安全而通用的处理单元，公共语言运行库可使用它来提供应用程序之间的隔离。我们可以单个进程中运行几个应用程序域，而不会造成进程间调用或进程间切换等方面的额外开销。在一个进程内运行多个应用程序的能力显著增强了服务器的可伸缩性。

应用程序域允许我们在一个应用程序中出现的错误不会影响其他应用程序。能够在不停止整个进程的情况下停止单个应用程序。应用程序域形成了托管代码的隔离、卸载和安全边界。

![进程线程和应用程序域的关系](https://i.loli.net/2020/02/26/OPNaQuS3lg7GKWe.jpg)

## 4. 线程同步

### 4.1 线程同步
当一个方法同时被多个线程调用并修改同一变量时就可能存在脏数据的问题，我们称之为“多线程方法重入”。我们可以通过以下方式来解决此问题。

#### 4.1.1 Join

`Join()`方法可以让当前线程等待指定线程执行结束后再**接着**运行当前线程。

```csharp
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

#### 4.1.2 MethodImplAttribute
在线程不安全的方法上打上`[MethodImpl(MethodImplOptions.Synchronized)]`标记后，此方法同时只能被一个线程调用，变成了同步方法。

```csharp
[MethodImpl(MethodImplOptions.Synchronized)]
public void Count()
{
    // do something ...
}
```

#### 4.1.3 对象互斥锁
```csharp
var locker = new object();
public void Count()
{
    lock (locker)
    {
        // do something ...
    }
}
```
同一时刻只能有一个线程进入同一个对象的 lock 代码块。必须是同一个对象才能起到 互斥的作用。lock 后必须是引用类型,不一定是 object,只要是对象就行。

锁对象选择很重要,选不对起不到同步的作用和可能会造成其他地方被锁,比如用字符串做锁(因为字符串拘留池导致可能用的是其他地方也在用的锁)。

*lock是对`Monitor`类的简化调用，此处我们就不在讲Monitor的相关使用了。*

#### 4.1.4 多线程版单例模式
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

### 4.2 生产者消费者模式
多个线程同时修改共享数据可能会发生错误，此时我们常用生产者消费者模式来处理此问题。

在生成者和消费者关系中，生产者线程负责产生数据，并把数据存到公共数据区，消费者线程使用数据，从公共数据去中取出数据。我们使用资源加锁的方式来解决线程并发引起的方法重入问题。

```csharp
class Program
{
    static void Main(string[] args)
    {
        List<Product> list = new List<Product>();//创建产品池
        //创建5个生产者
        for (int i = 0; i < 5; i++)
        {
            new Thread(() =>
            {
                while (true)
                    lock (list)//锁定对象解决线程并发引起的方法重入问题
                    {
                        //生产一个产品
                        list.Add(new Product());
                        Console.WriteLine("生产产品{0}", list.Count - 1);
                        Thread.Sleep(500);
                    }
            }) { IsBackground = true }.Start();
        }

        //创建10个消费者
        for (int i = 0; i < 10; i++)
        {
            new Thread(() =>
            {
                while (true)
                    lock (list)
                    {
                        if (list.Count > 0)
                        {
                            //消费一个产品
                            list.RemoveAt(list.Count - 1);
                            Console.WriteLine("消费产品{0}", list.Count);
                            Thread.Sleep(200);
                        }
                    }
            }) { IsBackground = true }.Start();
        }
        Console.ReadKey();
    }
}
class Product {}
```

### 4.3 WaitHandle
除了前面提到的“锁”机制外，.NET中WaitHandle还提供了一些线程间协同的方法，使得线程可以通过“信号”进行通讯。

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

#### 4.3.1 ManualResetEvent
`ManualResetEvent`被比喻为手动门，一旦开门后就保持开门状态，除非手动关门，如同“城门”。

```csharp
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

#### 4.3.2 AutoResetEvent
`AutoResetEvent`被比喻为自动门，一次开门完成后自动关门，如同“地铁的闸机口”。

```csharp
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

WaitHandle现在.NET中较少使用了，但它们更多作为简单易用的多线程语法的底层实现。

## 5. 线程池
### 5.1 线程池简介
* 系统中创建一个线程就会开辟一个至少 1M 的内存空间
* 线程还可能会占用部分寄存器
* 线程非常多的时候,OS需要花费大量的时间在不同的线程之间进行切换。

我们可以通过线程池对以上问题进行优化。线程池是一组已经创建好的线程,随用随取,用完了不是销毁线程,然后放到线程池中,供其他人用。当需要创建大量线程时,我们推荐使用线程池技术。

系统同时处理的线程的个数与系统的硬件资源有关,线程数量与系统运行效率大概呈正态分布。在达到最高值之后,线程数量再增加 OS 将花费大量的时间和资源来切换线程,执行效率反而会下降。

### 5.2. 线程池特点
#### 5.2.1 线程池特点

* 线程池线程本身默认都是后台线程，不需要手动启动
* 线程池中的线程可以进行重用，线程使用完成后不会马上释放而是进入线程池等待重用
* 当程序中需要创建大量线程执行小数据量操作时，线程池可以大幅调高线程执行效率。
* 使用线程池操作线程的灵活性较差，我们无法获取线程池中的线程信息，所以无法干预线程池中的线程
* 虽然工作项进入线程池队列的时候保证了先进先出，但是各个工作线程获取工作项放到本地的队列后是使用的先进后出的方式，所以不能保证整体的请求项之间是请求处理的顺序。
* 线程池有最大线程数，最小线程数和默认线程数。ThreadPool.GetMaxThreads()获取线程池的最大线程数和当前线程池大小，线程池大小会根据CPU自动计算获得，不推荐手动修改。ThreadPool.GetMinThreads()，获取线程池最小线程数
* 线程池提高了线程的利用率，非常**适合工作任务非常小，而且又需要使用单独的线程来解决的问题**。

#### 5.2.2 手动创建线程与线程池对比

* 能用线程池的就用线程池，但线程池处理顺序不确定
* 线程池的优势在于线程执行大量小运算
* 要手动干预线程的话必须手动创建线程
* 要设置线程的优先级时，必须手动创建线程
* 线程执行时间较长是，两种方式差异不大

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

```csharp
private void Button_Click(object sender, RoutedEventArgs e)
{
    new Thread(() => ChangeText()).Start();
}

private void ChangeText()
{
    Random rdm = new Random();
    string num = rdm.Next().ToString();
    
    //当前线程不是主线程
    if (Dispatcher.Thread != Thread.CurrentThread)
    {
        Dispatcher.Invoke(new Action<string>(s => txt.Text = s), num);
    }
    //当前线程是主线程
    else
        txt.Text = num;
}
```

### 6.2 WinForm
`WinForm`当中，我们有两种方式来解决UI资源跨线程访问的问题。

在`Form`构造函数中设置`CheckForIllegalCrossThreadCalls = false`，禁止窗体进行非法跨线程调用的校验，这只是屏蔽了非法校验，并没有真正解决问题，不推荐使用。

推荐使用以下方式：

```csharp
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