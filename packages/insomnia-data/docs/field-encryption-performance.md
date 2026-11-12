# NeDB 字段级加密:性能优化

配套文档:[field-encryption-design.md](./field-encryption-design.md)。

## 1. 实施方式

分两步实施,这样每一项优化的效果都能单独度量:

1. **Baseline(已实现):** 按 `field-encryption-design.md` 原样实现(同步 `node:crypto`,直白的 hook:parse → 加密/解密 → stringify,同一组 hook 挂在全部 44 个 datastore 上),对应设计文档的 Phase 1–8。它是 PR #10666 分支上提交 `b1dfb39a4` 的代码,也就是 O1 之前。分支合并后这个提交可能不再可达,所以重测 baseline 时要用这个提交的代码(例如 `git worktree`),不能用现在的 HEAD。
2. **Optimized(部分已实现):** 在 baseline 之上应用下面的优化,再用同一个 benchmark 重测。已经做完的是 **O1** 和 **O2 的第 1 步**(见第 4 节),它们是在 baseline 测量之后做的;其余优化项还没做。

两步使用同一个 benchmark(第 6 节),结果可以直接对比。

## 2. 成本在哪里

以下结论来自 `@seald-io/nedb` 4.1.2 的源码(`lib/persistence.js`)和 baseline 的实现(O1 之前的代码):

- **每次启动都会重写每个 datastore(`.db` 文件)。** `loadDatabase` 把每一行交给 `beforeDeserialization`,然后无条件调用 `persistCachedDatabaseAsync()`(`persistence.js:339`),把每个文档再交给 `afterSerialization`。所以每次启动 = 一遍完整的解密 + 一遍完整的加密。迁移不过是第一次带 key 的这样一次加载(设计文档第 6 节)。
- **启动时的重写是唯一的压缩时机。** 更新会追加新行,删除会追加删除标记,旧行留到下一次重写才清掉。仓库里没有使用 NeDB 的自动压缩(没有 `setAutocompactionInterval` / `compactDatafile` 的调用)。
- **Baseline 把同一组 hook 挂在全部 44 个 datastore 上**(`database-nedb.ts` 的 `defaultConfig` 展开到每个 datastore),而其中只有 13 个类型有加密字段(Request、RequestGroup、Workspace、WebSocketRequest、SocketIORequest、McpRequest、GrpcRequest、ClientCertificate、CloudCredential、GitCredentials、OAuth2Token、CookieJar、RequestVersion)。另外 31 个类型的每一行,在读、写两遍里也都要 parse + stringify,而且什么都没改。其中 Response(每次发送一条历史记录)和 ApiSpec(`contents` 内联整份 spec)的数据量可能很大。O1 已经改掉这一点:现在只有这 13 个类型挂 hook,其余 31 个与不加密时完全一样。
- **正常写入是增量的。** 一次 insert/update 追加一条序列化后的文档,hook 的成本是几十微秒,不是问题。
- **Hook 可以是异步的,但重写逐个文档 await**(`persistence.js:97-99`)。每次调用的异步开销会乘以文档数,所以基础设计用同步的 `node:crypto`,而不是 WebCrypto(设计文档 4.2;20k 个值上实测慢约 6 倍)。读阶段则不同:NeDB 在每行的 `on('data')` 里就提前调用读 hook,再按顺序等结果(`persistence.js:251`),所以异步的读 hook 理论上可以重叠执行。但 hook 是逐行调用的,无法批量,见"不推荐"一节。
- **NeDB 自己的(反)序列化**用 `JSON.stringify` / `JSON.parse` 加 replacer/reviver 函数,本来就比纯 JSON 慢;hook 额外多出来的那一遍 JSON 是纯 JSON。
- **密钥加载发生在所有 datastore 加载之前,而且是串行的。** `database.main.ts` 的 `init()` 先 `await getLocalEncryptionKey()`,再初始化数据库。首次启动还要生成密钥、保护、durable 写入、回读验证(设计文档 6.3);safeStorage 暂时不可用时,5 次重试的等待加起来最坏约 1.8 s(120/240/480/960 ms,抖动 ±20%)。这部分不是 hook 的成本,但算在 `init()` 的总耗时里,第 6 节要把它单独量出来。

**启动是热点路径。** 下面所有优化都针对完整的读和重写两遍。

## 3. 初步测量

合成数据集:5,000 个 Request 文档(1/3 无认证,1/3 bearer,1/3 带 4 个密钥字段的 OAuth2;每个约 1.5 KB 的 JSON body)+ 1 个含 500 条 cookie 的 CookieJar。序列化后 14.6 MB,约 8.8k 个加密值。Node 24.18(与 `.nvmrc` 一致),Windows 11,5 次运行取中位数。对所有文档完整跑一遍:

| 场景                                       | 读一遍 | 写一遍 |
| ------------------------------------------ | ------ | ------ |
| 只有 NeDB(无加密)                          | 85 ms  | 30 ms  |
| Baseline hooks(parse + AES + stringify)    | +80 ms | +85 ms |
| Optimized(O2 读,O4 写)                     | +43 ms | +42 ms |
| 每行只做纯 `JSON.parse` + `JSON.stringify` | 33 ms  | 33 ms  |

**结论:** 在 baseline hooks 里,AES 的成本和多出来的那一遍 JSON 差不多。每个值的 AES-256-GCM 约 3–5 µs,主要花在 `createCipheriv` 的对象创建和 `randomBytes(12)` 上,不在加密本身。

这些数字是合成的,有两个限制:数据集里只有加密类型,所以**没有反映** baseline 对另外 31 个类型的 hook 成本(O1 已经去掉了这部分成本);O3 的数字是按叶子字段名过滤得到的,在带 header 的真实 Request 上达不到(见 O3)。第 6 节定义了真正用于 baseline 与优化后对比的测量。

## 4. 优化项

按预期收益排序。除非特别说明,都不改变磁盘上的格式(见第 5 节)。O1–O5 是最初的清单,O6–O8 是在 baseline 实现之后复查时补充的。**已实现:O1 和 O2 的第 1 步**(标题上标了"已实现")。

### O1. 按 datastore 挂 hook,只在需要的地方挂(已实现)

- **做什么:** 只有路径表里有加密字段的 datastore 才挂 hook(现在是 13 个),另外 31 个 datastore 不挂,与不加密时完全一样。每个 datastore 的配置由 `database-nedb.ts` 里的 `configForType(type)` 生成,是否挂 hook 由 `hooks.ts` 里的 `getHooksForType(hooks, type, getEncryptedFieldPaths)` 决定:类型有加密路径就返回 hook,否则返回 `{}`。inso 的 `ne-db-adapter.ts` 也调用同一个函数,所以这条规则只写了一处。
- **为什么:** 另外 31 个 datastore(Response、RequestMeta、Stats、ApiSpec 等)就完全没有成本。Baseline 对它们的每一行都做两遍 parse + stringify(读一遍、写一遍)。
- **实现与最初方案的差别:** 最初的方案是每个 datastore 创建自己的 hook,创建时就绑定类型和路径列表,不必从行里读 `type`。实际没有这样做:仍然是同一组 hook 对象(`createFieldEncryptionHooks` 的签名不变),只是决定它挂在哪些 datastore 上,hook 仍从行里读 `type` 并查路径。因为写阶段无论如何都要先 parse 才能走路径,绑定类型省不了什么,还要改 inso 共用的 factory 签名。
- **注意:**
  - 有加密字段的类型由 `getEncryptedFieldPathsByType()` 推出来,没有硬编码。数量已经变过一次:develop 的 #10727 给 Workspace 加了 `authentication`,它就进了这个集合。
  - 前提是一个 datastore 里只有自己类型的文档:`insert` 和 `update` 都按 `doc.type` 路由到同名的 datastore,所以成立。只有手工把别的类型的行放进某个 datastore,那一行才不会被加密(也没有报错)。`getHooksForType()` 的注释里写了这个前提。
  - `inMemoryOnly` 实例和没有 key 的降级模式本来就没有 hook,不受影响。
- **测试:** `database-field-encryption.test.ts` 给每个类型放一条文档,断言 hook 只处理有加密字段的类型(集合从路径表推出,不是手写的),其余类型照常加载和重写;`hooks.test.ts` 有 `getHooksForType()` 的单元测试。
- **测量:** 第 3 节没有反映(数据集里只有加密类型)。收益等于这 31 个类型的全部 hook 成本,所以第 6 节的数据集必须包含它们。优化后的数字等第 6 节重测。

### O2. 读的时候不 parse:前缀检查 + 正则替换(第 1 步已实现)

- **状态:第 1 步已实现,第 2 步(正则替换)未实现。** 第 1 步在 `hooks.ts` 的 `beforeDeserialization` 开头用 `line.includes(ENCRYPTED_VALUE_JSON_START)` 判断(常量在 `value.ts`,值是 `"enc:insomnia:v1:`),与下面写的 `indexOf(...) === -1` 等价。没有这段文字的行原样返回,不 parse,也不查路径。它对所有挂了 hook 的 datastore 生效。
- **测试:** `hooks.test.ts` 里,排版不是 `JSON.stringify` 输出的、没有密文的行,原样返回且不查路径;有密文的行不管排版怎样都能解密。
- **做什么:** 在 `beforeDeserialization` 里:
  1. `line.indexOf('"enc:insomnia:v1:') === -1` → 原样返回这一行。
  2. 否则用正则匹配 `"<name>":"enc:insomnia:v1:<base64>"`,其中 `<name>` 是该 datastore 某条加密字段路径的最后一段。把每个算作密文的匹配项(设计文档 4.2:合法 base64,解码后 ≥ 28 字节)替换为 `JSON.stringify(decrypt(token))`。不对整行做 `JSON.parse` / `JSON.stringify`。
- **为什么:** 读阶段省掉完整的 parse + stringify。
- **两步可以分开上线:** 第 1 步单独就有效,而且最安全。首次迁移时数据全是明文,这一遍读几乎变成零成本。
- **不 parse 时怎么检查路径:** 设计只解密加密路径上的值(设计文档 4.2)。只要某个字段名在这个 datastore 的 schema 里只出现在加密路径上,按字段名匹配和按路径匹配结果相同。有些名字是"不明确"的,不能按名字匹配:
  - **名字也出现在非加密路径上。** 例如 Request 的 `authentication.value`(API Key 认证)加密,而 `headers[].value`、`parameters[].value` 等不加密。
  - **schema 里有自由格式区域(`z.record`、`z.any()`、自由 JSON)。** 这种区域里任何名字都可能出现,所以这个 datastore 的所有名字都视为不明确。例如 RequestGroup 的 `environment`(键名由用户起,用户变量叫 `password`、值恰好是合格的密文也不能解密)、Workspace 已弃用的 `certificates`、CookieJar 的 `extensions`。Request、WebSocketRequest、SocketIORequest、McpRequest、GrpcRequest 没有这类区域,RequestVersion 只有一个顶层字段,它们是主要的受益者。
  - **还没迁到 Zod 的 5 个模型没有 schema 可查。** 它们只能用 `init()` 返回的顶层 key 加字面路径来判断。
  - 不明确的名字,或者来自"所有名字都不明确"的 datastore 的候选 token,按 baseline 的 parse 路径处理。因为有第 1 步,这个退回只会发生在确实含前缀的行上。
- **失败处理:**
  - 算作密文但 GCM 校验失败的值,必须保持原样并上报,不能丢弃。
  - 上报需要 `{ type, _id, path }`,其中 `path` 是带数组下标的具体路径(`cookies[1].value`)(设计文档 4.3.1)。正则替换拿不到下标,所以**这一行退回 baseline 的 parse 路径重跑一遍**来生成报告。解密失败本来就罕见,不影响性能。
- **安全:**
  - 依赖基础设计的值格式(设计文档 4.2):密文只用 base64 字符集(没有需要 JSON 转义的字符),前面有独特的、带版本的 `enc:insomnia:v1:` 前缀。
  - 第 1 步只认 `JSON.stringify` 写出的形式:密文是 JSON 字符串值,前面一定有引号,前缀里的字符也不会被转义。如果别的工具把这个值写成转义形式(例如把前缀的第一个字母写成 Unicode 转义),这一行会被原样返回,这一次会话里那个字段不能用;NeDB 重写时输出标准形式,下一次启动才会解密。只有我们自己的写入器会产生这种值,所以这是理论情况,已接受。
  - 要保留 baseline 的 hook 作为测试基准,用差分/模糊测试保证两种实现对同一行给出等价的结果。覆盖 lookalike、JSON 转义、非字符串值、不明确名字、解密失败。benchmark 数据里也要有一个 lookalike,能原样往返。
- **测量:** 读一遍 80 ms → 43 ms,剩下的主要是 AES。(测量用的正则没有限定字段名;限定字段名的版本预计差不多,会在第 6 节的 benchmark 里重测。)

### O3. 写之前按路径第一段预过滤

- **做什么:** 在 `afterSerialization` 里先检查原始行,如果确定没有需要加密的内容,就不 parse,原样返回。过滤依据是**加密路径的第一段**,不是叶子字段名。例如 Request、RequestGroup、Workspace 的加密路径都在 `authentication` 下,没有认证时默认序列化成 `"authentication":{}`。
- **为什么按第一段:** 按叶子名(`"password":`、`"token":`)过滤,对 Request 几乎没用。Request 的加密名里有 `value` 和 `key`,而每个 header、参数条目都带 `"value":`,几乎所有请求都会通过过滤。
- **适用范围:** 主要是 Request 系列。CookieJar(每条 cookie 都有 `"value":`)和 RequestVersion(每行都有 `compressedRequest`)每一行都有目标字段,没有收益。
- **保守原则:** 过滤只许放过,不许漏掉:凡是不能确定"没有可加密内容"的行都走 parse。`{"type":"none"}` 这种形式,以及其它"无需加密"的序列化形式,实现时要逐一核对。
- **测量:** 85 ms → 77 ms,这是按叶子名过滤、在合成数据(2/3 的请求带认证)上得到的,在带 header 的真实 Request 上预计达不到,按第一段过滤的版本在第 6 节重测。有认证的请求更少的真实数据收益会更大。

### O4. 启动重写时复用密文

两种做法,先评估 B。

**A. 字段级(已测)**

- **做什么:** 读阶段记录 `文档 id + 路径 + 明文 → 密文`。重写阶段如果某个字段的明文没变,就写入记录下来的密文,不再重新加密。
- **为什么:** 启动重写里几乎不再有 AES,只有上次写入之后变过的值才需要加密。
- **说明:**
  - 缓存 key 含文档 id,所以不同文档里相同的值永远不会共用密文(没有跨文档的相等性泄露)。
  - key 含明文,所以过期的缓存项不可能产生错误命中。
  - 缓存只存在于主进程内存里,而主进程本来就持有明文。
  - 缓存只用于启动重写,**在该 datastore 加载完成后丢弃**,不常驻。
  - 附带好处:`.db` 文件内容在两次启动之间保持稳定,不再因为新的随机 IV 而变化。
- **测量:** 重写一遍 85 ms → 42 ms(≈ 纯 JSON 的下限)。

**B. 行级(推荐先评估)**

- **做什么:** 读 hook 返回明文行 D 时,记录 `D → 磁盘上的原行 L`。重写阶段 NeDB 调用 `afterSerialization(model.serialize(doc))`,文档没变时这个字符串就等于 D,`cache.get(line)` 命中就直接返回 L:不 parse、不找路径、不 stringify、不做 AES。
- **为什么:** 对没变的文档(启动时几乎全是),重写只剩一次 Map 查找,并且同时取代了 O3 和 O4-A 在启动重写上的作用。重写阶段剩下的只有 NeDB 自己的 `model.serialize`。
- **说明:**
  - 没命中就走原来的路径,所以正确性不依赖命中率。
  - key 是整行,里面有 `_id`,不同文档不会共用密文。
  - 复用同一个密文不会引入 IV 重用:同样的 key、IV、明文本来就产生同样的密文。
  - 内存:加载期间多持有一份含密文的行文本(只缓存含密文的行),加载完成后丢弃。
  - 不覆盖首次迁移(明文行没有缓存)和已被修改的文档,它们走原路径。
- **未验证:** `model.serialize(doc)` 与 D 逐字节相等的比例。Date 的序列化(`$$date`)和历史上非规范写出的旧行可能让它们不等。命中率在第 6 节统计。

### O5. IV 池

- **做什么:** 从预先填好的 `crypto.randomBytes(12 * 4096)` 缓冲区里取 IV,而不是每个值调用一次 `randomBytes(12)`。
- **为什么:** `randomBytes` 的每次调用开销占了每个值的 AES 成本的一大部分。IV 仍然来自 CSPRNG 的随机数,安全性不变。
- **优先级低:** 做了 O4 之后,只有新值和变过的值才会加密,O5 主要帮首次迁移和批量导入。放在最后。
- **测量:** 20k 次加密 106 ms → 70 ms。

### O6. 没有变化时跳过整库重写

- **做什么:** O1–O5 都省不掉 NeDB 自己的重写(序列化全部文档 + 写盘),只有不重写才能省。对每个 datastore 的 `persistence.persistCachedDatabaseAsync` 做实例级覆盖:没有明文待加密、也没有过期行(读到的非空行数等于文档数)时直接返回,否则走原来的重写。读阶段的 hook 已经看到了每一行,可以顺便统计这两个条件。
- **为什么:** 稳态启动的写阶段变成零成本,还少写一遍磁盘文件(磁盘磨损、崩溃窗口都更小)。设计文档 5.3 里"inso 用 key 会原地重写明文值"这个已接受的风险也会变小。
- **风险和代价:**
  - 依赖 NeDB 的内部方法,要锁定版本并加测试,NeDB 升级后行为变了就让测试失败。
  - 设计文档 6.2 的"每次启动都执行同样的重写"要改成"需要时才重写"。降级会话里写入的明文、旧版本写入的明文仍然会在下一次健康启动时加密(这是"有明文待加密"这个条件)。
  - 收益取决于真实数据:编辑过的 datastore 因为追加行,几乎每次启动都要压缩;只有休眠的文件能跳过。
- **先量再定:** 在第 6 节统计真实数据目录里"行数等于文档数"的文件占比,再决定要不要做。

### O7. 路径预编译

- **做什么:** `forEachEncryptedLeaf` 现在对每一行的每一条路径都重新 `split('.')`、用正则解析段、再从文档根节点走一遍。Request 有 13 条路径,而且都在 `authentication` 下。可以按类型把路径预编译成一棵树,只走一遍。
- **为什么:** 纯进程内的改动,不影响格式,有现成的单元测试保护。
- **优先级低:** 没有实测占比。O1–O4 之后,只有真正需要处理的行才会走到这里。只有 profile 仍显示它重要时才做。

### O8. 读 hook 不重复校验

- **做什么:** 读 hook 先调用 `isWellFormedCiphertext`,`decryptValue` 里又调一次。把 `decryptValue` 拆成"带校验"和"不重复校验的内部函数",hook 用后者。
- **为什么:** 对 MB 级的 `compressedRequest`,同一段文本被正则扫两遍。收益很小,但改动也很小。

### 不推荐

- **每个文档只做一次 AES(信封):** 把一个文档里所有敏感值作为一个整块加密,字段里留占位符。写一遍 47 ms,但 O4 已经能到 42 ms,格式更复杂,而且读取就不能再用 O2 的替换了。
- **给 NeDB 打补丁,加文档级的 `beforeSerialization(doc)` hook:** 可以完全去掉写侧多出来的那一遍 JSON,代价是要维护一个第三方依赖的补丁。只有测量显示 O1–O8 都不够时才作为最后手段。
- **用 worker 线程做读阶段:** NeDB 提前调用读 hook(`persistence.js:251`),所以异步 hook 可以重叠执行。但 hook 是逐行调用,无法批量,而每行的读成本只有约 16 µs(80 ms / 5000 行),一次 `postMessage` 来回通常在几十微秒量级(没有实测),得不偿失。
- **延迟加载 RequestVersion / Response 等大 datastore:** 能把它们的成本移出启动路径,但会改变 `init()` 等待所有加载完成的约定(设计文档 4.3.1),还会把卡顿挪到某次随机的首次使用上。除非第 6 节的测量证明它们主导了启动时间,否则不做。

### 建议顺序

O1(已实现)→ O2 第 1 步(已实现)→ O4-B(行级缓存)→ O2 第 2 步(只对 Request 系列和 RequestVersion)→ 按第一段过滤的 O3 → O5。O6 等第 6 节统计出"行数等于文档数"的占比再定,O7、O8 只在 profile 需要时做。都排在 Phase 9 的 baseline 之后。

## 5. 两步之间的格式兼容

紧凑、带版本的值格式(`enc:insomnia:v1:` + base64(`iv` ‖ `tag` ‖ `ciphertext`))是基础设计的一部分(设计文档 4.2),O1–O8 都不改变写到磁盘上的内容。所以 baseline 和优化后的实现可以互相读对方的文件,两步可以分开发布,不需要旧格式的解码路径。O6 改变的是"什么时候重写",不是写出的格式。

## 6. 测量计划

baseline 做完后、优化做完后,各跑一遍同样的 benchmark。

**数据集:**

- 固定随机种子的合成数据生成器(如第 3 节),分小 / 中 / 大三档。要包含 RequestVersion 文档:`compressedRequest` 每个版本是一个加密的大字符串,而且每次发送改过的请求都会增加,可能主导加密的数据量
- 要包含**无加密字段的大类型**(Response、ApiSpec 的大 `contents`、RequestMeta 等),因为 baseline 对全部 44 个 datastore 都挂了 hook,没有它们就量不出 baseline 的真实成本,也量不出 O1 的收益(O1 之后只有 13 个类型挂 hook)
- 一份真实 Insomnia 数据目录的拷贝(绝不用正在使用的目录)

**指标:**

| 指标                       | 方法                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------- |
| 数据库初始化时间           | `mainDatabase.init()` 的总耗时,以及每个 datastore 的耗时(读 + 重写)                    |
| 密钥加载时间               | `getLocalEncryptionKey()` 单独计时,与 datastore 加载分开;首次启动(生成 + 验证)单独记录 |
| 首次启动(迁移)的初始化时间 | 对原本是明文的数据目录调用 `mainDatabase.init()`                                       |
| 单次写入延迟               | 对一个带认证的 Request 做一次 `update()`                                               |
| `.db` 文件大小             | 每个 datastore,加密前后对比                                                            |
| 主进程内存                 | 初始化后的堆(O4 的缓存应在加载完成后释放,这里能看出来)                                 |
| O4-B 行级缓存命中率        | 重写时命中的行数 / 总行数,按 datastore 分开                                            |
| 可跳过重写的文件占比       | 读到的非空行数等于文档数、且没有明文待加密的 `.db` 文件占比(O6 的依据)                 |

**方法:** 两次运行用同一台机器、同样的 Node/Electron 版本;**baseline 要用 O1 和 O2 第 1 步之前的代码**(提交 `b1dfb39a4`,见第 1 节),Optimized 用现在的代码;丢弃预热的一次;至少取 5 次运行的中位数;**每个数字都要标明运行环境**:Electron(BoringSSL)还是 Node(OpenSSL),两者的 AES-GCM 速度可能不同。结果按下表记录。

| 指标 | 无加密 | Baseline | Optimized |
| ---- | ------ | -------- | --------- |
|      |        |          |           |
