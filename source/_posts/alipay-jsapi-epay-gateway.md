---
title: 个人账号无法开通当面付时的支付宝 JSAPI 免签支付方案
date: 2026-05-22 04:40:00
categories:
  - 支付
tags:
  - 支付宝
  - 小程序
  - JSAPI
  - 独角数卡
  - 易支付
---

> 项目：墨鱼杂货铺  
> 目标：在无法开通支付宝“当面付”的情况下，用支付宝小程序 JSAPI 能力实现一套可对接独角数卡的易支付网关。

很多个人开发者或小微场景无法直接开通支付宝“当面付”。这时，如果账号拥有支付宝小程序能力，可以换一种思路：不走当面付扫码支付，而是让用户扫码打开小程序，并在小程序内通过官方 JSAPI 支付完成收款。

这里说的“免签”不是监听个人收款码，也不是绕过支付宝风控，而是不用“当面付”产品，改用官方的小程序 JSAPI 支付能力完成收款闭环。

<!-- more -->

## 背景

独角数卡这类发卡系统通常更习惯对接“易支付”协议，标准流程类似这样：

```text
独角数卡 -> 易支付网关 -> 用户付款 -> 网关异步通知独角数卡
```

如果没有当面付权限，常见的扫码支付接口无法直接使用。但如果账号拥有支付宝小程序能力，就可以在小程序内调用 JSAPI 支付：

```js
my.tradePay({
  tradeNO: tradeNo
})
```

本项目采用的整体思路如下：

```text
独角数卡发起易支付订单
    -> Service 生成一个带订单号的小程序跳转二维码
    -> 用户用支付宝扫码打开小程序
    -> 小程序读取订单并请求 Service 创建支付宝交易
    -> Service 调用 alipay.trade.create
    -> 小程序调用 my.tradePay 完成支付
    -> 支付宝异步通知 Service
    -> Service 按易支付格式通知独角数卡
```

## 系统结构

项目分为两部分：

```text
MoYuZaHuoPu/
├── Miniapp/   支付宝小程序，负责展示订单和拉起 my.tradePay
└── Service/   FastAPI 后端，负责易支付协议、支付宝 OpenAPI、回调闭环
```

核心角色如下：

| 角色 | 职责 |
| --- | --- |
| 独角数卡 | 请求易支付 submit 接口 |
| Service | 模拟易支付网关，保存订单，调用支付宝 OpenAPI，接收支付宝异步通知，回调独角数卡 `notify_url` |
| Miniapp | 通过 `out_trade_no` 获取订单，获取支付宝用户授权码，调用 Service 创建交易，调用 `my.tradePay` 支付 |
| 支付宝 | 创建交易，完成支付，异步通知 Service |

## 易支付入口设计

Service 提供易支付入口：

```text
GET /api/epay/submit
```

接收独角数卡传来的易支付参数：

```text
pid
type
out_trade_no
notify_url
return_url
name
money
sign
sign_type
```

后端配置一个虚拟易支付商户：

```env
EPAY_PID=1001
EPAY_KEY=moyuzahuopu_secret_key
```

独角数卡后台也要填写同样的 PID 和 KEY。

易支付 MD5 签名规则：

```text
1. 去掉 sign、sign_type 和空值
2. 参数名按字母升序排序
3. 拼接为 key=value&key=value
4. 末尾追加 EPAY_KEY
5. 计算 MD5 小写值
```

验签通过后，Service 把订单保存到 SQLite：

```text
Order:
  id
  out_trade_no
  trade_no
  name
  money
  notify_url
  return_url
  status
```

随后返回一个 HTML 收银台页面。页面里生成二维码，二维码内容是支付宝小程序跳转链接，并带上订单号。

示例：

```env
MINIAPP_QR_BASE_URL=alipays://platformapi/startapp?appId=2021006154623825&page=pages/pay/index
```

Service 会自动追加：

```text
query=out_trade_no%3D订单号
```

## 小程序支付流程

小程序支付页路径：

```text
pages/pay/index
```

进入页面时读取：

```text
out_trade_no
```

然后调用：

```text
GET /api/order/{out_trade_no}
```

用于展示订单名称和金额。

用户点击“确认支付”时，流程如下：

1. 小程序调用 `my.getAuthCode`
2. 把 `auth_code` 和 `out_trade_no` 发给 Service
3. Service 用 `alipay.system.oauth.token` 换取买家标识
4. Service 调用 `alipay.trade.create` 创建支付宝交易
5. Service 返回 `trade_no`
6. 小程序调用 `my.tradePay`

小程序请求示例：

```json
{
  "out_trade_no": "TEST202605211906532C708D25",
  "auth_code": "支付宝授权码"
}
```

Service 返回示例：

```json
{
  "out_trade_no": "TEST202605211906532C708D25",
  "trade_no": "支付宝交易号",
  "status": "PAYING"
}
```

小程序拉起支付：

```js
my.tradePay({
  tradeNO: tradeNo
})
```

## 支付宝 OpenAPI 调用

Service 主要调用两个支付宝接口：

```text
alipay.system.oauth.token
alipay.trade.create
```

### 用 auth_code 换买家标识

小程序拿到的是 `auth_code`，不能直接当成买家 ID。Service 需要调用：

```text
alipay.system.oauth.token
```

支付宝可能返回两类用户标识：

```text
user_id   -> 创建交易时传 buyer_id
open_id   -> 创建交易时传 buyer_open_id
```

这里踩过一个坑：一开始把 `open_id` 当成 `buyer_id` 传给支付宝，结果报错：

```text
参数无效：userId长度不合法
```

最终修正为：

```text
如果 OAuth 返回 user_id，则传 buyer_id
如果 OAuth 返回 open_id，则传 buyer_open_id
```

### 创建支付宝交易

创建交易时调用：

```text
alipay.trade.create
```

核心 `biz_content`：

```json
{
  "out_trade_no": "商户订单号",
  "total_amount": "0.01",
  "subject": "商品名称",
  "buyer_id": "支付宝 user_id"
}
```

或者：

```json
{
  "out_trade_no": "商户订单号",
  "total_amount": "0.01",
  "subject": "商品名称",
  "buyer_open_id": "支付宝 open_id"
}
```

支付宝创建成功后返回 `trade_no`，小程序才能调用 `my.tradePay`。

## 回调闭环

支付完成后，支付宝会请求：

```text
POST /api/pay/alipay_notify
```

这个地址必须是公网可访问地址，不能是 `localhost`。没有正式域名时，可以使用内网穿透：

```env
ALIPAY_NOTIFY_URL=https://你的内网穿透域名/api/pay/alipay_notify
```

Service 收到支付宝异步通知后：

1. 使用支付宝公钥做 RSA2 验签
2. 校验支付状态
3. 校验金额是否一致
4. 更新本地订单状态为 `PAID`
5. 读取订单里的 `notify_url`
6. 按易支付格式回调独角数卡

回调独角数卡参数示例：

```text
pid=1001
trade_no=支付宝交易号
out_trade_no=独角数卡订单号
type=alipay
name=商品名称
money=0.01
trade_status=TRADE_SUCCESS
sign=易支付MD5签名
sign_type=MD5
```

独角数卡返回：

```text
success
```

则闭环完成。

## 本地测试页

为了不一开始就依赖独角数卡，Service 增加了 PC 测试页：

```text
GET /pc
```

测试流程：

```text
1. 打开 https://你的内网穿透域名/pc
2. 输入金额
3. 创建测试订单
4. 生成小程序二维码
5. 手机支付宝扫码打开小程序
6. 小程序读取订单并支付
```

因为未上线的小程序普通扫码可能打不开，所以小程序首页也加了一个测试入口：

```text
首页底部 -> 支付链路测试 -> 输入 out_trade_no -> 跳转支付页
```

这样可以在支付宝开发者工具里直接测试：

```text
pages/pay/index?out_trade_no=测试订单号
```

## 配置说明

Service 的环境变量文件：

```text
Service/.env
```

模板：

```text
Service/.env.example
```

核心配置：

```env
EPAY_PID=1001
EPAY_KEY=moyuzahuopu_secret_key

ALIPAY_APP_ID=支付宝小程序AppID
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_NOTIFY_URL=https://你的公网域名/api/pay/alipay_notify

ALIPAY_APP_PRIVATE_KEY=应用私钥
ALIPAY_PUBLIC_KEY=支付宝公钥

MINIAPP_QR_BASE_URL=alipays://platformapi/startapp?appId=支付宝小程序AppID&page=pages/pay/index
DATABASE_URL=sqlite:///./orders.db
```

小程序后端地址配置：

```text
Miniapp/utils/config.js
```

示例：

```js
const API_BASE_URL = 'https://你的内网穿透域名/api'
```

真机测试时不能使用：

```text
localhost
127.0.0.1
```

因为手机访问不到电脑本机地址。

## 遇到的问题和解决方案

### 普通支付宝扫码提示“暂未找到此功能”

现象：

```text
暂未找到此功能，请稍后再试
```

原因：

```text
小程序还没有线上版本，普通支付宝客户端无法通过 alipays://platformapi/startapp 打开。
```

解决：

```text
使用支付宝开发者工具的预览、真机调试或体验版。
把测试账号加入小程序开发者、体验成员或项目成员。
```

### 小程序金额显示为 0.00

现象：

```text
后端返回 money: "0.01"，页面显示 ¥0.00
```

原因：

```text
小程序页面只读取 total_amount、amount、pay_amount，没有读取 Service 返回的 money。
```

解决：

```js
displayAmount = money || total_amount || amount || pay_amount || 0
```

### 应用私钥解析失败

现象：

```text
Could not deserialize key data
```

原因：

```text
支付宝密钥工具常见应用私钥是 PKCS8：
-----BEGIN PRIVATE KEY-----

代码一开始按 PKCS1：
-----BEGIN RSA PRIVATE KEY-----
去补头尾，导致解析失败。
```

解决：

```text
优先按 PRIVATE KEY 解析，失败再按 RSA PRIVATE KEY 兜底。
```

### 支付宝返回 GBK 编码内容导致 UTF-8 解码失败

现象：

```text
'utf-8' codec can't decode byte ...
```

原因：

```text
支付宝网关异常时可能返回 GBK/GB18030 编码的错误页或文本。
```

解决：

```text
解析支付宝响应时按 UTF-8、UTF-8-SIG、GB18030、GBK 依次尝试。
如果不是 JSON，返回可读的原始错误摘要。
```

### charset 参数位置导致验签失败

现象：

```text
验签出错，请确认 charset 参数放在了 URL 查询字符串中
```

原因：

```text
一开始用 POST body 提交参数，支付宝网关希望 charset 等公共参数出现在 URL query string 中。
```

解决：

```python
client.post(ALIPAY_GATEWAY, params=params)
```

而不是：

```python
client.post(ALIPAY_GATEWAY, data=params)
```

### RSA2 签名字符串错误

现象：

```text
验签出错，建议检查签名字符串或签名私钥与应用公钥是否匹配
```

支付宝返回的验签字符串中包含：

```text
sign_type=RSA2
```

原因：

```text
代码一开始生成支付宝待签名串时排除了 sign_type。
但支付宝网关验签字符串包含 sign_type。
```

解决：

```text
支付宝请求加签只排除 sign，不排除 sign_type。
```

### 买家信息不能为空

现象：

```text
买家信息不能为空
```

原因：

```text
alipay.trade.create 需要买家身份。
小程序没有把买家信息传给后端。
```

解决：

```text
小程序调用 my.getAuthCode。
后端调用 alipay.system.oauth.token 换取 user_id 或 open_id。
创建交易时传 buyer_id 或 buyer_open_id。
```

### userId 长度不合法

现象：

```text
参数无效：userId长度不合法
```

原因：

```text
OAuth 返回的是 open_id，却被当成 buyer_id 传给支付宝。
```

解决：

```text
user_id -> buyer_id
open_id -> buyer_open_id
```

### 卖家买家账号相同

现象：

```text
卖家买家账号相同，不能进行交易
```

原因：

```text
测试付款账号和收款商户账号是同一个支付宝账号或同一主体。
```

解决：

```text
换另一个支付宝账号测试。
如果小程序未上线，把该账号加入体验成员。
```

## 密钥检查

为了确认应用私钥和支付宝后台上传的应用公钥是否匹配，项目里增加了：

```text
Service/check_alipay_keys.py
```

运行：

```powershell
cd Service
python check_alipay_keys.py
```

它会：

```text
1. 检查 ALIPAY_APP_ID 是否配置
2. 检查 ALIPAY_APP_PRIVATE_KEY 是否可解析
3. 从应用私钥导出应用公钥
4. 输出应用公钥指纹
5. 输出应该上传到支付宝开放平台后台的应用公钥
```

注意：

```text
ALIPAY_APP_PRIVATE_KEY = 应用私钥，放在 Service/.env
应用公钥 = 从应用私钥导出，上传到支付宝开放平台后台
ALIPAY_PUBLIC_KEY = 支付宝公钥，放在 Service/.env，用于验支付宝回调
```

不要把应用公钥和支付宝公钥混淆。

## 独角数卡对接方式

独角数卡后台添加易支付或码支付类插件时：

```text
商户 ID: EPAY_PID
商户密钥: EPAY_KEY
支付网关: https://你的域名/api/epay/submit
```

Service 必须公网可访问：

```text
https://你的域名/api/epay/submit
https://你的域名/api/pay/alipay_notify
```

支付宝开放平台后台的异步通知地址也应配置为：

```text
https://你的域名/api/pay/alipay_notify
```

## 安全注意事项

1. 不要提交 `Service/.env`
2. 不要把应用私钥发到聊天、工单、公开仓库
3. 如果应用私钥泄露，正式上线前必须重新生成密钥对
4. 使用 HTTPS 公网域名，不要使用 HTTP
5. 支付宝回调必须验签
6. 支付成功必须校验金额
7. 独角数卡回调必须按易支付规则重新签名
8. 测试订单和生产订单建议使用不同前缀

## 最终结论

当个人账号无法开通支付宝当面付时，可以通过支付宝小程序 JSAPI 支付实现一套“类易支付网关”：

```text
易支付入口负责接单
小程序负责拉起支付
支付宝 OpenAPI 负责创建交易和回调
Service 负责协议转换和订单闭环
```

这套方案的关键不是绕过支付宝，而是把“面对面扫码支付”转成“扫码打开小程序并在小程序内支付”。

只要小程序支付能力、支付宝 OpenAPI 密钥、OAuth 授权、异步通知和易支付回调都打通，就可以对接独角数卡这类只认识易支付协议的系统。
