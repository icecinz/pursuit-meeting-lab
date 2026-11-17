# 追及与相遇 · 直线运动实验室

**当前版本：1.1**

高中物理互动演示，用动画和图像观察两个物体在直线运动中的追及与相遇。页面署名仍是「高一物理组」。

## 使用

- 当前主要下载是 Windows 10/11 64 位单文件 [`downloads/追及与相遇演示.exe`](downloads/追及与相遇演示.exe)。双击后即可使用，不必另带网页，也不必解压。程序把页面写到当前账户的 `%LOCALAPPDATA%\ZhuiJiYuXiangYu\motion.html`，再用系统里用于打开 HTTPS 的浏览器显示。不申请管理员权限。
- 也可以用浏览器直接打开 [`downloads/追及与相遇演示.html`](downloads/追及与相遇演示.html)，或仓库根目录的同名文件。单文件网页不需要联网。
- 1.1 不再提供新的 Mac 程序包。1.0 的 Mac 包和当时的 Windows 压缩包只留在 [v1.0 Release](https://github.com/icecinz/pursuit-meeting-lab/releases/tag/v1.0)，不是当前版本。
- 从「典例」「更多情境」或「自由设置」进入。典例中的对比演示和单项例子使用固定参数，参数区不显示。更多情境和自由设置仍可调整参数。

## 1.1 相对 1.0

以下各项按当前源码核对，不是另行设计的功能：

- 典例改为固定参数。`app.js` 的 `typicalCases` 覆盖对应预设的初速度、加速度和初始间距；典例模式下 `#parameter-section` 隐藏。
- 新增三组对比演示，同一时间轴一起播放。`comparison.js` 里是「初速度小追初速度大的」（四组）、「减速追匀速的三种结果」和「相向减速的临界情况」。
- 「相向减速的临界情况」只比较停车前相遇、恰好停下时相遇、停下仍未相遇。两车减速相向的另外两类临界比较没有加入。单项「两车减速相向」仍是双方停下仍未相遇。
- 宽屏规则在 `teaching.css`：视口宽度不少于 1280px 时，单项演示把运动画面和读数左右并排，图表使用剩余高度。源码没有把 16:8 写成固定分辨率；约 16:8 的横屏窗口会用到这套规则。右栏由 1.0 的 355px，以及课堂样式里 `clamp(350px, 26vw, 500px)`，改为 `clamp(288px, 18vw, 336px)` 再乘当前显示比例。顶栏「小／中／大」放在设置按钮左边，三档一起调整文字、图像和间距。读数按该次运动可能出现的位数预留等宽位置。
- 默认展示时间仍是五秒。比较演示的关键时刻由 `node tests/comparisons.cjs` 核对。

Windows 单文件的文件版本、产品版本和清单版本是 1.1.0.0。文件没有商业代码签名，Windows 可能出现系统提示。

已在构建环境核对单文件网页、比较脚本，以及 EXE 的 PE 结构、版本资源和内嵌页面。尚未在 Windows 电脑或希沃设备上实机双击验收。Linux 上的编译和测试不能代替这次验收。

许可证尚未指定。

## 文件与构建

`index.html`、CSS 和 JavaScript 是可编辑源码。修改后在本目录运行：

```sh
python3 build.py
```

脚本生成 `dist/index.html` 和 `追及与相遇演示.html`，两份内容相同。

Windows 单文件需要 Python 3 和 [Zig 0.15.2](https://ziglang.org/download/) 或更新版本：

```sh
python3 windows/build_windows.py --zig /path/to/zig
```

说明见 `windows/README.md`。`downloads/` 里的 EXE 和 HTML 是这次构建并核对过的文件，校验和在 `downloads/SHA256SUMS`。准备粘贴的 Release 说明在 `downloads/发布说明-1.1.md`。
