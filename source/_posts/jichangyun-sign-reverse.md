---
title: 记一次某云商的 sign 算法逆向
date: 2026-05-22 05:20:00
categories:
  - 技术
tags:
  - 小程序
  - 逆向
  - 签名算法
  - 抓包
  - MD5
---

前段时间闲着没事，朋友给我推了一个活动，大概是关于毛子的。刚开始我是拒绝的，后来发现连实名认证都得抢，于是打算用电脑试试。

结果一打开才发现它只支持手机端访问。既然这样，那就顺手抓个包看看。

<!-- more -->

## 抓包分析

先看抓到的请求：

![抓包请求](/img/jichangyun-sign/image-20230209014937357.png)

从请求里能看到一个比较关键的字段：`sign`。看格式和长度，八九不离十是 MD5。

除了 `sign` 以外，请求头里还有两个字段：

```text
noncestr
timestamp
```

`timestamp` 不用多说，就是时间戳；`noncestr` 盲猜是随机字符串。这样一来，核心问题就变成了：只要知道它的签名规则，就能模拟这个请求。

## 小程序解包

小程序不像网页，不能直接打开 F12 看源码，所以需要用到 `wxappUnpacker` 这类小程序分包工具。

小程序包需要先从手机上提取出来，再进行解包分析。

## 源码分析

用 VS Code 打开解包后的源码，直接搜索关键词 `noncestr`，很快就能定位到加密逻辑附近。

![noncestr 相关源码](/img/jichangyun-sign/1675879497734.jpg)

接着继续找 `PLMKEY`：

![PLMKEY 相关源码](/img/jichangyun-sign/image-20230209020852014.png)

`noncestr` 也是有生成规则的，这里当时踩了一个坑：

![noncestr 生成规则](/img/jichangyun-sign/1675879611382.jpg)

简单还原一下字符串拼接和签名逻辑，大概是这样：

```js
function getSign(api, body, token, st, nonce) {
  var d = "";
  var keys = Object.keys(body).sort();

  for (var c = 0; c < keys.length; c++) {
    var key = keys[c];
    var value = body[key];

    if (typeof value === "object") {
      var jsonValue = JSON.stringify(body[key]);
      d += key + "=" + jsonValue.split("").sort().join("") + "&";
    } else {
      if (value === 0 || value) {
        d += key + "=" + body[key] + "&";
      } else {
        body[key] = "";
        d += key + "=&";
      }
    }
  }

  d += "url=" + api + "&";
  d += token ? "accessToken=" + token + "&" : "";
  d += "timestamp=" + st + "&";
  d += "nonceStr=" + nonce + "&";
  d += "key=ca235e27dcf94107889b9ad00ceebd48";

  return CryptoJS.MD5(d).toString();
}
```

整体规则不复杂：

1. 取 `body` 里的参数名，并按字母顺序排序
2. 普通值按 `key=value&` 拼接
3. 对象值先 `JSON.stringify`，再把字符串拆开排序后拼接
4. 追加 `url`
5. 如果有 `accessToken`，继续追加
6. 追加 `timestamp`、`nonceStr`
7. 最后追加固定 key
8. 对最终字符串做 MD5

## 签名校验踩坑

签名校验时我一直对不上，后来才发现字符串里带了中文。

这类情况不同语言处理起来会有细节差异，尤其是编码、序列化和字符串排序。还原签名算法时，不能只看拼接顺序，也要注意语言之间对中文和 JSON 的处理差异。

## 开始编码

签名规则确认以后，就可以开始写请求了。必要的请求头补齐即可：

```python
Headers = {
    'Host': 'www.gza-e.com',
    'Connection': 'keep-alive',
    'charset': 'utf-8',
    'Accept': '*/*',
    'sign': sign,
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; MIX 3 Build/QKQ1.190828.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/86.0.4240.99 XWEB/4375 MMWEBSDK/20221206 Mobile Safari/537.36 MMWEBID/470 MicroMessenger/8.0.32.2300(0x2800203F) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 MiniProgramEnv/android',
    'accesstoken': accesstoken,
    'content-type': 'application/json',
    'noncestr': noncestr,
    'timestamp': timestamp,
    'Referer': 'https://servicewechat.com/wx88c590140de89f92/220/page-frame.html'
}
```

这里还有一个很坑的地方：请求地址后面千万不要多加斜杠 `/`。

当时为了这个斜杠耗了好几个小时。签名算法里把 `url` 也算进去了，所以：

```text
/api/example
```

和：

```text
/api/example/
```

算出来的签名完全不是一回事。

## 小结

这次逆向本质上就是三件事：

```text
抓包确认关键字段
解包定位签名逻辑
还原参数排序、拼接和 MD5 规则
```

真正容易浪费时间的地方反而不是 MD5 本身，而是那些细节：`noncestr` 的生成、中文字符串处理、对象参数排序，以及 URL 末尾有没有多一个 `/`。
