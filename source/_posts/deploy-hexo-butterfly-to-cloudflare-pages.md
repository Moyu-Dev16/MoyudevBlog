---
title: 从零搭建 Hexo 博客，并部署到 Cloudflare Pages
date: 2026-05-22 05:50:00
categories:
  - 技术
tags:
  - Hexo
  - Butterfly
  - Cloudflare Pages
  - 博客部署
  - GitHub
---

这篇文章记录一下我是怎么从零搭建 Hexo 博客、换上 Butterfly 主题，并最终把它托管到 Cloudflare Pages 的。

中间其实没有什么特别玄学的东西，但有几个地方很容易点错，比如 Cloudflare 现在会把 Workers 和 Pages 放在同一个入口里，如果误进了 Workers 流程，就会看到 `wrangler deploy`、`API token` 这些对纯静态博客来说不该出现的配置。

所以这篇就按真实流程写一遍，也顺便记录一些我觉得比较舒服的 Hexo 用法。

<!-- more -->

## 准备环境

本地需要先准备好 Node.js 和 Git。

Windows 下可以在 PowerShell 里检查：

```powershell
node -v
npm -v
git --version
```

我这里用的是 Node.js 22：

```text
v22.12.0
```

如果 PowerShell 提示不能运行 `npm.ps1` 或 `npx.ps1`，一般是执行策略限制。临时规避的话，可以在脚本里显式使用：

```powershell
npx.cmd
npm.cmd
```

这样 Windows 批处理里会稳一点。

## 初始化 Hexo 项目

先全局安装 Hexo CLI：

```powershell
npm install -g hexo-cli
```

然后初始化项目：

```powershell
hexo init MoyudevBlog
cd MoyudevBlog
npm install
```

如果已经在目标目录里，也可以：

```powershell
hexo init .
npm install
```

第一次生成静态文件：

```powershell
hexo clean
hexo generate
```

启动本地预览：

```powershell
hexo server
```

默认访问地址是：

```text
http://localhost:4000/
```

常用命令也可以简写：

```powershell
hexo g
hexo s
```

## 安装 Butterfly 主题

我用的是 npm 方式安装 Butterfly，这样主题会进 `node_modules`，不用把主题源码塞进 `themes` 目录里。

```powershell
npm install hexo-theme-butterfly --save
npm install hexo-renderer-pug hexo-renderer-stylus --save
```

然后修改根目录的 `_config.yml`：

```yaml
theme: butterfly
```

再新建 `_config.butterfly.yml`，用来单独管理 Butterfly 主题配置。比如最基础可以这样：

```yaml
menu:
  首页: / || fas fa-home
  归档: /archives/ || fas fa-archive
  标签: /tags/ || fas fa-tags
  分类: /categories/ || fas fa-folder-open
  关于: /about/ || fas fa-heart

avatar:
  img: /img/avatar.jpg
  effect: false

social:
  fab fa-github: https://github.com/Moyu-Dev16 || Github

aside:
  enable: true
  card_author:
    enable: true
    description: 技术、与日常折腾
    button:
      enable: true
      icon: fab fa-github
      text: Github
      link: https://github.com/Moyu-Dev16
  card_announcement:
    enable: true
    content: 记录技术实践、开发踩坑和一些认真生活的片段。

inject:
  head:
    # 后续统计、广告、站点验证代码可以放这里
  bottom:
    # 后续 JS 统计或广告代码可以放这里
```

这里有一个小细节：如果菜单里有 `标签`、`分类`、`关于`，不代表 Hexo 会自动生成这些页面。需要手动创建：

```powershell
hexo new page tags
hexo new page categories
hexo new page about
```

然后分别修改页面 front matter。

`source/tags/index.md`：

```yaml
---
title: 标签
type: tags
comments: false
---
```

`source/categories/index.md`：

```yaml
---
title: 分类
type: categories
comments: false
---
```

`source/about/index.md`：

```yaml
---
title: 关于
comments: false
---

这里写一点关于自己的介绍。
```

再跑一次：

```powershell
hexo clean
hexo generate
```

如果日志里出现：

```text
Generated: tags/index.html
Generated: categories/index.html
Generated: about/index.html
```

说明这些页面已经正常生成了。

## 整理 Git 忽略规则

Hexo 项目不要把 `node_modules` 和 `public` 提交上去。

一个够用的 `.gitignore` 可以这样写：

```gitignore
.DS_Store
Thumbs.db
db.json
*.log
node_modules/
public/
tempbook/
推送笔记.bat
.deploy*/
_multiconfig.yml
```

我额外建了一个 `tempbook/` 目录，用来放临时笔记和临时素材。这里面的东西不进 Git。

但是如果某个素材真的要用到博客里，比如头像、文章配图，就要从 `tempbook` 复制到正式目录：

```text
source/img/avatar.jpg
source/img/文章资源目录/
```

因为 Cloudflare 只能构建 Git 仓库里的内容，被忽略的临时文件不会上线。

## 推到 GitHub

初始化 Git：

```powershell
git init
git add .
git commit -m "init hexo blog"
git branch -M main
```

关联远程仓库：

```powershell
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

之后每次更新文章，本质上都是：

```powershell
git add .
git commit -m "update blog"
git push origin main
```

## 部署到 Cloudflare Pages

Cloudflare 控制台现在入口叫 `Workers & Pages`，这一点容易让人迷路。

正确路径是：

```text
Workers & Pages
-> Create application
-> Pages
-> Connect to Git
```

如果你看到的是：

```text
Deploy command
npx wrangler deploy
npx wrangler versions upload
API token
```

那基本就是进了 Workers 流程，不是 Pages 静态站流程。

有些页面底部会有一句：

```text
Looking to deploy Pages? Get started
```

这时候要点 `Get started`，才能进入 Pages 的配置。

选中 GitHub 仓库后，构建配置这样填：

```text
Framework preset:
None
```

如果列表里没有 Hexo，选 `None` 就行，不影响。

继续填写：

```text
Build command:
npm run build

Build output directory:
public

Root directory:
留空
```

为什么是 `npm run build`？

因为 `package.json` 里有：

```json
{
  "scripts": {
    "build": "hexo generate"
  }
}
```

Cloudflare 会先安装依赖，再执行 `npm run build`，最后把 `public` 目录发布出去。

环境变量建议加一个：

```text
NODE_VERSION = 22.12.0
```

这样 Cloudflare 的 Node 版本和本地一致，减少奇怪的构建差异。

## 后续更新要不要再去 Cloudflare？

不用。

只要 Cloudflare Pages 绑定了 GitHub 仓库，之后每次推送到 `main` 分支，它都会自动重新构建和部署。

也就是说，日常更新流程是：

```text
写文章
本地构建检查
提交 Git
推送 GitHub
Cloudflare 自动部署
```

正常情况下不需要再去 Cloudflare 控制台点任何东西。

只有这些情况才需要回去看 Cloudflare：

```text
第一次创建项目
修改构建命令
绑定自定义域名
设置环境变量
查看部署失败日志
删除或重建项目
```

## 写文章的舒服姿势

Hexo 的文章都放在：

```text
source/_posts/
```

可以用命令创建：

```powershell
hexo new "文章标题"
```

也可以直接手动新建 Markdown 文件。

我更喜欢手动新建，因为文件名可以写得更清楚，比如：

```text
source/_posts/deploy-hexo-butterfly-to-cloudflare-pages.md
```

文章开头写 front matter：

```yaml
---
title: 从零搭建 Hexo 博客，并部署到 Cloudflare Pages
date: 2026-05-22 05:50:00
categories:
  - 技术
tags:
  - Hexo
  - Butterfly
  - Cloudflare Pages
---
```

如果文章比较长，可以在正文前半部分加：

```md
<!-- more -->
```

这样首页只展示摘要，不会把整篇文章全部铺出来。

## 临时笔记和正式文章分开

我现在会把临时记录放在：

```text
tempbook/
```

比如一些还没整理的想法、截图、草稿，都先放这里。等确定要发到博客，再整理成正式文章，复制到：

```text
source/_posts/
```

图片则复制到：

```text
source/img/
```

这样做的好处是，临时资料不会污染 Git 仓库，真正上线的内容也比较干净。

## Windows 一键推送脚本

如果不想每次手打命令，可以在根目录放一个本地脚本，比如：

```text
推送笔记.bat
```

内容类似：

```bat
@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo [1/5] 清理 Hexo 缓存...
call npx.cmd hexo clean
if errorlevel 1 goto error

echo [2/5] 生成静态文件...
call npx.cmd hexo generate
if errorlevel 1 goto error

echo [3/5] 准备 Git 提交...
git status --short

set "COMMIT_MSG="
set /p COMMIT_MSG=请输入提交信息，直接回车则使用默认信息: 
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=update blog"

git add -A
git diff --cached --quiet
if errorlevel 1 (
  echo [4/5] 提交本地变更...
  git commit -m "%COMMIT_MSG%"
  if errorlevel 1 goto error
) else (
  echo [4/5] 没有需要提交的变更，跳过 commit。
)

echo [5/5] 推送到 GitHub，Cloudflare Pages 将自动构建...
git push origin main
if errorlevel 1 goto error

echo.
echo 完成。
pause
exit /b 0

:error
echo.
echo 失败了，请查看上方错误信息。
pause
exit /b 1
```

这个脚本我会放进 `.gitignore`，只留在本地用，不提交到仓库。

## 最后

Hexo + Butterfly + Cloudflare Pages 这套组合很适合个人博客。

Hexo 负责写作和生成静态页面，Butterfly 负责主题和阅读体验，GitHub 负责托管源码，Cloudflare Pages 负责自动构建和全球访问。

搭好之后，真正的工作流就会变得很简单：

```text
写 Markdown
推送 GitHub
Cloudflare 自动上线
```

博客最重要的不是一开始多完美，而是能不能持续写下去。先把流程打通，再慢慢把主题、分类、图片、文章结构一点点整理好，就已经很够用了。

## 参考

- [Hexo Setup](https://hexo.io/docs/setup.html)
- [Hexo Commands](https://hexo.io/docs/commands)
- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare Pages Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
