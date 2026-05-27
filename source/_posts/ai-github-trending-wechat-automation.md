---
title: 用 AI 自动整理 GitHub 热榜，并推送到微信公众号草稿箱
date: 2026-05-28 02:00:00
categories:
  - AI 自动化
tags:
  - AI
  - GitHub
  - 微信公众号
  - 自动化
  - Codex
cover: /img/ai-github-trending-wechat/github-trending-wechat-cover.png
---

![GitHub 热榜公众号自动化](/img/ai-github-trending-wechat/github-trending-wechat-cover.png)

最近折腾了一套小工作流：让 AI 自动抓取 GitHub 最近一周涨星比较快的开源项目，整理成适合微信公众号阅读的文章，再推送到公众号草稿箱。

这套流程目前还在继续完善，源码和文档还没到可以直接丢出来的程度。等后面稳定一点，我会整理到 Git 仓库里。这里先把整体思路记录下来，算是阶段性复盘。

<!-- more -->

## 为什么要做这个

GitHub Trending 很适合当技术雷达。

但如果每周都手动整理一遍，其实挺麻烦。大概流程是这样：

```text
打开 GitHub Trending
筛选 weekly
记录项目名、star 增长、语言、协议
打开项目 README
判断适用人群和项目价值
写成公众号文章
调整排版
做封面图
上传图片
复制到公众号后台
预览，再发布
```

这些步骤里，真正值得花时间的是判断项目有没有价值，以及怎么把它解释给读者听。

至于抓数据、补字段、整理格式、上传草稿这些重复动作，更适合交给脚本和 AI。

我想要的效果很简单：以后只要说一句：

```text
生成本周 GitHub 涨星榜公众号草稿
```

后面的事情就自动跑完。

## 想达到的效果

理想状态下，这条工作流需要自动完成这些事：

1. 抓取 GitHub Weekly Trending。
2. 补充 GitHub API 里的元数据。
3. 生成网页预览版。
4. 生成微信公众号兼容的 HTML。
5. 准备封面图。
6. 上传正文图片和封面图到微信。
7. 创建微信公众号草稿。
8. 返回草稿 `media_id`。

如果想让封面更好看，也可以让 AI 先生成提示词，再去 Gemini 这类工具里生成图片。

这个流程不是为了“完全自动发文章”，而是为了把麻烦的步骤提前处理好，最后还是由人来预览和决定要不要发布。

## 整体流程

整个链路可以拆成五层：

```text
GitHub Trending
      ↓
数据抓取与清洗
      ↓
AI 辅助内容整理
      ↓
静态网页 / 公众号 HTML 生成
      ↓
微信公众号草稿箱 API
```

再展开一点，大概是：

```text
1. 抓取 GitHub Trending weekly 页面
2. 解析项目列表和 stars this week
3. 调 GitHub REST API 补充 stars、forks、language、license
4. 按周新增 stars 排序
5. 生成项目点评：
   - 大概用法
   - 适用人群
   - 开源协议宽松程度
   - 项目价值
6. 生成三份产物：
   - public/index.html
   - public/index-dashboard.html
   - articles/wechat-article-inline.html
7. 处理封面图
8. 上传正文图片到微信
9. 上传封面图到微信永久素材
10. 调用草稿箱接口创建草稿
```

这里面最关键的是分清楚：哪些事情需要判断，哪些事情只是稳定执行。

AI 更适合做理解、总结、改写；脚本更适合做抓取、上传、校验和接口调用。

## 为什么要生成三份 HTML

这里主要是因为公众号编辑器比较特殊。

普通网页里可以随便写 CSS、JS、布局，怎么舒服怎么来。但微信公众号编辑器和图文 API 会过滤很多东西，尤其是外部 CSS、复杂布局和脚本。

所以我把最终产物拆成了三个版本。

### 网页预览版

路径类似：

```text
public/index.html
```

这个版本主要给自己看，样式可以自由一点，适合本地预览，也方便以后部署成静态页面。

### 数据看板版

路径类似：

```text
public/index-dashboard.html
```

这个版本更像一个快速扫榜的表格或看板。项目数量多的时候，看板比长文章更适合快速筛选。

### 公众号内联样式版

路径类似：

```text
articles/wechat-article-inline.html
```

这个版本才是真正要推到公众号草稿箱里的正文。

它需要遵守几个限制：

```text
不用 JavaScript
不依赖外部 CSS
尽量使用内联 style
布局保持简单
少用复杂 grid / flex
正文图片先上传到微信，再替换成微信图片 URL
```

公众号排版最麻烦的地方就在这里：你本地看着正常，不代表丢进公众号后还正常。

## 微信公众号 API

公众号这边主要用到几个接口：

```text
获取 access_token
上传图文内图片
上传封面图为永久素材
新增草稿
可选：发布草稿
```

实际跑下来，草稿接口最实用。

直接发布接口不一定有权限。我测试时，草稿创建是正常的，但发布接口返回过：

```text
48001 api unauthorized
```

这说明当前公众号没有开放发布接口权限。

不过这反而让我觉得流程更安全：自动化负责把草稿准备好，人最后再进后台预览、检查、发布。

公众号文章毕竟是发给读者看的，最后一步还是留给人判断比较稳。

## 环境变量

敏感信息统一放在 `.env` 里：

```env
WECHAT_APP_ID=你的公众号AppID
WECHAT_APP_SECRET=你的公众号AppSecret
WECHAT_AUTHOR=作者名
WECHAT_COVER_PATH=assets/cover.png
WECHAT_ARTICLE_PATH=articles/wechat-article-inline.html
```

仓库里只提交 `.env.example`，不提交真实 `.env`。

`.gitignore` 里至少要有：

```gitignore
.env
.env.*
!.env.example
.cache/
```

还有一个小坑：`.env` 最好确认是 UTF-8 编码。

如果标题、摘要里出现类似 `杩欎竴...` 或者一堆问号，先别急着怀疑微信 API，大概率是本地环境变量文件编码坏了。

## AI 和脚本怎么分工

这套流程里，我不想让 AI 完全自由发挥。

比较舒服的方式是：让它做适合它的部分。

比如这些交给 AI：

```text
根据 README 和项目描述概括适用人群
判断项目价值
把技术信息改写成适合公众号阅读的文字
生成封面图提示词
检查 HTML 在移动端是否好读
把流程沉淀成可复用的说明和技能
```

而确定性强、需要稳定执行的部分交给脚本：

```text
抓取数据
调用 GitHub API
上传图片
调用微信草稿接口
检查 .env 是否缺字段
检查敏感信息有没有被提交进 Git
```

这个分工挺重要。

AI 负责理解和表达，脚本负责稳定执行。两边边界清楚，整套流程才不会飘。

## 封装成 Codex Skill

这次我把流程封装成了一个 Codex Skill，名字叫：

```text
github-trending-wechat
```

Skill 里记录了完整流程：

```text
什么时候触发
如何抓取 GitHub Trending
如何生成公众号文章
如何处理封面图
如何调用微信草稿 API
哪些东西不能提交
常见错误怎么处理
```

这样下次就不用从头解释需求。

我只要说：

```text
用 github-trending-wechat 技能，生成本周涨星榜公众号草稿。
```

它就能按固定流程继续往下走。

这也是我觉得 AI 工具真正好用的地方：不是每次都重新聊天，而是把有效流程沉淀下来。

## 一键调用

项目里目前核心是两个脚本：

```text
scripts/generate-weekly-article.mjs
scripts/wechat-push.mjs
```

第一个负责生成文章：

```bash
node scripts/generate-weekly-article.mjs
```

第二个负责检查配置和推送草稿：

```bash
node scripts/wechat-push.mjs check
node scripts/wechat-push.mjs draft --dry-run
node scripts/wechat-push.mjs draft
```

后面还可以封装成 npm 命令：

```bash
npm run generate
npm run wechat:dry
npm run wechat:draft
```

这样就比较接近“一键生成草稿”了。

## 封面图怎么处理

封面图我目前考虑两种路线。

### 本地生成

用脚本生成一张简单的科技风封面。

优点是稳定、可控，不依赖第三方服务，适合自动化任务。

### 第三方生图

如果想让公众号好看一点，可以让 AI 先生成图片提示词，然后去 Gemini 这类工具里生成图。

这次的提示词方向大概是：

```text
科技信息图海报
GitHub 开源生态雷达
AI Agent
代码知识图谱
星标增长曲线
16:9 微信公众号封面
```

如果自动化程度再往前推，也可以让 Codex 操作 Chrome：

```text
打开指定 Chrome Profile
进入 Gemini
选择图片生成
粘贴提示词
下载图片
下载失败就复制图片，从剪贴板保存到本地
更新 .env 里的 WECHAT_COVER_PATH
```

这一步不是必须的，但确实能让文章观感好不少。

## 当前进度

目前已经跑通的部分：

```text
GitHub Trending 抓取
文章生成
本地网页预览
公众号内联 HTML
封面图处理
微信草稿箱推送
Skill 封装
Git 仓库版本控制
```

还可以继续优化：

```text
更稳定地解析 GitHub Trending
增加缓存，避免频繁请求 GitHub API
自动截图预览公众号排版
做一个小型 Web 控制台
支持多个公众号模板
支持自动生成更多配图
```

## 最后

这套东西本质上不是让 AI 替我发文章。

更准确地说，是把重复、机械、容易出错的步骤交给 AI 和脚本，把人的注意力留给判断和表达。

我觉得这会是个人内容工作流很重要的方向：

> 人负责品味和决策，AI 负责执行和整理。

等这套流程再完善一点，我会把源码整理开源。

## 公众号

如果你也对 AI 自动化、开源项目整理、个人内容工作流这些东西感兴趣，可以关注我的公众号。

![公众号二维码](/img/ai-github-trending-wechat/wechat-qrcode.jpg)
