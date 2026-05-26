---
title: 如何让搜索引擎收录你的个人网站：Google、Bing 和百度
date: 2026-05-27 04:15:00
categories:
  - 技术
tags:
  - SEO
  - Google Search Console
  - Bing Webmaster Tools
  - 百度搜索资源平台
  - Hexo
  - Cloudflare Pages
---

博客搭好之后，还有一个很现实的问题：搜索引擎怎么才能找到它？

一开始我以为，只要网站能访问，搜索引擎迟早会自己发现。理论上确实有可能，但如果是一个刚上线、没什么外链的新站，那等待时间就很玄学了。

所以更稳的做法是：主动告诉搜索引擎“我这个站点在这里”，并且给它一份 sitemap。

这篇记录一下我给 Hexo 博客接入 Google、Bing 和百度收录的过程，以及中间踩到的一个 Cloudflare Pages 小坑。

<!-- more -->

## 先把站点 URL 配好

第一步不是去提交搜索引擎，而是先确认 Hexo 的站点地址是对的。

在 Hexo 根目录的 `_config.yml` 里，把默认的：

```yaml
url: http://example.com
```

改成自己的正式域名：

```yaml
url: https://moyudev.dpdns.org
```

这个很重要。

如果这里还是 `example.com`，那生成出来的 canonical、文章版权链接、Open Graph 地址、sitemap 链接都可能是错的。搜索引擎看到这些信息，会很迷惑。

## 添加 robots.txt

在 Hexo 的 `source` 目录下新建：

```text
source/robots.txt
```

内容类似：

```txt
User-agent: *
Allow: /

Sitemap: https://moyudev.dpdns.org/sitemap.xml
Sitemap: https://moyudev.dpdns.org/baidusitemap.xml
```

`robots.txt` 的作用是告诉搜索引擎哪些内容可以抓取，以及 sitemap 在哪里。

这里我同时放了两个 sitemap：

```text
sitemap.xml
baidusitemap.xml
```

一个给通用搜索引擎，一个给百度。实际上内容可以一样，只是百度平台里提交 `baidusitemap.xml` 看着更清楚。

## 生成 sitemap

通常 Hexo 可以安装插件：

```powershell
npm install hexo-generator-sitemap --save
npm install hexo-generator-baidu-sitemap --save
```

不过我当时安装 npm 插件时网络不太顺，所以最后选择自己写了一个 Hexo 生成脚本：

```text
scripts/seo-sitemap.js
```

它会在 `hexo generate` 时自动生成：

```text
public/sitemap.xml
public/baidusitemap.xml
```

生成出来的链接类似：

```xml
<url>
  <loc>https://moyudev.dpdns.org/</loc>
  <lastmod>2026-05-26T14:34:31.303Z</lastmod>
  <changefreq>weekly</changefreq>
  <priority>1.0</priority>
</url>
```

这样每次新增文章后，只要重新构建，sitemap 就会自动更新。

## Google Search Console

Google 的接入比较直接。

打开：

```text
https://search.google.com/search-console
```

添加资源时，我选择了 URL 前缀：

```text
https://moyudev.dpdns.org/
```

然后选择 HTML 文件验证。Google 会给一个类似这样的文件：

```text
google233c2cbcb316049c.html
```

把它放到 Hexo 的 `source` 目录：

```text
source/google233c2cbcb316049c.html
```

但这里有个小细节：这个验证文件必须原样输出，不能被 Hexo 当成页面渲染。

所以 `_config.yml` 里要加：

```yaml
skip_render:
  - google*.html
  - baidu*.html
```

这样构建后访问：

```text
https://moyudev.dpdns.org/google233c2cbcb316049c.html
```

看到的就是原始验证内容，而不是被主题包起来的博客页面。

Google 验证通过后，在 Search Console 里提交 sitemap：

```text
https://moyudev.dpdns.org/sitemap.xml
```

然后可以用“网址检查”检查首页：

```text
https://moyudev.dpdns.org/
```

点“请求编入索引”。

## Bing Webmaster Tools

Bing 也类似。

打开：

```text
https://www.bing.com/webmasters
```

最省事的方法是直接从 Google Search Console 导入站点。如果不导入，也可以手动添加：

```text
https://moyudev.dpdns.org/
```

验证方式可以同样使用 HTML 文件，放到 `source` 目录，并依赖前面配置好的：

```yaml
skip_render:
  - google*.html
  - baidu*.html
```

验证成功后提交 sitemap：

```text
https://moyudev.dpdns.org/sitemap.xml
```

Bing 的体验整体比较顺，不太折腾。

## 百度搜索资源平台

百度这边稍微绕一点。

打开百度搜索资源平台，添加站点：

```text
https://moyudev.dpdns.org/
```

一开始我选择了文件验证，百度给了一个文件：

```text
baidu_verify_codeva-BrFw8rG3Ka.html
```

放到：

```text
source/baidu_verify_codeva-BrFw8rG3Ka.html
```

本地构建后也确实能生成：

```text
public/baidu_verify_codeva-BrFw8rG3Ka.html
```

内容是：

```text
9bcbdcd68501bf5d9781b8824fc6a424
```

看起来一切正常，但验证时失败了。

当时百度后台提示：

```text
验证失败
不到一分钟前 https://moyudev.ccwu.cc 使用文件验证
原因：未知原因:308。
问题分析&解决办法：未知原因:308。
```

截图大概是这样：

![百度验证 308 报错](/img/search-engine-indexing/baidu-308.png)

## 踩坑：Cloudflare Pages 的 .html 重定向

问题出在 Cloudflare Pages 的一个特性上。

我访问：

```text
https://moyudev.dpdns.org/baidu_verify_codeva-BrFw8rG3Ka.html
```

它会自动跳转到：

```text
https://moyudev.dpdns.org/baidu_verify_codeva-BrFw8rG3Ka
```

也就是把 `.html` 后缀去掉了。

这对普通页面是好事，URL 看起来更干净。但对百度文件验证来说就有点尴尬，因为百度要找的就是那个固定的 `.html` 文件。

我还试过一个有点好笑的办法：把文件名改成：

```text
baidu_verify_codeva-BrFw8rG3Ka.html.html
```

想着 Cloudflare 会不会把它重定向成：

```text
baidu_verify_codeva-BrFw8rG3Ka.html
```

这个思路挺有实验精神，但实际不稳定，也不建议这么搞。

最后我换成了百度的 HTML 标签验证。

百度给的 meta 类似：

```html
<meta name="baidu-site-verification" content="codeva-BrFw8rG3Ka" />
```

我把它加到了 Butterfly 主题配置的 head 注入里：

```yaml
inject:
  head:
    - <meta name="baidu-site-verification" content="codeva-BrFw8rG3Ka" />
```

重新构建后，首页源码里能看到这段：

```html
<meta name="baidu-site-verification" content="codeva-BrFw8rG3Ka" />
```

然后回百度选择“HTML标签验证”，就不会再受 `.html` 重定向影响。

验证通过后，提交百度 sitemap：

```text
https://moyudev.dpdns.org/baidusitemap.xml
```

## 会不会影响 Google？

不会。

Google 的 HTML 文件验证、百度的 HTML 标签验证、Bing 的验证方式，可以同时存在。

它们互不影响：

```text
Google: googlexxxx.html
Baidu: meta baidu-site-verification
Bing: HTML 文件或从 Google 导入
```

`robots.txt` 里也可以同时写多个 sitemap。搜索引擎会按自己的规则抓取，不会因为你接入了百度就影响 Google。

## 每次发文章都要重新提交吗？

不用。

只要这些配置做好了，后面正常写文章就行：

```text
写 Markdown
hexo generate
git commit
git push
Cloudflare Pages 自动部署
搜索引擎根据 sitemap 慢慢抓取
```

每次构建时，sitemap 会自动更新，新文章链接会出现在：

```text
https://moyudev.dpdns.org/sitemap.xml
```

和：

```text
https://moyudev.dpdns.org/baidusitemap.xml
```

如果是很重要的文章，可以去 Google Search Console 或 Bing Webmaster Tools 手动提交 URL，但平时没必要每篇都折腾。

## 最后

让搜索引擎收录一个新站，大概就是这几件事：

```text
配置正确的站点 URL
生成 sitemap
配置 robots.txt
验证 Google / Bing / 百度站点所有权
提交 sitemap
等待抓取和收录
```

真正要注意的是，静态站托管平台可能会有自己的 URL 规则，比如 Cloudflare Pages 的 `.html` 自动重定向。普通页面没问题，但搜索引擎验证文件就可能踩坑。

所以我的最终方案是：

```text
Google：HTML 文件验证
Bing：从 Google 导入或 HTML 文件验证
百度：HTML 标签验证
sitemap：自动生成
robots.txt：声明 sitemap 地址
```

配置好以后，剩下的事情就是持续写内容了。搜索引擎收录只是入口，真正能留下来的，还是网站本身有没有值得被找到的东西。
