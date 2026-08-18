# Cloud Sync 底层实现

Insomnia Cloud Sync（对应 UI 里的 "Insomnia Sync"）是一套**自研的、类 Git 的分布式版本控制系统**，跑在 Electron 主进程里，把工作区（Workspace/Collection）内的文档以内容寻址的快照形式存到本地磁盘，并通过 GraphQL 端到端加密地同步到 Insomnia Cloud。

它和 [Git Sync](../packages/insomnia/src/sync/git/)（`sync/git/`，基于 isomorphic-git）是**两套完全独立**的实现，共用的只有冲突解决弹窗组件。一个 workspace 要么走 Git Sync（`workspaceMeta.gitRepositoryId` 有值），要么走 Cloud Sync。

代码入口：[`packages/insomnia/src/main/cloud-sync/`](../packages/insomnia/src/main/cloud-sync/)。这套代码在 #9827（`refactor: move sync code to main`）之前住在渲染进程的 `src/sync/vcs/`，现在已整体迁到主进程。

---

## 目录

1. [TL;DR：一次 push 都发生了什么](#tldr一次-push-都发生了什么)
2. [进程分层与 IPC 桥](#进程分层与-ipc-桥)
3. [核心数据模型](#核心数据模型)
4. [本地存储层](#本地存储层)
5. [内容寻址与哈希规范化](#内容寻址与哈希规范化)
6. [同步候选集：哪些文档会被同步](#同步候选集哪些文档会被同步)
7. [本地工作流：status → stage → takeSnapshot](#本地工作流status--stage--takesnapshot)
8. [远端工作流：push / pull / fetch](#远端工作流push--pull--fetch)
9. [合并算法](#合并算法)
10. [冲突解决的跨进程往返](#冲突解决的跨进程往返)
11. [加密模型](#加密模型)
12. [网络层与 GraphQL 契约](#网络层与-graphql-契约)
13. [生命周期：初始化、拉取、删除](#生命周期初始化拉取删除)
14. [渲染进程集成](#渲染进程集成)
15. [已知缺陷与设计债](#已知缺陷与设计债)
16. [测试](#测试)

---

## TL;DR：一次 push 都发生了什么

```
渲染进程                          主进程 (VCS 单例)                      Insomnia Cloud
────────                          ─────────────────                      ──────────────
getSyncItems(workspaceId)
  → StatusCandidate[]
        │
        │ window.main.sync.status(candidates)
        ├──── ipcRenderer.invoke('sync.invoke','status',…) ──►
        │                          getStagable(最新快照 state, candidates)
        │                          → { stage, unstaged }
        │ ◄────────────────────────
        │ sync.stage(unstaged)
        ├────────────────────────► 把 blobContent 写进 blobs/（gzip，明文）
        │                          stage 存在内存 _stageByBackendProjectId
        │ sync.takeSnapshot(msg)
        ├────────────────────────► newState = 父快照 state ⊖ staged ⊕ staged
        │                          id = sha1(projectId ‖ parentId ‖ 排序后的 blobIds)
        │                          追加到 branch.snapshots，落盘
        │ sync.push({teamId,…})
        ├────────────────────────► 确保远端 project 存在（首次会生成 AES-256 密钥
        │                            并用每个成员的 RSA 公钥包一份）
        │                          线性历史检查 → blobsMissing ──────────────►
        │                          ◄────────────────────────── missing[]
        │                          对每个 missing blob：读原始 gzip 字节
        │                            → AES-256-GCM 加密 → JSON
        │                          blobsCreate（≤2MB / ≤200 条一批）─────────►
        │                          snapshotsCreate（20 条一批）──────────────►
```

关键点：

- **blob 在本地是 gzip 明文，只有上传前才加密。** 磁盘上的 `version-control/` 目录不是加密存储。
- **stage 只存在内存中**，重启 App 会丢失（blob 内容已落盘，但暂存列表没有）。
- **快照 ID 只由内容决定**，不含消息和时间戳。

---

## 进程分层与 IPC 桥

| 层 | 文件 | 职责 |
| --- | --- | --- |
| 纯算法 | [`core/util.ts`](../packages/insomnia/src/main/cloud-sync/core/util.ts) | 无副作用的 diff / 三方合并 / 哈希 |
| VCS 引擎 | [`core/vcs.ts`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts)（1723 行） | 分支、快照、blob、暂存、push/pull、GraphQL 查询 |
| 存储抽象 | [`core/store/`](../packages/insomnia/src/main/cloud-sync/core/store/) | key→Buffer 的 KV 存储 + 读写 hook |
| 单例 / 上下文 | [`vcs.ts`](../packages/insomnia/src/main/cloud-sync/vcs.ts) | 主进程 VCS 单例、冲突回调、`AsyncLocalStorage` |
| IPC 注册 | [`ipc.ts`](../packages/insomnia/src/main/cloud-sync/ipc.ts) | `sync.invoke` 等 4 个通道 |
| 预加载桥 | [`entry.preload.ts:153-200`](../packages/insomnia/src/entry.preload.ts#L153-L200) | `window.main.sync` |

### `sync.invoke`：反射式单通道 RPC

整个 VCS 的 28 个方法**没有逐个开 IPC 通道**，而是共用一个 `sync.invoke`，方法名作为第一个参数：

```ts
// entry.preload.ts:153
const invokeSyncMethod = async <T>(methodName: string, ...args: unknown[]) => {
  try {
    return (await invokeWithNormalizedError('sync.invoke', methodName, ...args)) as T;
  } catch (error) {
    if (isUserAbortResolveMergeConflictError(error)) { /* 还原错误类型 */ }
    throw error;
  }
};

const sync: SyncBridgeAPI = {
  push: (...args) => invokeSyncMethod('push', ...args),
  pull: (...args) => invokeSyncMethod('pull', ...args),
  // …
};
```

主进程侧用反射派发（[`vcs.ts:73-82`](../packages/insomnia/src/main/cloud-sync/vcs.ts#L73-L82)）：

```ts
export const invokeMainVCS = async (sender, methodName, ...args) => {
  const vcs = getMainVCS();
  const method = vcs[methodName as keyof VCS];
  if (typeof method !== 'function') throw new TypeError(`Unknown VCS method: ${methodName}`);
  return runWithSyncRenderer(sender, () => method.apply(vcs, args));
};
```

> 注意这是**无白名单的反射派发**——渲染进程可以调用 `VCS` 上任意名字的方法，包括 `_queryBlobs`、`_storeBranch` 这些下划线私有方法。类型层面由 `SyncBridgeMethods`（[`ipc.ts:24-56`](../packages/insomnia/src/main/cloud-sync/ipc.ts#L24-L56)）约束，运行时并没有拦截。

例外的三个通道：`sync.pullRemoteBackendProject`（走独立 VCS 实例）、`sync.resolveConflict` / `sync.cancelConflict`（`ipcRenderer.send` 单向）。

`window.main.sync` 的类型声明在 [`main/ipc/main.ts:274`](../packages/insomnia/src/main/ipc/main.ts#L274)，不在 `global.d.ts` 里。

---

## 核心数据模型

定义在 [`src/sync/types.ts`](../packages/insomnia/src/sync/types.ts)。术语和 Git 基本一一对应：

| Cloud Sync | Git 类比 | 说明 |
| --- | --- | --- |
| `BackendProject` | repository | `{ id, name, rootDocumentId }`，`rootDocumentId` = workspace `_id` |
| `Branch` | branch | `{ name, created, modified, snapshots: string[] }`——**快照列表是一个线性数组，不是 DAG** |
| `Snapshot` | commit | `{ id, parent, created, author, name, description, state[] }` |
| `SnapshotStateEntry` | tree entry | `{ key, blob, name }`，`key` = 文档 `_id`，`blob` = 内容哈希 |
| `Blob` | blob | 规范化后的文档 JSON |
| `Stage` | index | `Record<DocumentKey, StageEntry>` |
| `StatusCandidate` | 工作区文件 | `{ key, name, document }`，由渲染进程从 NeDB 收集 |
| `Head` | HEAD | `{ branch: string }` |

**与 Git 最大的结构差异**：`Branch.snapshots` 是一个**扁平有序数组**。合并的共同祖先不是靠遍历父指针求 LCA，而是 [`getRootSnapshot()`](../packages/insomnia/src/main/cloud-sync/core/util.ts#L370-L384) 对两个数组做 O(n·m) 的**倒序双重循环**，找到第一个共同元素：

```ts
for (let ai = snapshotsA.length - 1; ai >= 0; ai--) {
  for (let bi = snapshotsB.length - 1; bi >= 0; bi--) {
    if (snapshotsA[ai] === snapshotsB[bi]) return snapshotsA[ai];
  }
}
```

`Snapshot.parent` 字段存在，但**只用于生成 ID**，从不用于遍历历史。

---

## 本地存储层

### 目录布局

`FileSystemDriver.create(dataPath)` 把根目录固定为 `<userData>/version-control`（[`file-system-driver.ts:15-18`](../packages/insomnia/src/main/cloud-sync/core/store/drivers/file-system-driver.ts#L15-L18)）：

```
version-control/
└── projects/
    └── <backendProjectId>/
        ├── meta.json                      BackendProject
        ├── head.json                      { branch: "master" }
        ├── branches/
        │   ├── master.json                Branch
        │   └── feat~my-branch.json        '/' → '~'（encodeBranchName）
        ├── snapshots/
        │   └── <sha1>.json                Snapshot
        └── blobs/
            └── ab/                        blobId 前 2 位做分片目录
                └── cdef0123…              无扩展名 → gzip 压缩
```

### 三层结构

```
VCS ──► Store ──► BaseDriver
        (序列化 + hook)   (FileSystemDriver / MemoryDriver)
```

[`Store`](../packages/insomnia/src/main/cloud-sync/core/store/index.ts) 负责 JSON 序列化并串联 hook 链；`setItemRaw` / `getItemRaw` 是**绕过 hook 的直通口**。

### gzip hook 的关键规则

[`hooks/compress.ts`](../packages/insomnia/src/main/cloud-sync/core/store/hooks/compress.ts) 只压缩**没有扩展名**的 key：

```ts
const write: HookFn = async (extension, value) => {
  if (extension) return value;      // .json 原样存
  return gzip(value);               // blobs/xx/yyy 压缩
};
```

所以：`meta.json` / `head.json` / `branches/*.json` / `snapshots/*.json` 是可读的 pretty JSON，**只有 blob 被 gzip**。

这条规则和 blob 的读写路径配合得很精巧：

| 方法 | 走 hook? | 得到什么 |
| --- | --- | --- |
| `_getBlob` | ✅ read | gunzip + `JSON.parse` → 文档对象 |
| `_storeBlobs` | ✅ write | 明文 → gzip 落盘 |
| `_getBlobRaw` | ❌ `getItemRaw` | **gzip 原始字节**（直接拿去加密上传） |
| `_storeBlobsBuffer` | ❌ `setItemRaw` | 解密后的 gzip 字节直接落盘 |

也就是说**压缩层是加密层内侧的一层**：`doc → deterministicStringify → gzip → AES-GCM → 上传`，下行完全对称。

### 原子写与 Windows 兼容

`setItem` 先写 `<final>.<uuid>.tmp` 再 rename（[`file-system-driver.ts:35-52`](../packages/insomnia/src/main/cloud-sync/core/store/drivers/file-system-driver.ts#L35-L52)）。Windows 上杀毒软件会锁目录导致 `EACCES`/`EPERM`/`EBUSY`，因此 rename 走 [`gracefulRename`](../packages/insomnia/src/main/cloud-sync/core/store/drivers/graceful-rename.ts)——**最长重试 60 秒**，退避上限 100ms，且首次失败时会 stat 目标确认是文件才继续重试（借鉴自 VS Code）。

### `meta.json` 的写前比较

`_storeBackendProject`（[`vcs.ts:1381-1395`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L1381-L1395)）会先读旧值，用 `deterministicStringify` 做深比较，内容相同就跳过写盘——避免每次激活工作区都触发一次文件写和文件监听风暴。旧文件损坏（JSON 解析失败）时会 catch 掉并正常覆盖写。

---

## 内容寻址与哈希规范化

一切变更检测都归结为一个 blob 哈希：

```ts
// core/util.ts:437-463
export function hash(obj) {
  const content = deterministicStringify(obj);
  return { hash: crypto.createHash('sha1').update(content).digest('hex'), content };
}

export function hashDocument(doc) {
  const newDoc = clone(doc);
  if (newDoc) { deleteKeys(newDoc); resetKeys(newDoc); }
  return hash(newDoc);
}
```

返回的 `content` 同时就是**将来要存进 blob 的字节**——哈希和内容一次算出，保证两者永远一致。

### `deterministicStringify`

[`src/sync/lib/deterministic-stringify.ts`](../packages/insomnia/src/sync/lib/deterministic-stringify.ts)，34 行递归：

- 对象：`Object.keys().sort()` 后按 `"k":v` 拼接——**键序无关**。
- **值序列化为空串的键会被整个丢弃**，`undefined` 因此等价于"键不存在"。
- 数组：保序，但同样剔除空串元素（所以 `[1, undefined, 2]` → `[1,2]`，长度会变，与 `JSON.stringify` 补 `null` 的行为不同）。
- 其他：直接 `JSON.stringify`。没有循环引用检测。

### `ignore-keys`：跨机器稳定性

[`src/sync/ignore-keys.ts`](../packages/insomnia/src/sync/ignore-keys.ts) 处理两类"不该影响哈希"的字段：

| 操作 | 字段 | 原因 |
| --- | --- | --- |
| `deleteKeys` — 删除 | `modified` | 本地时间戳，每次写库都变，否则任何文档都会被判定为"已修改" |
| `resetKeys` — 归一化为 `null` | `Workspace.parentId`、`ProjectLintRuleset.parentId` | 指向**本地** Project 的 `_id`，跨机器/跨组织不同 |

为什么是"重置"而不是"删除"？源码注释说得很清楚：`deterministicStringify` 会丢弃 `undefined` 但保留 `null`，删掉一个曾经存在（哪怕值为 `null`）的键会改变哈希。设成固定默认值才能让所有客户端算出同一个哈希。

代价是：pull 回来的 workspace `parentId` 是 `null`，必须在应用 delta 前修复——见 [`vcs.ts:695-700`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L695-L700) 里那段自称 "hack" 的补丁，和渲染进程的 [`reparentSyncDelta`](../packages/insomnia/src/ui/sync-utils.ts#L50-L63)。

### 快照 ID

```ts
// core/vcs.ts:1710-1719
function _generateSnapshotID(parentId, backendProjectId, state) {
  const hash = crypto.createHash('sha1').update(backendProjectId).update(parentId);
  for (const entry of [...state].sort((a, b) => (a.blob > b.blob ? 1 : -1))) hash.update(entry.blob);
  return hash.digest('hex');
}
```

只由 `(项目 ID, 父快照 ID, 内容集合)` 决定，**不含提交消息、时间戳、作者**。首个快照的父是 `EMPTY_HASH`（40 个 `0`）。含义是：同一父提交下产生完全相同内容的两次提交，会得到同一个 ID。

---

## 同步候选集：哪些文档会被同步

渲染进程的 [`getSyncItems({ workspaceId })`](../packages/insomnia/src/ui/sync-utils.ts#L65-L167) 是唯一的候选集来源。它**不用递归查库**，而是先把所有后代 folder 的 id 拍平成一个数组，再对每种类型做一次 `$in` 查询：

```ts
const listOfParentIds = await flattenFoldersIntoList(activeWorkspace._id);
const reqs = await database.find(models.request.type, { parentId: { $in: listOfParentIds } });
// grpc / websocket / socket.io / requestGroup 同理
```

收集范围：Request / RequestGroup / GrpcRequest / WebSocketRequest / SocketIORequest / UnitTestSuite + UnitTest / MockServer + MockRoute / McpRequest / 基础 Environment + 子 Environment / ApiSpec / Workspace 本身，外加**项目级**的 `ProjectLintRuleset`（挂在 `workspace.parentId` 下，不是 workspace 的后代，所以要单独取）。

最后统一过 [`models.canSync`](../packages/insomnia-data/src/models/index.ts#L31-L43)：

```ts
export function canSync(d: BaseModel) {
  if (d.isPrivate) return false;          // 私有文档一律不同步
  return getModel(d.type)?.canSync || false;
}
```

`canSync = true` 的 18 个模型：`workspace`、`request`、`request-group`、`grpc-request`、`web-socket-request`、`socket-io-request`、`socket-io-payload`、`websocket-payload`、`mcp-request`、`environment`、`api-spec`、`mock-server`、`mock-route`、`unit-test`、`unit-test-suite`、`proto-file`、`proto-directory`、`project-lint-ruleset`。

明确**不同步**的：`cookie-jar`、所有 `*-meta`、`*-certificate`、`oauth-2-token`、`git-*`、`project`、`plugin-data`、`request-version`、`response`、`cloud-credential`、`mcp-payload/response`。也就是说 **Cookie 罐、证书、令牌、各类本地 UI 状态都不上云**。

初始化路径用的是另一套候选集构建（[`initialize-backend-project.ts:31-42`](../packages/insomnia/src/sync/vcs/initialize-backend-project.ts#L31-L42)），走 `database.getWithDescendants(workspace)` + lint ruleset，同样过 `canSync`。

---

## 本地工作流：status → stage → takeSnapshot

### `status(candidates)`

[`vcs.ts:265-329`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L265-L329)。核心是 [`getStagable(state, candidates)`](../packages/insomnia/src/main/cloud-sync/core/util.ts#L315-L368)，把「最新快照的 state」和「当前候选集」求并集后逐 key 比较：

| 快照有 | 候选有 | 结果 |
| --- | --- | --- |
| ✗ | ✓ | `{ added: true, blobId, blobContent }` |
| ✓ | ✗ | `{ deleted: true, blobId }` |
| ✓ | ✓ 且哈希不同 | `{ modified: true, blobId, blobContent }` |
| ✓ | ✓ 且哈希相同 | 无变更 |

`status` 再逐条分流：已在 `stage` 里且 blobId 一致的算已暂存（**从 `unstaged` 中整条略过**），其余进 `unstaged`。

每条 unstaged 还会附上 `previousBlobContent` 供 diff UI 展示，而它的**来源是条件性的**：

| 该 key 在暂存区 | `previousBlobContent` 取自 |
| --- | --- |
| 不在 | 上一个快照的 blob（即 HEAD） |
| 在，但 blobId 不同 | **暂存区里的 `blobContent`**（即 index） |

第二行是刻意向 Git 语义对齐的补丁——详见 [枚举基准是 HEAD 而非 index](#枚举基准是-head-而非-index)。

返回值里的 `key: hash({stage, unstaged}).hash` 是给 UI 做变更检测的廉价指纹。

#### 枚举基准是 HEAD 而非 index

这是与标准 Git 的一处**语义偏差**。Git 的 `git status` 两栏基准不同：

```
Git:       staged   = index      vs HEAD
           unstaged = 工作区      vs index          ← 基准是 index

Insomnia:  getStagable(snapshot.state, candidates)  ← 基准是 HEAD
             ↓ 再按 stage 过滤/改写 previousBlobContent
```

Insomnia 先用 **HEAD** 枚举出所有变更，再拿暂存区做二次过滤，并在冲突时把 diff 基准**改写**回暂存内容。这个补丁让常见场景的可观察行为与 Git 一致：

| 场景 | Git | Insomnia | 一致? |
| --- | --- | --- | --- |
| 改了没暂存 | 仅出现在 unstaged | 同 | ✅ |
| 暂存后没再动 | 仅出现在 staged | blobId 相同 → 从 unstaged 略过 | ✅ |
| 暂存后又改 | 两栏都出现，unstaged diff = 工作区 vs index | 两栏都出现，`previousBlobContent` 改写为暂存内容 | ✅ |
| **暂存后又改回原样** | 两栏都出现（unstaged 显示一个反向改动） | `getStagable` 认为工作区 == HEAD → **不产生任何条目**，unstaged 为空 | ❌ |

最后一行是真正的分歧。此时暂存区里仍留着那条已经不再反映工作区的改动，而 UI 显示"没有待暂存的更改"；若直接提交，[`takeSnapshot`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L642-L656) 用的是暂存条目里的 `blobId`，会把用户已经撤销的旧内容提交上去。

> 参见单测 [`can appear both staged and unstaged`](../packages/insomnia/src/main/cloud-sync/core/__tests__/vcs.test.ts#L327-L390)，它固化了第三行的行为；第四行没有测试覆盖。
>
> 另：`blobId: entry.blobId || stageEntry.blobId`（[vcs.ts:314](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L314)）的 `||` 分支是死代码——能走到这里的 `added`/`modified` 条目 `blobId` 必为非空 sha1。

### `stage(entries)`

[`vcs.ts:332-351`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L332-L351)。做两件事：

1. **立刻把 `blobContent` 写进 blob 存储**（`added`/`modified` 才写，`deleted` 不写）。这意味着提交时不需要回头读数据库——blob 已经在磁盘上了。
2. 把条目记进 `this._stageByBackendProjectId[projectId]`。

⚠️ **暂存区是纯内存的**。`_stageByBackendProjectId` 是 VCS 实例上的一个普通对象，从不落盘。App 重启后暂存列表清空（blob 仍在，成为孤儿数据），需要重新 `status` + `stage`。

### `takeSnapshot(name)`

[`vcs.ts:614-666`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L614-L666)：

```
新 state = (父快照 state 中所有未被暂存的条目)
         ∪ (暂存区中所有非 deleted 的条目)
```

暂存区为空或消息为空会直接抛错。随后 `_createSnapshotFromState` 生成 ID、把 ID 追加到 `branch.snapshots`、落盘分支和快照，最后**清空暂存区**。

`author` 此时留空字符串，push 时才用当前 `accountId` 回填（[`vcs.ts:1055-1058`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L1055-L1058)）——这是为了支持离线未登录时提交。

---

## 远端工作流：push / pull / fetch

### `push({ teamId, teamProjectId })`

[`vcs.ts:732-770`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L732-L770)：

1. `_getOrCreateRemoteBackendProject` — 远端不存在就创建（触发密钥生成，见[加密模型](#加密模型)）。
2. **线性历史检查**：逐位比对远端 `branch.snapshots[i]` 和本地 `branch.snapshots[i]`，任一位不等就抛 `Remote history conflict. Please pull latest changes and try again`。等价于要求「本地历史必须是远端历史的前缀扩展」——**永远不会 force push**。
3. 取 `snapshots.slice(lastMatchingIndex)`，为空则抛 `Already up to date`。
4. 汇总这些快照引用的全部 blobId，调 `blobsMissing` 问服务端缺哪些。
5. `_queryPushBlobs(missing)` — 逐个读 `_getBlobRaw`（gzip 字节）→ AES-GCM 加密 → 攒批，**按 2MB 或 200 条**触发一次 `blobsCreate`。
6. `_queryPushSnapshots` — 每 20 条一批 `snapshotsCreate`，返回值再写回本地（服务端可能补全了 `authorAccount` 等字段）。

### `pull({ candidates, teamId, teamProjectId, projectId })`

[`vcs.ts:668-703`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L668-L703) 的实现相当巧妙——**pull 被实现成"把远端抓成一个临时本地分支，再合并进来"**：

```ts
const localBranch = await this._getCurrentBranch();
const tmpBranchForRemote = await this.customFetch(localBranch.name + '.hidden', localBranch.name);
const delta = await this._merge(candidates, localBranch.name, tmpBranchForRemote.name,
                                `Synced latest changes from ${localBranch.name}`,
                                true /* useOtherBranchHistory */);
await this._removeBranch(tmpBranchForRemote);
```

`useOtherBranchHistory = true` 是关键：合并后**本地分支直接采用远端的快照数组**，再把合并结果追加上去。这样本地历史永远是远端历史的前缀扩展，下一次 push 必定能通过第 2 步的线性检查。

`.hidden` 后缀还被用来做冲突弹窗的标签美化（[`vcs.ts:883-885`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L883-L885)）：检测到分支名含 `.hidden` 时，标签显示成 `master local` vs `master remote` 而不是 `master` vs `master.hidden`。

返回的 `Operation { upsert, remove }` 由渲染进程用 `database.batchModifyDocs` 应用到 NeDB。

### `customFetch(localBranchName, remoteBranchName)`

[`vcs.ts:772-818`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L772-L818)。只抓本地缺失的部分：

1. 遍历远端分支的快照 ID，本地没有的进 `snapshotsToFetch`。
2. `_querySnapshots`（20 条一批）拉快照。
3. 遍历这些快照的 state，`_hasBlob` 为 false 的进 `blobsToFetch`。
4. `_queryBlobs`（50 条一批）拉 blob → RSA 解出项目对称密钥 → AES-GCM 解密 → `_storeBlobsBuffer` 直接落盘（仍是 gzip 态）。
5. 克隆远端分支对象，改名、刷新时间戳、落盘。

---

## 合并算法

`_merge(candidates, trunk, other, message?, useOtherBranchHistory?)`（[`vcs.ts:820-910`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L820-L910)）的决策顺序：

```
preMergeCheck(trunkState, otherState, candidates)
  ├─ conflicts 非空 → throw '请先提交或还原当前更改'
  └─ dirty[]（安全的本地未提交改动，最终从 delta 里剔除以保留）

if (other 的最新快照 === 共同祖先) || (other 无快照)     → 什么都不做
else if (共同祖先 === trunk 最新快照) || (trunk 无快照)  → fast-forward：trunk.snapshots = other.snapshots
else                                                     → 三方合并
```

### `preMergeCheck`

[`util.ts:386-434`](../packages/insomnia/src/main/cloud-sync/core/util.ts#L386-L434) 把每个工作区候选分成三类：

| 情况 | 分类 |
| --- | --- |
| trunk 和 other 都没有该 key | **dirty**（全新的本地文档，保留） |
| 候选哈希 == trunk | 干净，忽略 |
| 候选哈希 == other | 干净（合并后会变成同一个值），忽略 |
| trunk == other 但候选不同 | **dirty**（安全的本地改动，保留） |
| 其余 | **conflict** → 中止合并 |

`dirty` 的文档最终会被从返回的 delta 里过滤掉（[`vcs.ts:905-909`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L905-L909)），这样用户未提交的本地编辑不会被合并结果覆盖。

### `threeWayMerge`

[`util.ts:66-238`](../packages/insomnia/src/main/cloud-sync/core/util.ts#L66-L238) 把 `(root, trunk, other)` 的 12 种组合**全部显式展开**（源码注释明确说"本可以简化，但我们要展开每种情况以尽可能防弹且可读"）：

| # | 情况 | 结果 |
| --- | --- | --- |
| 1 | 三者相同 | 保留 trunk |
| 2 | 两边都删 | 删除 |
| 3 | trunk 删、other 未改 | 删除 |
| 4 | other 删、trunk 未改 | 删除 |
| 5 | 两边都新增 | 哈希不同 → **冲突**（默认选 other） |
| 6 | 仅 trunk 新增 | 保留 trunk |
| 7 | 仅 other 新增 | 采用 other |
| 8 | 两边都改 | 哈希不同 → **冲突**（默认选 other） |
| 9 | 仅 trunk 改 | 保留 trunk |
| 10 | 仅 other 改 | 采用 other |
| 11 | trunk 删、other 改 | **冲突**（默认选 other，即"复活"） |
| 12 | other 删、trunk 改 | **冲突**（默认选 trunk，即"保留"） |
| — | 兜底 | `throw new Error('3-way merge hit impossible state')` |

注意所有 `choose` 默认值都偏向**保留数据**而非丢弃：情况 11/12 都倾向保留被修改的那一侧。

冲突产生后，`_merge` 会先把 `mineBlob`/`theirsBlob` 的**实际文档内容**读出来附加到冲突对象上（供 UI 做 diff），再交给 `conflictHandler`，最后用 [`updateStateWithConflictResolutions`](../packages/insomnia/src/main/cloud-sync/core/util.ts#L465-L496) 应用用户的选择（`choose === null` 表示删除该条目）。

### `checkout` / `rollback`

两者都基于 [`stateDelta(base, desired)`](../packages/insomnia/src/main/cloud-sync/core/util.ts#L283-L313)，产出 `{ add, update, remove }`，再转成 `{ upsert, remove }` 的文档数组交给渲染进程写库。`checkout` 同样会先 `preMergeCheck`，有冲突则拒绝切分支（`Please commit current changes before switching branches`），并把 dirty 项从 delta 中剔除以保留本地改动。

---

## 冲突解决的跨进程往返

VCS 跑在主进程，冲突弹窗在渲染进程，而 `_merge` 是一个必须**同步等待用户决策**的 `await`。解法是 `AsyncLocalStorage` + 待决 Promise 表（[`main/cloud-sync/vcs.ts`](../packages/insomnia/src/main/cloud-sync/vcs.ts)）：

```
渲染进程                                主进程
────────                                ──────
sync.invoke('merge', …)
   ├──────────────────────────────►  runWithSyncRenderer(sender, () => vcs.merge(…))
   │                                   syncInvocationContext.run({ sender }, …)
   │                                        │
   │                                   _merge → handleAnyConflicts → conflictHandler
   │                                        │
   │                                   requestConflictResolution(conflicts, labels)
   │                                     handlerId = randomUUID()
   │                                     context.sender.send('sync.merge-conflicts', {…})
   │ ◄─────────────────────────────       return new Promise(...)  ← merge 在此挂起
   │                                       pendingConflictResolutions.set(handlerId, {senderId, resolve, reject})
   │
 SyncMergeModal 弹出
   │
   │ sync.resolveConflict({handlerId, conflicts})
   ├──────────────────────────────►  校验 senderId 一致 → resolve(conflicts)
   │                                   merge 恢复执行，生成合并快照
   │ ◄─────────────────────────────   返回 Operation delta
```

要点：

- `AsyncLocalStorage` 保证嵌套多层的 `_merge` 调用能拿到**发起这次调用的那个 `WebContents`**，不需要把 sender 一路透传。
- `pendingConflictResolutions` 记录了 `senderId`，`resolvePendingSyncConflict` / `cancelPendingSyncConflict` 会校验回应来自同一个渲染进程（[`vcs.ts:95-98`](../packages/insomnia/src/main/cloud-sync/vcs.ts#L95-L98)），防止跨窗口串扰。
- 取消路径 reject 一个 `UserAbortResolveMergeConflictError`。IPC 序列化会丢失原型链，所以 preload 在 [`entry.preload.ts:157-161`](../packages/insomnia/src/entry.preload.ts#L157-L161) 按 `name` 重新构造该错误类型，branch/merge 路由再据此静默吞掉（用户主动取消不算失败）。
- 渲染进程的监听器只注册一次（模块级 `hasRegisteredConflictListener` 布尔，[`ui/utils/insomnia-sync.ts:6-15`](../packages/insomnia/src/ui/utils/insomnia-sync.ts#L6-L15)），在 `entry.client.tsx` 启动时调用。
- 弹窗以任意方式关闭（Esc / 点遮罩）都会走 `onOpenChange` → `onCancelUnresolved`，不会让主进程的 Promise 永久悬挂。

`SyncMergeModal` 是 Cloud Sync 和 Git Sync **共用**的组件，区别在 `editorType`：Cloud Sync 默认 `'diff'`（二选一），Git Sync 用 `'merge'`（手动编辑），对应 `resolutionSource` 的 `CHOOSE` / `MANUAL`。

---

## 加密模型

Cloud Sync 是**端到端加密**的：服务端只看到密文 blob，看不到请求 URL、Header、脚本内容。

### 密钥层级

```
用户 RSA 密钥对 (RSA-OAEP-256)
  ├─ publicKey  (JWK, 明文存 UserSession)
  └─ encPrivateKey ──[AES-GCM, 用会话 symmetricKey 解]──► privateKey (JWK)
                                  │
                                  ▼
        每个 BackendProject 一把 AES-256-GCM symmetricKey
          创建项目时客户端生成，用**每个团队成员的 RSA 公钥**各包一份
          → projectCreate(teamKeys: [{accountId, encSymmetricKey, autoLinked}])
                                  │
                                  ▼
                     blob 内容：AES-256-GCM(gzip(规范化 JSON))
```

### 项目密钥的生成与分发

创建远端项目时（[`_queryCreateProject`, vcs.ts:1277-1347](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L1277-L1347)）：

```ts
const symmetricKey = await generateAES256KeyInNode();     // WebCrypto AES-GCM/256，导出为 JWK
const symmetricKeyStr = JSON.stringify(symmetricKey);

for (const { accountId, publicKey, autoLinked } of teamPublicKeys || []) {
  teamKeys.push({ accountId, autoLinked,
    encSymmetricKey: crypt.encryptRSAWithJWK(JSON.parse(publicKey), symmetricKeyStr) });
}
```

成员公钥来自 `teamMemberKeys(teamId)` 查询。`generateAES256KeyInNode`（[`vcs.ts:64-87`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L64-L87)）优先用 `crypto.webcrypto.subtle`，降级到 `crypto.randomBytes(32)`。

使用时反向解包（[`_getBackendProjectSymmetricKey`, vcs.ts:1358-1369](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L1358-L1369)）：

```ts
const encSymmetricKey = await this._queryBackendProjectKey();      // projectKey(projectId)
const symmetricKeyStr = crypt.decryptRSAWithJWK(privateKey, encSymmetricKey);
return JSON.parse(symmetricKeyStr);
```

> ⚠️ `PLAYWRIGHT_TEST` 下会短路，直接用会话对称密钥（[`vcs.ts:1361-1364`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L1361-L1364)），仅用于 E2E。

### 原语

全部在 [`common/account/crypt.ts`](../packages/insomnia/src/common/account/crypt.ts)，基于 **node-forge**（纯 JS），只有密钥生成用 WebCrypto。

| 函数 | 算法 | 说明 |
| --- | --- | --- |
| `encryptAESBuffer` | AES-256-GCM，12 字节随机 IV，128 位 tag | 直接加密字节，**不做 URI 编码**（区别于 `encryptAES`） |
| `decryptAESToBuffer` | 同上 | tag 长度由密文推导：`tagLength: encryptedResult.t.length * 4` |
| `encryptRSAWithJWK` | RSA-OAEP + SHA-256 | 强制校验 `alg === 'RSA-OAEP-256'`；先 `encodeURIComponent`，输出 hex |
| `decryptRSAWithJWK` | 同上 | 需要完整 CRT 私钥（`n,e,d,p,q,dp,dq,qi`） |

AES 密文的线上格式（`AESMessage`，全部小写 hex）：

```json
{ "iv": "…12字节…", "t": "…16字节tag…", "ad": "", "d": "…密文…" }
```

blob 上传时会 `JSON.stringify(encryptedResult, null, 2)` 后作为 GraphQL 的 `content` 字段。

### 完整的 blob 管线

```
上行： BaseModel
       → clone + deleteKeys(modified) + resetKeys(parentId)
       → deterministicStringify                     ← blobId = sha1(这一步的输出)
       → Buffer(utf8)                               ← _storeBlobs
       → gzip                                       ← compress hook (无扩展名)
       ═══ 落盘 version-control/projects/…/blobs/xx/yyy ═══
       → AES-256-GCM(项目对称密钥)                    ← _queryPushBlobs
       → JSON.stringify({iv,t,ad,d})
       → GraphQL blobsCreate

下行： 完全对称（_queryBlobs 解密 → _storeBlobsBuffer 直接写 gzip 字节 → _getBlob 走 hook 解压 + parse）
```

### 安全边界说明

端到端加密是**相对服务端**成立的，本地磁盘并不加密：

- `version-control/` 下的 blob 只做了 gzip，没有加密。
- 会话对称密钥 `symmetricKey` 以**明文 JWK** 存在本地 NeDB 的 `UserSession` 文档里（[`insomnia-data/src/models/user-session.ts`](../packages/insomnia-data/src/models/user-session.ts)），`encPrivateKey` 只是相对它加密。也就是说拿到本地 NeDB 文件即可解出 RSA 私钥。此处**未使用** Electron `safeStorage`（`safeStorage` 只用于 [`main/ipc/secret-storage.ts`](../packages/insomnia/src/main/ipc/secret-storage.ts) 的其他场景）。
- `getPrivateKey()` 每次调用都重新读库 + 解密，**没有缓存**；而 `_assertSession()` 在每次拉取项目密钥时都会调它。

---

## 网络层与 GraphQL 契约

### 传输

[`runVcsGraphQL`](../packages/insomnia-api/src/vcs.ts) 是一层极薄的包装：

```ts
return fetch({ method: 'POST', path: '/graphql?' + name, data: { query, variables }, sessionId });
```

操作名被拼进 query string（`/graphql?blobsCreate`）**纯粹为了可观测性**，服务端不依赖它。

底层是 [`insomniaFetch`](../packages/insomnia/src/common/insomnia-fetch.ts)：

- **Base URL**：`env.INSOMNIA_API_URL || 'https://api.insomnia.rest'`
- **认证 Header**：`X-Session-Id: <sessionId>`，外加 `X-Insomnia-Client`、`insomnia-request-id`、`X-Origin`
- **超时**：`AbortSignal.timeout(30_000)`
- **重试**：**没有**。`retries` 参数被接收但完全忽略（源码有 `// It's not used at all, should be removed?` 注释）
- 主进程用 Electron `net.fetch`，因此走系统代理和系统证书

错误分两层：HTTP 非 2xx 抛 `ResponseFailError`；HTTP 200 但 GraphQL `errors[]` 非空由 VCS 自己处理（[`vcs.ts:937-956`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L937-L956)）：

```ts
if (errors?.length) throw new Error(`Failed to query ${name}: ${errors[0].message}`);
if (data == null)   throw new Error(`Failed to query ${name}: no data returned`);
```

含 `invalid access` 的错误会被 [`interceptAccessError`](../packages/insomnia/src/sync/access-error.ts) 改写成用户可读的权限提示。

### GraphQL 操作全集

Query：

| 操作 | 变量 | 返回 | 调用点 |
| --- | --- | --- | --- |
| `projects` | `teamId`, `teamProjectId` \| `allProjects` | `[{id,name,rootDocumentId,teamProjectId,teams}]` | `remoteBackendProjects` / `…OfTeam` |
| `project` | `id` | `{id,name,rootDocumentId}` \| `null` | `_queryProject` |
| `branches` | `project` | `[{name}]` | `getRemoteBranchNames` |
| `branch` | `project`, `name` | `{created,modified,name,snapshots}` | `_queryBranch` |
| `snapshots` | `ids`, `project` | 完整快照 + `authorAccount` | `_querySnapshots`（20/批） |
| `blobs` | `ids`, `project` | `[{id, content}]` content 为加密 JSON | `_queryBlobs`（50/批） |
| `blobsMissing` | `project`, `ids` | `{missing:[id]}` | push 前询问 |
| `projectKey` | `projectId` | `{encSymmetricKey}` | 取项目对称密钥 |
| `teamMemberKeys` | `teamId` | `{memberKeys:[{accountId,publicKey,autoLinked}]}` | 建项目时分发密钥 |

Mutation：

| 操作 | 变量 | 返回 |
| --- | --- | --- |
| `projectCreate` | `name,id,rootDocumentId,teamId,teamProjectId,teamKeys` | `{id,name,rootDocumentId}` |
| `projectArchive` | `id` | `Boolean` |
| `branchRemove` | `project`, `name` | `Boolean` |
| `snapshotsCreate` | `project`, `snapshots`, `branch` | 回显创建的快照 |
| `blobsCreate` | `project`, `blobs` | `{count}` |

> 服务端契约的可执行文档在 [`packages/insomnia-smoke-test/server/cloud-sync-api.ts`](../packages/insomnia-smoke-test/server/cloud-sync-api.ts)——它用 Node 原生 `crypto` 实现了同样的 AES-GCM 格式并做完整的解密 → gunzip 往返校验，可以当作 wire format 的权威参考。

### 批量与分片策略

| 操作 | 分片 |
| --- | --- |
| `_querySnapshots` / `_queryPushSnapshots` | 20 条/批 |
| `_queryBlobs` | 50 条/批 |
| `_queryPushBlobs` | **2 MB 或 200 条**，先到先触发 |

没有并发控制——所有批次串行发送。

---

## 生命周期：初始化、拉取、删除

### 首次为一个 workspace 建立同步

[`initializeLocalBackendProjectAndMarkForSync`](../packages/insomnia/src/sync/vcs/initialize-backend-project.ts#L16-L53)：

```
switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name)
  → 本地生成 BackendProject { id: generateId('prj'), rootDocumentId: workspace._id }
候选集 = getWithDescendants(workspace) + projectLintRuleset，过 canSync
status → stage(全部 unstaged) → takeSnapshot('Initial Snapshot')
workspaceMeta.pushSnapshotOnInitialize = true
```

注意此时**只建本地项目，不碰网络**。真正的远端项目要等到第一次 push（`_getOrCreateRemoteBackendProject`）才创建。

`pushSnapshotOnInitialize` 随后在满足「project 就是 workspace 的父级 且 project 有 `remoteId` 且 VCS 已激活项目」时执行 push，并把标志位清掉。这里有一段注释解释了为什么要判 `hasBackendProject()`——历史上 App.tsx 的 React key 变更会导致该路径被走两次。

主进程侧的两个入口（[`initialization.ts`](../packages/insomnia/src/main/cloud-sync/initialization.ts)）：

- `initializeWorkspaceBackendProject` — 未登录直接返回；**`workspaceMeta.gitRepositoryId` 有值时跳过**（Git Sync 优先）。
- `syncNewWorkspaceIfNeeded` — 用于导入等场景。额外检查 `models.project.isRemoteProject(project)` 和组织的 [`storageRules.enableCloudSync`](../packages/insomnia/src/common/organization-storage-rules.ts)（Scratchpad 组织恒为 `false`）。失败只 `console.warn`，留待下次打开工作区重试。

### 拉取一个远端已有的 collection

[`pullRemoteBackendProjectWithSingleton`](../packages/insomnia/src/main/cloud-sync/vcs.ts#L116-L157) → [`pullBackendProject`](../packages/insomnia/src/main/cloud-sync/pull-backend-project.ts)：

```
用单例 VCS 做只读的 remoteBackendProjects 列表查询
另建一个**独立的 VCS 实例**执行实际拉取     ← 避免污染单例的 _backendProject
removeBackendProjectsForRoot(rootDocumentId)  ← 清理同 root 的陈旧本地项目
setBackendProject → checkout([], 'master') → getRemoteBranchNames
  ├─ 远端没有 master → 只在本地建一个空 workspace 壳
  └─ 有 master → pull([]) → allDocuments() 逐条写库
       · Workspace.parentId  → 本地 project._id
       · ProjectLintRuleset.parentId → 本地 project._id
       · 用 bufferChanges / flushChanges 包住，避免逐条触发 UI revalidation
```

独立实例这一点在源码里有明确注释：单例的 `_backendProject` 是可变状态，并发的 `sync.invoke` 会互相干扰。

### 删除

[`workspace.delete.tsx`](../packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.delete.tsx) 先 `switchAndCreateBackendProjectIfNotExist` 定位项目，然后：

- 本地 project → `removeBackendProjectsForRoot(rootDocumentId)`（只删本地 `meta.json`）
- 远端 project → `archiveProject()`（`projectArchive` mutation + 删本地 meta + 清空 `_backendProject`）

---

## 渲染进程集成

### 路由表

Cloud Sync 的所有操作都是 flat-file 路由的 `clientAction`/`clientLoader`（`src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.*.tsx`）：

| 路由 | 调用的 VCS 方法 |
| --- | --- |
| `insomnia-sync` | `localBackendProjects`, `remoteBackendProjects` → 可拉取列表 |
| `insomnia-sync/sync-data` | loader：`getBranchNames`、`getCurrentBranchName`、`getHistory`、`getHistoryCount`、`status`、`getRemoteBranchNames`、`compareRemoteBranch`、`remoteBackendProjects`；并回写 `workspaceMeta.{hasUncommittedChanges,hasUnpushedChanges}` |
| `insomnia-sync/push` | `push` |
| `insomnia-sync/pull` | `pull` + `batchModifyDocs(reparentSyncDelta(delta))` |
| `insomnia-sync/create-snapshot` | `takeSnapshot`，可选紧接 `push` |
| `insomnia-sync/stage` · `/unstage` | `status` → `stage` / `unstage` |
| `insomnia-sync/rollback` · `/restore` | `rollbackToLatest` / `rollback(id)` + `batchModifyDocs` |
| `insomnia-sync/fetch` | `checkout` → `pull([])` → 失败则 `checkout` 回原分支 |
| `insomnia-sync/branch/checkout` · `/create` · `/merge` · `/delete` | `checkout` / `fork`+`checkout` / `merge` / `removeRemoteBranch`+`removeBranch` |
| `/organization/:id/insomnia-sync/pull-remote-file` | `pullRemoteBackendProject` |

**每一个产出 delta 的路由都必须在 `batchModifyDocs` 前调用 [`reparentSyncDelta`](../packages/insomnia/src/ui/sync-utils.ts#L50-L63)**，否则 `ProjectLintRuleset` 会带着 `parentId: null` 落库。

另有两个非 `insomnia-sync/*` 的调用点：workspace 根路由的 loader（`switchAndCreateBackendProjectIfNotExist` + `pushSnapshotOnInitialize` + `getVersion`），以及 workspace 删除路由。前者直接把 `window.main.sync` 当作 `SyncVCSLike` 传进去——接口设计成结构化类型正是为此。

### UI 与刷新节奏

- [`sync-bar.tsx`](../packages/insomnia/src/ui/components/sidebar/sync-bar.tsx) 是纯分发器；[`workspace-sync-dropdown.tsx`](../packages/insomnia/src/ui/components/dropdowns/workspace-sync-dropdown.tsx) 判断 `isRemoteProject(project) && !workspaceMeta.gitRepositoryId` 才渲染 Cloud Sync 的 [`sync-dropdown.tsx`](../packages/insomnia/src/ui/components/dropdowns/sync-dropdown.tsx)。
- **轮询**：`useInterval(triggerSync, isWindowFocused ? 60_000 : null)`——窗口聚焦时每分钟刷新一次远端状态，失焦即暂停；窗口重新聚焦（`mainWindowFocusChange`）也触发一次。
- **事件驱动**：[`insomnia-event-stream-context.tsx`](../packages/insomnia/src/ui/context/app/insomnia-event-stream-context.tsx) 收到 SSE 的 `FileChanged` / `BranchDeleted` 时立即重新提交 sync-data action，是轮询之外的第二条刷新路径。
- **模块级缓存**：`remoteBranchesCache` / `remoteCompareCache` / `remoteBackendProjectsCache`（[`ui/sync-utils.ts:46-48`](../packages/insomnia/src/ui/sync-utils.ts#L46-L48)），由各 action 显式失效。
- 徽标：`pullCount = compare.behind` / `pushCount = compare.ahead`，`compare` 来自 [`compareBranches`](../packages/insomnia/src/main/cloud-sync/core/util.ts#L240-L275)（同样基于共同祖先在两个数组中的下标）。

---

## 已知缺陷与设计债

按影响面排序，均为阅读代码得出的事实，未做运行时验证：

1. **暂存区不持久化。** `_stageByBackendProjectId`（[`vcs.ts:109`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L109)）是纯内存对象，App 重启即丢。已写入的 blob 成为无人引用的孤儿文件，且没有 GC 机制。

2. **"暂存后改回原样"会提交陈旧内容。** `status` 的枚举基准是 HEAD 而非暂存区，工作区与 HEAD 一致时不产生任何条目，于是暂存区里那条已失效的改动既不显示为待暂存、也不会被清理，提交时按暂存的 `blobId` 写进快照。详见[枚举基准是 HEAD 而非 index](#枚举基准是-head-而非-index)。

3. **分支文件名大小写不对称。** `_storeBranch` 写路径带 `.toLowerCase()`，而 `_getBranch` / `_removeBranch` 不带（[`vcs.ts:1448` / `:1620` / `:1627`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L1448)）。在大小写敏感的文件系统（Linux、部分 macOS 配置）上，含大写字母的分支名写进去就读不出来。源码自己留了注释 `// toLowerCase may introduce issues under case sensitive filesystems`。

4. **单例 VCS 的可变状态。** `_backendProject` 是实例字段，所有 `sync.invoke` 共享一个单例。并发操作不同工作区会互相覆盖当前项目。`pullRemoteBackendProjectWithSingleton` 专门用独立实例规避了这一点，但常规路径没有任何串行化或锁。**已通过可控复现坐实为具体机制**（`initializeLocalBackendProjectAndMarkForSync` 的 switch→status→stage→takeSnapshot 链路中途被另一个 workspace 的后台刷新顶替 `_backendProject`，导致一个 workspace 的提交连同"删除原有内容"一起被写进另一个 workspace 的 BackendProject），完整因果链、复现步骤和日志证据见 [RCA：单例 VCS 状态被并发请求顶替](cloud-sync-rca-backend-project-hijack.md)。

5. **`Workspace.parentId` 归零后需要两处补丁。** 主进程 `pull` 里有一段自述为 hack 的修复（`// …this is a hack to restore those parentIds until we have a chance to redesign vcs`），渲染进程还要再跑一次 `reparentSyncDelta` 处理 `ProjectLintRuleset`。任何新增的"父级不稳定"模型都得同时改这两处。

6. **`decryptAESToBuffer` 的 tag 长度来自密文。** `tagLength: encryptedResult.t.length * 4`——若 blob 来源不可信，认证强度可被外部影响。

7. **无重试、无退避。** 30 秒超时后整个 push/pull 失败，需要用户手动重来。大集合首次 push 要串行发很多批，中途断网就得从头再来（`blobsMissing` 会让重试跳过已上传的 blob，所以重试成本尚可接受）。

8. **`getRootSnapshot` 是 O(n·m)。** 长历史分支的合并会随快照数平方增长。

9. **`sync.invoke` 无方法白名单。** 见[进程分层](#syncinvoke反射式单通道-rpc)。

10. **死代码**：[`src/sync/delta/`](../packages/insomnia/src/sync/delta/)（`diff.ts` / `patch.ts`）在整个仓库中已无任何引用。

11. **文件顶部遗留的 TODO**（[`core/vcs.ts:1-3`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L1-L3)）：`Rename things that run a fetch to fetchSomething...` / `Make sure that pull handles updating the parentId to the current project._id`。

---

## 测试

| 层 | 文件 | 覆盖 |
| --- | --- | --- |
| 纯算法 | [`core/__tests__/util.test.ts`](../packages/insomnia/src/main/cloud-sync/core/__tests__/util.test.ts)（1006 行） | `threeWayMerge` 全 12 分支、`stateDelta`、`getStagable`、`preMergeCheck`、`compareBranches`、`hash`/`hashDocument` |
| VCS | [`core/__tests__/vcs.test.ts`](../packages/insomnia/src/main/cloud-sync/core/__tests__/vcs.test.ts)（1153 行） | `status`/`stage`/`takeSnapshot`/`fork`/`merge`/`getHistory`/分支名校验/`_storeBackendProject` 写前比较。用 `MemoryDriver`，并在文件内 mock `generateId` 以固定快照哈希 |
| 存储 | [`store/__tests__/index.test.ts`](../packages/insomnia/src/main/cloud-sync/core/store/__tests__/index.test.ts)、[`hooks/__tests__/compress.test.ts`](../packages/insomnia/src/main/cloud-sync/core/store/hooks/__tests__/compress.test.ts) | CRUD、Buffer 直存、hook 链、扩展名压缩规则 |
| 初始化 | [`main/__tests__/sync-initialization.test.ts`](../packages/insomnia/src/main/__tests__/sync-initialization.test.ts) | 登录态 / git 仓库 / storage rules 的分支逻辑 |
| 冲突监听 | [`ui/utils/__tests__/insomnia-sync.test.ts`](../packages/insomnia/src/ui/utils/__tests__/insomnia-sync.test.ts) | 监听器注册幂等性 |
| E2E | [`insomnia-smoke-test/tests/smoke/cloud-sync.test.ts`](../packages/insomnia-smoke-test/tests/smoke/cloud-sync.test.ts) | Discard/branch/commit、Push、本地+远端删除；配 [mock GraphQL 服务端](../packages/insomnia-smoke-test/server/cloud-sync-api.ts) |

跑法：

```bash
npm test -w packages/insomnia          # 单元测试
npm run test:smoke:dev -- "Cloud Sync" # E2E
```
