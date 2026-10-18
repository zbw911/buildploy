# Buildploy

与 AI 一起构建页面、连接数据、编排业务流程，将需求推进到预览、验证与交付。

[访问官网](https://www.buildploy.com/) · [进入工作台](https://code.buildploy.com/) · [使用文档](docs/README.md) · [反馈问题](https://github.com/zbw911/buildploy/issues/new/choose)

## 这个仓库用于什么？

这里是 Buildploy 的公开使用文档与 Issue 反馈中心，用于：

- 阅读入门指南与常见问题。
- 报告使用中遇到的问题，跟踪处理进展。
- 提出功能建议，补充或修正文档。

本仓库不包含 Buildploy 平台完整源码，也不提供平台自部署安装包。请通过在线工作台体验产品。产品持续开发中，界面、可用功能和目标端支持以实际环境为准。

## 开始使用

由于资源有限，Buildploy 暂未开放公开注册，目前采用白名单机制。如需开通体验，请发送邮件至 [zbw911@qq.com](mailto:zbw911@qq.com)，或通过 [GitHub Issue](https://github.com/zbw911/buildploy/issues/new/choose) 联系作者。已开通用户可正常登录。

申请所需手机号请通过邮件沟通，不要公开填写在 Issue 中。

1. 打开[工作台](https://code.buildploy.com/)，按页面提示登录。
2. 按照[快速入门](docs/quick-start.md)，从一个小需求开始构建。
3. 运行预览并实际验证关键操作，再查看交付结果。

## 路线图

### 执行器与 NAS 存储

当前云端执行器与持久化共享文件存储使用阿里云函数计算（FC）与 NAS。未来根据实际需求，评估扩展以下平台：

| 平台 | 执行器 | NAS 共享文件存储 | 状态 |
| --- | --- | --- | --- |
| 腾讯云 | 云函数 SCF | 文件存储 CFS | 未来按需扩展，尚未接入 |
| 火山引擎 | 函数服务 veFaaS | 文件存储 NAS | 未来按需扩展，尚未接入 |

扩展将复用现有应用操作与执行器协议，按平台适配执行环境和存储能力。接入前需验证执行镜像、任务生命周期、流式输出、文件挂载、持久化与重启恢复。具体适配范围与上线时间根据实际需求确定。

## 文档与反馈

- [文档目录](docs/README.md)
- [快速入门](docs/quick-start.md)
- [常见问题](docs/faq.md)
- [反馈与文档贡献指南](CONTRIBUTING.md)
- [查看已有 Issues](https://github.com/zbw911/buildploy/issues)

提交反馈前请先搜索已有 Issue。公开反馈中请勿提交密码、Token、连接串、个人信息或未脱敏的业务数据。
