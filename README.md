# 基金监控 - Android APK

## 本地构建（需要 JDK 17）

### 前提条件
1. 安装 **JDK 17**（推荐从 Adoptium 下载）
   - 下载地址: https://adoptium.net/temurin/releases/?version=17
   - 选择 Windows x64 MSI 安装包
   - 安装后确认 `java -version` 可用

2. 配置 Android SDK
   - 方式一：安装 Android Studio，打开 SDK Manager 下载 Android SDK 34
   - 方式二：使用命令行工具 `sdkmanager` 安装
   - 设置环境变量 `ANDROID_HOME`

### 构建步骤
```bash
cd android-build
build.bat
```
APK 生成于：`android/app/build/outputs/apk/debug/app-debug.apk`

## 云端构建（GitHub Actions，推荐）

1. 将 `android-build/` 上传到 GitHub 仓库
2. 进入仓库 Actions 页面
3. 选择 "Build Android APK" workflow
4. 点击 "Run workflow"
5. 等待几分钟，下载生成的 APK

## 在线转换（无需 Java）

访问 https://www.pwabuilder.com 上传 PWA 的 URL 即可生成 APK。

## 技术说明

- 使用 Capacitor 6 将 Web 应用包装为原生 Android WebView
- 所有基金 API 直连东方财富/天天基金（WebView 无 CORS 限制）
- 支持离线 localStorage 存储持仓数据
- 默认 15 秒自动刷新

## 网络权限

App 需要连接以下域名获取数据：
- `push2.eastmoney.com` - 大盘指数
- `fundgz.1234567.com.cn` - 基金实时估值
- `fund.eastmoney.com` - 基金搜索

## 文件结构
```
android-build/
├── www/                    # Web 资源（可直接部署为 PWA）
│   ├── index.html
│   ├── styles.css
│   ├── renderer-browser.js
│   ├── manifest.json
│   └── icon.svg
├── android/                # Android 原生项目
│   └── ...
├── capacitor.config.json   # Capacitor 配置
├── package.json            # 依赖
├── build.bat               # 本地构建脚本
└── .github/workflows/      # GitHub Actions 自动化构建
