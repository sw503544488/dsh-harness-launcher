# dsh-harness-launcher

> DeepSeek Harness 的桌面启动器插件：桌面图标点一下就开；没跑就**隐藏窗口**启动，在跑就直接打开界面；设置页里还能重启 / 关闭，侧栏图标可选。
>
> A DSH Web plugin that creates one desktop icon for DeepSeek Harness — it starts the Host **hidden** when it is stopped, reopens the running UI when it is not, and adds Restart / Close to the sidebar.

---

## 安装

```powershell
dsh plugin --profile web add github:sw503544488/dsh-harness-launcher
```

装完打开 **设置 → Harness 启动器** → **生成 / 更新桌面图标**，桌面就有 `DeepSeek Harness` 了。

## 它做什么

- **设置页入口**：**设置 → Harness 启动器**。状态、桌面图标生成、重启/关闭都在这一页。
- **可选侧栏图标**：面板里的「在左侧栏显示」开关。关掉后左侧栏不再占一个位置，功能和入口都还在设置里。
- **一个桌面图标**：`DeepSeek Harness.lnk`，双击时：
  1. 探测本机 Harness 是否在响应；
  2. 在跑 → 直接用**带认证令牌的地址**打开默认浏览器（不会起第二个进程）；
  3. 没跑 → 以隐藏窗口启动 `dsh --profile web --no-open`，等它就绪后再打开浏览器；
  4. 60 秒还没起来 → 弹窗报错并指出日志路径，而不是静默失败。
- **零黑窗**：图标指向 `wscript.exe <launcher.vbs>`，控制台窗口自始至终不出现。
- **重启 / 关闭**：第一次点击变成「再次点击确认…」，5 秒内不点就自动取消。
- **中英双语**，跟随界面语言。

## 为什么重启/关闭需要点两次

重启和关闭杀的就是**你正在看的这个进程**。执行后当前页面会立刻断线；重启由后台的独立 `wscript` 完成「杀 → 等端口释放 → 隐藏拉起 → 等就绪 → 自动开浏览器」，所以重启完成后你会看到一个重新打开的页面。

## 环境要求

| 条件 | 说明 |
|---|---|
| Windows | 依赖 `.lnk` + VBScript，`package.json` 已声明 `os: ["win32"]` |
| DeepSeek Harness | 已在 profile 里运行着 Web UI |
| `dsh` 在 PATH | 生成图标时用 `where dsh` 解析出绝对路径写进脚本，之后不依赖 PATH |
| 安装时需要 git + pnpm | 这是通过 GitHub 安装的前置条件，不是本插件的要求 |

## 安装方式

**方式一：命令行**

```powershell
dsh plugin --profile web add github:sw503544488/dsh-harness-launcher
```

**方式二：Web UI**

侧栏 **Plugins** 页 → 安装框粘贴同一个 spec → 安装：

```
github:sw503544488/dsh-harness-launcher
```

装好后打开 **设置 → Harness 启动器** → **生成 / 更新桌面图标** → 桌面出现 `DeepSeek Harness`。

想锁定版本可以带 tag：`github:sw503544488/dsh-harness-launcher#v0.2.0`。

卸载：

```powershell
dsh plugin --profile web remove dsh-harness-launcher
```

## 使用

| 位置 | 动作 |
|---|---|
| 桌面图标（双击） | 在跑就打开，没跑就隐藏启动后打开 |
| 设置 → Harness 启动器 | 状态、桌面图标、重启/关闭都在这一页 |
| 「在左侧栏显示」开关 | 关掉后左侧栏不再占位；再打开即恢复 |
| 设置 → 生成 / 更新桌面图标 | 写入 `%LOCALAPPDATA%\dsh-harness-launcher\` 并重建 `.lnk`（换端口或换用户目录后重跑一次） |
| 设置 → 在浏览器中打开 | 用当前进程的令牌地址打开 UI |
| 设置 → 重启 / 关闭 | 两击确认后由后台脚本执行 |

偏好保存在 `%LOCALAPPDATA%\dsh-harness-launcher\preferences.json`，重启后仍然有效。

日志：`%LOCALAPPDATA%\dsh-harness-launcher\launcher.log`（超过 256 KB 自动重写）。

## 工作原理

```
桌面 .lnk ──► wscript.exe ──► launcher.vbs open
                                     │
                     GET /plugins/harness-launcher/api/url
                                     │
                          200 + URL?  ──是──► 打开浏览器
                                     │
                                     否
                                     ▼
                  隐藏启动 dsh --profile web --no-open
                                     │
                          轮询直到 200 ──► 打开浏览器
```

- Host 半（`index.js`）注册 `/plugins/harness-launcher/api/*`：
  - `GET /url` — 纯文本，当前进程的**带令牌**地址（启动器的探针）；
  - `GET /status` — 面板状态的 JSON；
  - `POST /icon` `/open` `/restart` `/close`。
- 令牌由 Harness 每次启动重新生成，所以 URL 由 Host 现算现给，脚本里**不存**令牌。
- 启动脚本每次重建图标时重写，端口变了重跑一次即可。

### 安全边界

- 所有路由只接受 **loopback** 请求（`Host` 头必须是 `localhost` / `127.0.0.1` / `::1`）。
- 所有写操作必须带 `x-dsh-launcher` 自定义头；跨站页面发不了这个头（会触发预检，而本服务不应答 CORS），因此无法被别的网页驱动去关掉你的 Harness。
- `GET /url` 会暴露当前的启动令牌——这是本机任意进程本来就能拿到的信息（同机进程可以直接连端口），但它确实意味着**不要把端口暴露到局域网**。

## 卸载

1. 设置页里先点一次 **关闭**，或手动结束 `dsh` 进程；
2. `dsh plugin --profile web remove dsh-harness-launcher`；
3. 删除桌面上的 `DeepSeek Harness.lnk` 和 `%LOCALAPPDATA%\dsh-harness-launcher\`。

## 已知限制

- 仅 Windows。macOS / Linux 需要另写启动器。
- 同一端口只有一个实例；换了 `--port` 之后需要重新生成图标。
- 重启会中断当前页面上的连接（会话是持久化的，刷新后还在）。

## 开发

图标是构建期生成的，运行时没有依赖：

```powershell
node tools/make-icon.mjs    # 重写 icon.ico（16/24/32/48）
```

仓库里提交的是**可直接运行的 JS**，没有编译步骤——这样从 GitHub 安装时不需要任何构建环境。

## English summary

A DSH Web plugin that adds one sidebar entry and one desktop shortcut for DeepSeek Harness. Double-clicking the shortcut opens the authenticated UI when the Host is running, and otherwise starts `dsh --profile web --no-open` with no console window, waits for the port, then opens the browser. A Settings page (Settings → Harness launcher) can create/refresh the shortcut, open the UI, and restart or close the Host (both require a second click); its sidebar icon can be switched off so the global rail keeps its room. Windows only, MIT licensed.

```powershell
dsh plugin --profile web add github:sw503544488/dsh-harness-launcher
```

## License

MIT — see [LICENSE](LICENSE).
