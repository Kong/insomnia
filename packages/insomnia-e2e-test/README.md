# Insomnia E2E Tests

这个包包含 Insomnia 应用的端到端（E2E）测试，使用 **Vitest** 作为测试框架，**Playwright** 进行应该界面（页面）自动化。

## 测试文件

| 文件                               | 描述                                                         | 测试数量 |
| ---------------------------------- | ------------------------------------------------------------ | -------- |
| `tests/http-methods-tests.spec.ts` | HTTP 方法测试 (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD) | 7        |
| `playwright/tests.ts`              | 启动和关闭insomniay应用                                      | 0        |



## 前置条件

1. **构建 Insomnia 应用**
   ```bash
   # 在项目根目录运行
   npm run app-build
   # 或者启动开发模式的 watcher
   npm run watch:app
   ```

2. **安装依赖**
   ```bash
   cd packages/insomnia-e2e-test
   npm install
   ```


## 运行测试

### 运行所有测试
```bash
npm test                    # 运行所有测试（一次性）
npm run test:watch          # 监听模式（文件改变时自动运行）
npm run test:ui             # UI 模式（可视化界面）⭐ 推荐
```

### 运行特定测试文件
```bash
npm run test:http           # 只运行 HTTP 方法测试
```

## 测试文件说明

### `tests/http-methods-tests.spec.ts`
测试所有 7 个 HTTP 方法，包含查询参数的添加和发送。

**测试场景:**
- GET - 带查询参数
- POST - 带查询参数和 JSON Body
- PUT - 带查询参数
- PATCH - 带查询参数
- DELETE - 带查询参数
- OPTIONS - 带查询参数
- HEAD - 带查询参数


## 🔧 配置

测试配置在 `vitest.config.ts` 中
这是关于测试框架本身的配置，与应用测试本身无关。


## 注意事项

1. **应用必须先构建**: 运行测试前确保已经运行 `npm run app-build` 或 `npm run watch:app` （有时打包程序后，启动成功，右键未找到inspect element菜单，感觉打包的文件是windows的二进制文件，原因未知）
2. 本测试用例应该包含websocket, grpc的接口部分，但目前在我实际的测试环境中没有这2种类型的接口，故未包含，从UI自动化的角度，操作应该相似
3. **平台差异**: 本测试用例应该在mac, windows上运行，目前由于环境问题，未在macos上验证过，考虑到linux环境做UI自动化的特殊性，不建议在ubuntu, debian等Linux上进行UI自动化
4. **选择器可能变化**: 如果 UI 更新，可能需要更新测试中的选择器, 如果Playwright自带的选择器无法满足，可以使用xpath全部handle,在通用的程序上使用xpath不会带来不稳定

## 改进建议
1. 测试报告应该由自带的报告更换为allure专业的报告，以便于快速定位和原因分析
2. 应该开发单独的全局fixture来管理测试的前置和后置
3. 使用PO模式是最佳的UI自动化组织方式，便于以后测试用例的管理和维护，用例基本不动，只修改selector和page即可
4. 使用allure.tag可以模拟pytest的mark功能，便于用例在执行时按mark分组，mark分组是最灵活有效的用例运行组织模式
5. CICD可以使用jenkins单独控制，也可以使用github已有功能，但不建议把UI自动化作为打包测试的前置，而应该后置
6. 增加E2E测试，只有E2E测试才更符合用户的操作，单元测试占比太高，无法与功能测试相呼应

