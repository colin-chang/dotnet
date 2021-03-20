# 文件提供程序

.Net Core为我们封装了一套文件操作接口，方便我们进行文件操作同时屏蔽底层文件操作实现细节，当然开发者也可以通过自定义实现接口来封装自己的文件提供程序。
## 1. 核心类型
.Net Core文件提供程序主要最常用的三个核心类型(`Microsoft.Extensions.FileProviders.Abstractions`)如下，其作用如字面含义，不作赘述。

* `IFileProvider`
* `IDirectoryContents`
* `IFileInfo`

```csharp
  public interface IFileProvider
  {
    /// <summary>获取指定文件信息.</summary>
    /// <param name="subpath">文件相对路径.</param>
    /// <returns>文件信息</returns>
    IFileInfo GetFileInfo(string subpath);

    /// <summary>枚举指定目录内容.</summary>
    /// <param name="subpath">目录相对路径.</param>
    /// <returns>目录内容.</returns>
    IDirectoryContents GetDirectoryContents(string subpath);
  }
```

.Net Core内置实现了以下三个文件提供程序，分别用于实现物理文件操作，应用程序内嵌文件操作和组合文件操作。组合文件操作用于处理多种文件源。
* `PhysicalFileProvider`(`Microsoft.Extensions.FileProviders.Physical`)
* `EmbeddedFileProvider`(`Microsoft.Extensions.FileProviders.Embedded`)
* `CompositeFileProvider`(`Microsoft.Extensions.FileProviders.Composite`)

## 2. 读取文件
```csharp
static async Task Main(string[] args)
{
    //物理文件提供程序
    var provider = new PhysicalFileProvider(AppDomain.CurrentDomain.BaseDirectory);
    //获取根目录内容
    var contents = provider.GetDirectoryContents("/");
    foreach (var file in contents)
    {
        //获取文件名
        if (Path.GetExtension(file.Name) != ".json")
            continue;

        //读取文件内容
        await using var stream = file.CreateReadStream();
        using var reader = new StreamReader(stream, Encoding.Default);
        Console.WriteLine(await reader.ReadToEndAsync());
        break;
    }
}
```

当项目中文件`BuildAction`设置为`EmbeddedResource`时则可以使用`EmbeddedFileProvider`来进行文件操作。嵌入式文件项目文件内容形如：
```xml
<ItemGroup>
    <EmbeddedResource Include="test.txt" />
</ItemGroup>
```

组合文件提供程序可以将多个文件提供程序组合在一起如同一个目录一样进行文件操作。
```csharp
//物理文件提供程序
var provider1 = new PhysicalFileProvider(AppDomain.CurrentDomain.BaseDirectory);
//嵌入式文件提供程序
var provider2 = new EmbeddedFileProvider(Assembly.GetExecutingAssembly());
//组合文件提供程序
var provider = new CompositeFileProvider(provider1, provider2);

//获取组合根目录(物理和嵌入式两者根目录)内容
var contents = provider.GetDirectoryContents("/");
```

## 3. 自定义文件提供程序
除了使用系统默认提供的三种文件提供程序，我们也可以通过实现`IFileProvider`来自定义文件提供程序。比如自定义实现阿里云OSS文件提供程序可以将读取OSS文件操作变为如同读取本地目录一样简单，而文件提供程序使用者则无需关注其具体实现，只需注入对应文件提供程序对象即可实现读取任意位置文件。