# Windows 单文件交付

本项目的桌面版以后只交付 Windows 单文件 `追及与相遇演示.exe`。不再构建 Mac 版，不以 ZIP 作为用户交付物，也不要求用户携带旁边的 HTML 文件。保留网页和启动器源码，方便后续更新。

对外只放一份当前 EXE。换版本时把上一份另行留存，不要和当前文件放在同一位置一起使用。

## 使用方式

用户双击一个 EXE 即可启动，无需安装。本程序不申请管理员权限，不修改系统文件或浏览器设置。

演示页面完整嵌入 EXE。启动器把内容写入当前账户的 `%LOCALAPPDATA%\ZhuiJiYuXiangYu\motion.html`，再通过系统默认的 HTTPS 网页浏览器打开，不使用可能被编辑器接管的 `.html` 文件关联。默认浏览器无法启动时尝试 Microsoft Edge；两者均不可用时会显示说明。

Edge、Chrome、Chromium、Brave 使用简洁应用窗口并请求最大化；其他浏览器使用普通网页窗口。窗口行为最终由浏览器决定。打开页面后启动器即退出，没有后台服务或本地端口。

缓存地址固定，新版内容先完整写入临时文件，再替换原缓存；已有内容一致时不重复写入。显示大小等页面偏好仍由同一浏览器的本地存储保存。页面和启动器不访问外网，运行时需要已安装的现代浏览器。

新旧 EXE 共用该缓存地址；若同时运行不同版本，最后写入缓存的内容生效，已打开窗口重新载入时也会读取该内容。因此同时只使用一份当前 EXE。

目标平台为 Windows 10/11 x86-64。EXE 依赖 Windows 自带系统库，不需要 .NET、Python、Zig 或额外安装的 Visual C++ 运行库。文件目前没有商业代码签名，Windows 的安全提示取决于下载来源、设备策略和文件信誉，不能保证完全不出现系统提示。

## 构建

构建机器需要 Python 3 与官方 [Zig 0.15.2](https://ziglang.org/download/) 工具链。Zig 提供交叉编译器、Windows 头文件和系统导入库；脚本直接生成标准 Windows 资源文件，不依赖本机 SDK 或资源编译器。工具链不打进最终 EXE，不自动下载到仓库。

在项目目录执行：

```text
python3 windows/build_windows.py --zig /absolute/path/to/zig
```

脚本先运行项目 `build.py`，再把最新的 `dist/index.html` 作为 RCDATA 资源嵌入 Windows GUI 启动器。默认生成 `windows/dist/追及与相遇演示.exe`（此目录不纳入源码版本）；也可用 `--output` 指定交付前的临时输出位置。

校验已有 EXE：

```text
python3 windows/build_windows.py --verify-only /absolute/path/to/追及与相遇演示.exe
```

## 验证范围

构建脚本会验证 Windows x86-64 PE32+ 格式、GUI 子系统、完整内嵌 HTML 与当前页面字节一致、内嵌 `asInvoker` 普通用户权限清单，以及文件版本、产品版本、版本字符串和清单版本均为 1.1.0.0。页面的浏览器功能测试另外进行。

这些检查可以在没有 Windows 的机器上完成。静态结构和页面测试通过并不等于已在真实 Windows／希沃设备上双击验收；Linux 上的编译和测试也不能代替。实际首次打开、安全提示、默认浏览器识别和应用窗口最大化仍须在目标设备上确认。
