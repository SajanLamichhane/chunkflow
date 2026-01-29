# 需求文档

## 简介

ChunkFlow Upload SDK 是一个通用的大文件上传解决方案，旨在提供从小文件到超大文件的完整上传能力。该 SDK 采用高度解耦的架构设计，支持分片上传、断点续传、秒传、并发控制等核心功能，并提供多框架适配层和完整的服务端实现。

## 术语表

- **SDK**: Software Development Kit，软件开发工具包
- **分片（Chunk）**: 将大文件切分成的小块数据单元
- **Hash**: 基于文件内容计算的唯一标识符
- **秒传**: 通过 Hash 校验发现文件已存在，无需重新上传
- **断点续传**: 上传中断后可从上次位置继续上传
- **Protocol_Layer**: 协议层，定义前后端通信协议
- **Core_Layer**: 核心层，实现上传状态机和生命周期管理
- **Shared_Layer**: 共享层，提供通用工具函数
- **Client_Layer**: 客户端适配层，提供框架特定的集成
- **Component_Layer**: 组件层，提供开箱即用的 UI 组件
- **Server_Layer**: 服务端层，提供 BFF SDK 和完整服务端实现
- **Upload_Token**: 上传令牌，用于标识和授权上传会话
- **Chunk_Size**: 分片大小，可动态调整
- **IndexedDB**: 浏览器本地数据库，用于持久化上传状态
- **Web_Worker**: 浏览器后台线程，用于执行耗时计算
- **Monorepo**: 单一代码仓库管理多个包的项目结构
- **BFF**: Backend For Frontend，为前端服务的后端层

## 需求

### 需求 1: 文件上传策略

**用户故事**: 作为开发者，我希望 SDK 能够根据文件大小自动选择最优上传策略，以便提供最佳的上传性能和用户体验。

#### 验收标准

1. WHEN 文件大小小于 5MB THEN THE SDK SHALL 使用直传策略上传文件
2. WHEN 文件大小大于等于 5MB THEN THE SDK SHALL 使用分片上传策略
3. WHERE 流式上传功能启用 WHEN 文件来源为流 THEN THE SDK SHALL 使用流式上传策略
4. THE SDK SHALL 在上传开始前自动检测文件大小并选择对应策略

### 需求 2: 分片上传与动态切片

**用户故事**: 作为开发者，我希望 SDK 能够智能地调整分片大小，以便在不同网络环境下获得最优上传性能。

#### 验收标准

1. THE SDK SHALL 初始分片大小设置为 1MB
2. WHEN 分片上传完成 THEN THE SDK SHALL 根据上传耗时动态调整下一个分片的大小
3. WHEN 上传速度快 THEN THE SDK SHALL 增大分片大小（最大 10MB）
4. WHEN 上传速度慢 THEN THE SDK SHALL 减小分片大小（最小 256KB）
5. THE SDK SHALL 支持用户配置初始分片大小和大小范围

### 需求 3: Hash 计算与秒传

**用户故事**: 作为用户，我希望已上传过的文件能够秒传，以便节省时间和带宽。

#### 验收标准

1. WHEN 文件被选中 THEN THE SDK SHALL 在后台计算文件的 Hash 值
2. THE SDK SHALL 使用 Web_Worker 或 requestIdleCallback 计算 Hash，不阻塞主线程
3. WHEN Hash 计算完成 THEN THE SDK SHALL 向服务端发送 Hash 校验请求
4. WHEN 服务端返回文件已存在 THEN THE SDK SHALL 跳过上传并返回文件访问地址
5. WHEN 服务端返回部分分片已存在 THEN THE SDK SHALL 只上传缺失的分片
6. THE SDK SHALL 同时进行 Hash 计算和分片上传，不等待 Hash 完成

### 需求 4: 断点续传

**用户故事**: 作为用户，我希望上传中断后能够从断点继续，以便不浪费已上传的数据。

#### 验收标准

1. WHEN 分片上传成功 THEN THE SDK SHALL 将上传进度写入 IndexedDB
2. WHEN 用户重新进入页面 THEN THE SDK SHALL 自动从 IndexedDB 读取未完成的上传任务
3. WHEN 检测到未完成任务 THEN THE SDK SHALL 提供恢复上传的接口
4. WHEN 恢复上传 THEN THE SDK SHALL 从上次中断的分片继续上传
5. THE SDK SHALL 支持清除已保存的上传记录

### 需求 5: 并发控制

**用户故事**: 作为开发者，我希望能够控制并发上传的分片数量，以便平衡上传速度和系统资源占用。

#### 验收标准

1. THE SDK SHALL 默认并发上传 3 个分片
2. THE SDK SHALL 支持用户配置并发数量（1-10）
3. WHEN 并发队列已满 THEN THE SDK SHALL 等待队列中有空位后再发起新的上传
4. THE SDK SHALL 使用成熟的并发控制库（如 p-limit）

### 需求 6: 生命周期与事件系统

**用户故事**: 作为开发者，我希望能够监听上传过程中的各种事件，以便实现自定义的业务逻辑和 UI 更新。

#### 验收标准

1. THE SDK SHALL 提供完整的上传生命周期钩子（onStart, onProgress, onSuccess, onError, onPause, onResume, onCancel）
2. THE SDK SHALL 使用成熟的事件系统库（如 mitt）
3. WHEN 上传状态变化 THEN THE SDK SHALL 触发对应的生命周期事件
4. THE SDK SHALL 在事件回调中提供详细的上传信息（进度、速度、剩余时间等）
5. THE SDK SHALL 支持 Plugin 机制，允许开发者扩展功能

### 需求 7: 协议层设计

**用户故事**: 作为架构师，我希望前后端通信协议清晰且标准化，以便支持多种服务端实现。

#### 验收标准

1. THE Protocol_Layer SHALL 定义创建文件接口（HEAD），返回 Upload_Token 和协商的 Chunk_Size
2. THE Protocol_Layer SHALL 定义 Hash 校验接口，接收文件/分片 Hash，返回是否存在、剩余分片列表、文件访问地址
3. THE Protocol_Layer SHALL 定义分片上传接口，支持 multipart/form-data 和 application/octet-stream 两种格式
4. THE Protocol_Layer SHALL 定义逻辑合并接口，仅进行校验、标记和生成 URL，不做物理合并
5. THE Protocol_Layer SHALL 使用 TypeScript 定义所有接口类型

### 需求 8: 核心层架构

**用户故事**: 作为架构师，我希望核心层完全独立于 UI 和请求库，以便支持多种运行环境。

#### 验收标准

1. THE Core_Layer SHALL 不依赖任何 DOM API
2. THE Core_Layer SHALL 不依赖任何特定的 HTTP 请求库
3. THE Core_Layer SHALL 通过抽象接口接收请求适配器
4. THE Core_Layer SHALL 实现完整的上传状态机（idle, hashing, uploading, paused, success, error, cancelled）
5. THE Core_Layer SHALL 提供 Hook 和 Plugin 机制
6. THE Core_Layer SHALL 管理上传队列和并发控制

### 需求 9: 共享层工具

**用户故事**: 作为开发者，我希望有一套通用的工具函数库，以便在各个层级复用代码。

#### 验收标准

1. THE Shared_Layer SHALL 提供事件系统封装
2. THE Shared_Layer SHALL 提供并发控制工具
3. THE Shared_Layer SHALL 提供文件处理工具（切片、Hash 计算）
4. THE Shared_Layer SHALL 提供类型定义和常量
5. THE Shared_Layer SHALL 不依赖任何特定框架或环境

### 需求 10: 框架适配层

**用户故事**: 作为前端开发者，我希望能够在 React 和 Vue 项目中方便地使用 SDK，以便快速集成上传功能。

#### 验收标准

1. THE Client_Layer SHALL 提供 React Hooks（useUpload, useUploadList）
2. THE Client_Layer SHALL 提供 Vue Composables（useUpload, useUploadList）
3. WHEN 框架组件挂载 THEN THE Client_Layer SHALL 自动初始化上传实例
4. WHEN 框架组件卸载 THEN THE Client_Layer SHALL 自动清理资源
5. THE Client_Layer SHALL 提供响应式的上传状态

### 需求 11: UI 组件层

**用户故事**: 作为前端开发者，我希望有开箱即用的上传组件，以便快速实现上传界面。

#### 验收标准

1. THE Component_Layer SHALL 提供 React 上传组件（UploadButton, UploadList, UploadProgress）
2. THE Component_Layer SHALL 提供 Vue 上传组件（UploadButton, UploadList, UploadProgress）
3. THE Component_Layer SHALL 支持自定义样式和主题
4. THE Component_Layer SHALL 显示上传进度、速度、剩余时间
5. THE Component_Layer SHALL 支持拖拽上传
6. THE Component_Layer SHALL 支持文件类型和大小限制

### 需求 12: 服务端 BFF SDK

**用户故事**: 作为后端开发者，我希望有一个 BFF SDK，以便快速实现上传服务端逻辑。

#### 验收标准

1. THE Server_Layer SHALL 提供创建文件的接口实现
2. THE Server_Layer SHALL 提供 Hash 校验的接口实现
3. THE Server_Layer SHALL 提供分片上传的接口实现
4. THE Server_Layer SHALL 提供逻辑合并的接口实现
5. THE Server_Layer SHALL 支持多种存储后端（本地文件系统、OSS、S3）
6. THE Server_Layer SHALL 提供存储适配器接口

### 需求 13: 完整服务端实现

**用户故事**: 作为开发者，我希望有一个完整的服务端参考实现，以便快速启动和测试。

#### 验收标准

1. THE Server_Application SHALL 使用 Nest.js + Fastify 构建
2. THE Server_Application SHALL 使用 PostgreSQL 存储文件元数据
3. THE Server_Application SHALL 实现分片与文件的解耦存储
4. WHEN 访问文件 THEN THE Server_Application SHALL 动态读取分片并流式输出
5. THE Server_Application SHALL 支持 docker-compose 一键启动
6. THE Server_Application SHALL 分片跨文件唯一且永不删除

### 需求 14: Monorepo 工程架构

**用户故事**: 作为项目维护者，我希望使用 Monorepo 管理多个包，以便统一构建和发布。

#### 验收标准

1. THE Project SHALL 使用 pnpm workspace 管理 Monorepo
2. THE Project SHALL 使用 Turbo 加速构建和测试
3. THE Project SHALL 使用 tsdown 构建 TypeScript 包
4. THE Project SHALL 输出 ESM 格式
5. THE Project SHALL 每个包独立发布到 npm
6. THE Project SHALL 包之间通过 workspace 协议引用

### 需求 15: 代码质量与测试

**用户故事**: 作为项目维护者，我希望有完善的代码质量保障机制，以便保持代码的可维护性。

#### 验收标准

1. THE Project SHALL 使用 oxlint 进行代码检查
2. THE Project SHALL 使用 oxfmt 进行代码格式化
3. THE Project SHALL 使用 lint-staged 在提交前自动检查
4. THE Project SHALL 使用 Vitest 编写和运行测试
5. THE Project SHALL 只测试有业务价值的核心逻辑
6. THE Project SHALL 使用 changeset 管理版本和发布

### 需求 16: 文档与示例

**用户故事**: 作为 SDK 使用者，我希望有完善的文档和示例，以便快速上手和解决问题。

#### 验收标准

1. THE Project SHALL 使用 VitePress 构建文档站点
2. THE Project SHALL 提供完整的 API 文档
3. THE Project SHALL 提供使用指南和最佳实践
4. THE Project SHALL 提供 Playground 应用用于演示和调试
5. THE Project SHALL 文档站点支持一键部署到 GitHub Pages
6. THE Project SHALL 提供中英文双语文档

### 需求 17: Hash 计算与上传并行

**用户故事**: 作为用户，我希望选中文件后立即开始上传，而不是等待 Hash 计算完成，以便获得更快的上传体验。

#### 验收标准

1. WHEN 文件被选中 THEN THE SDK SHALL 立即开始分片上传
2. THE SDK SHALL 同时在后台计算文件 Hash
3. WHEN Hash 计算完成且发现文件已存在 THEN THE SDK SHALL 取消正在进行的上传
4. WHEN Hash 计算完成且发现部分分片已存在 THEN THE SDK SHALL 跳过已存在的分片
5. THE SDK SHALL 优先上传前几个分片以快速获得反馈

### 需求 18: 分片唯一性与复用

**用户故事**: 作为系统架构师，我希望分片能够跨文件复用，以便节省存储空间和提高秒传效率。

#### 验收标准

1. THE System SHALL 基于分片内容 Hash 确定分片唯一性
2. WHEN 多个文件包含相同内容的分片 THEN THE System SHALL 只存储一份分片数据
3. THE System SHALL 分片与文件完全解耦
4. THE System SHALL 分片一旦创建永不删除
5. WHEN 文件被删除 THEN THE System SHALL 只删除文件元数据，不删除分片

### 需求 19: 文件访问与流式输出

**用户故事**: 作为用户，我希望能够快速访问已上传的文件，以便下载或预览。

#### 验收标准

1. WHEN 用户访问文件 URL THEN THE Server_Application SHALL 根据文件元数据查找所有分片
2. THE Server_Application SHALL 按顺序读取分片内容
3. THE Server_Application SHALL 使用流式管道输出文件内容
4. THE Server_Application SHALL 支持 Range 请求（断点下载）
5. THE Server_Application SHALL 设置正确的 Content-Type 和 Content-Length

### 需求 20: 错误处理与重试

**用户故事**: 作为用户，我希望上传失败时能够自动重试，以便应对网络波动。

#### 验收标准

1. WHEN 分片上传失败 THEN THE SDK SHALL 自动重试该分片
2. THE SDK SHALL 默认重试 3 次
3. THE SDK SHALL 支持用户配置重试次数和重试延迟
4. WHEN 重试次数耗尽 THEN THE SDK SHALL 触发 onError 事件
5. THE SDK SHALL 使用指数退避策略进行重试
6. THE SDK SHALL 提供手动重试接口
