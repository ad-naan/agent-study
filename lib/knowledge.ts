/**
 * 主题目录（Topic Catalog）
 *
 * 设计思路：
 * - 我们不把“知识点内容”写死，而是维护一份覆盖前端/后端/数据库/中间件/AI 的
 *   “主题目录”。每个主题带有真实的参考链接（references）。
 * - references 分两类：
 *   · tutorial（教程/实战）：优先抓取，内容更“讲人话”、带真实场景与面试视角。
 *   · official（官方文档）：作为权威依据与深入阅读。
 * - 抓取时 tutorial 排在前面（见 references 顺序 + fetchDocs 的 limit），
 *   保证喂给模型的正文是“有场景的教程”，而不仅是干巴巴的规范。
 * - 具体讲解与学习引导由 AI 基于抓取到的原文实时生成（见 lib/prompt.ts）。
 *
 * 数据源说明（均为长期维护、活跃更新的站点，已实测可抓取）：
 * - 小林 coding（xiaolincoding.com）：图解网络/MySQL/Redis/OS，场景化极强。
 * - JavaGuide（javaguide.cn）：Java/中间件/数据库八股与实战，面试导向。
 * - 现代 JavaScript 教程（zh.javascript.info）：JS 权威中文教程。
 * - 廖雪峰教程（liaoxuefeng.com）：Python/Java/JS 入门实战。
 * - 菜鸟教程（runoob.com）：广覆盖入门教程，示例多。
 * - web.dev（Google）：前端性能与最佳实践。
 * - TypeScript 入门教程（ts.xcatliu.com）、Go 圣经中文（gopl-zh.github.io）、
 *   Rust 程序设计语言中文（kaisery.github.io/trpl-zh-cn）、Refactoring Guru 中文。
 */

export type Reference = {
  label: string;
  url: string;
  type?: "tutorial" | "official"; // 缺省视为 official
};
export type Difficulty = "入门" | "进阶" | "高级";

export type Topic = {
  id: string;
  track: string; // 方向
  category: string; // 语言/技术名
  title: string; // 具体主题
  difficulty: Difficulty;
  focus: string; // 一句话说明本篇要掌握什么
  references: Reference[]; // tutorial 在前、official 在后
};

const MDN = "https://developer.mozilla.org/zh-CN/docs/Web";

export const topics: Topic[] = [
  // ================= 前端 =================
  {
    id: "fe-html-semantics",
    track: "前端",
    category: "HTML",
    title: "语义化 HTML 与文档结构",
    difficulty: "入门",
    focus: "用正确的标签表达内容含义，为可访问性与 SEO 打基础。",
    references: [
      { label: "菜鸟教程 · HTML5 语义元素", url: "https://www.runoob.com/html/html5-semantic-elements.html", type: "tutorial" },
      { label: "MDN · HTML 元素参考", url: `${MDN}/HTML/Element`, type: "official" },
    ],
  },
  {
    id: "fe-css-flex-grid",
    track: "前端",
    category: "CSS",
    title: "Flexbox 与 Grid 布局",
    difficulty: "入门",
    focus: "掌握一维 Flex 与二维 Grid 的取舍与常见布局套路。",
    references: [
      { label: "阮一峰 · Flex 布局教程（语法篇）", url: "https://www.ruanyifeng.com/blog/2015/07/flex-grammar.html", type: "tutorial" },
      { label: "菜鸟教程 · CSS3 Flex 布局", url: "https://www.runoob.com/css3/css3-flexbox.html", type: "tutorial" },
      { label: "MDN · Grid", url: `${MDN}/CSS/CSS_grid_layout`, type: "official" },
    ],
  },
  {
    id: "fe-js-eventloop",
    track: "前端",
    category: "JavaScript",
    title: "事件循环、微任务与宏任务",
    difficulty: "进阶",
    focus: "理解 JS 单线程如何调度异步，Promise/setTimeout 的执行顺序。",
    references: [
      { label: "现代 JavaScript 教程 · 事件循环", url: "https://zh.javascript.info/event-loop", type: "tutorial" },
      { label: "MDN · Promise", url: `${MDN}/JavaScript/Reference/Global_Objects/Promise`, type: "official" },
    ],
  },
  {
    id: "fe-js-closure",
    track: "前端",
    category: "JavaScript",
    title: "闭包与作用域链",
    difficulty: "进阶",
    focus: "理解闭包的成因、常见用途与内存陷阱。",
    references: [
      { label: "现代 JavaScript 教程 · 闭包", url: "https://zh.javascript.info/closure", type: "tutorial" },
      { label: "MDN · 闭包", url: `${MDN}/JavaScript/Closures`, type: "official" },
    ],
  },
  {
    id: "fe-ts-generics",
    track: "前端",
    category: "TypeScript",
    title: "泛型与类型体操基础",
    difficulty: "进阶",
    focus: "用泛型写可复用且类型安全的工具类型。",
    references: [
      { label: "TypeScript 入门教程 · 泛型", url: "https://ts.xcatliu.com/advanced/generics.html", type: "tutorial" },
      { label: "TS 官方 · Utility Types", url: "https://www.typescriptlang.org/docs/handbook/utility-types.html", type: "official" },
    ],
  },
  {
    id: "fe-react-hooks",
    track: "前端",
    category: "React",
    title: "useEffect 与依赖数组心智模型",
    difficulty: "进阶",
    focus: "搞清楚 effect 何时运行、清理函数、依赖数组正确写法。",
    references: [
      { label: "React 官方教程 · 使用 Effect 同步", url: "https://zh-hans.react.dev/learn/synchronizing-with-effects", type: "tutorial" },
      { label: "React 官方 · useEffect API", url: "https://react.dev/reference/react/useEffect", type: "official" },
    ],
  },
  {
    id: "fe-vue-reactivity",
    track: "前端",
    category: "Vue",
    title: "Vue 3 响应式：从用法到原理",
    difficulty: "进阶",
    focus: "ref/reactive 的用法与背后的依赖收集、派发更新。",
    references: [
      { label: "Vue 官方教程 · 响应式基础", url: "https://cn.vuejs.org/guide/essentials/reactivity-fundamentals.html", type: "tutorial" },
      { label: "Vue 官方 · 深入响应式系统", url: "https://cn.vuejs.org/guide/extras/reactivity-in-depth.html", type: "official" },
    ],
  },
  {
    id: "fe-http-cache",
    track: "前端",
    category: "网络",
    title: "HTTP 缓存机制（强缓存/协商缓存）",
    difficulty: "进阶",
    focus: "Cache-Control、ETag、Last-Modified 的配合与实战。",
    references: [
      { label: "web.dev · HTTP 缓存（Google）", url: "https://web.dev/articles/http-cache", type: "tutorial" },
      { label: "小林 coding · HTTP 常见面试题", url: "https://xiaolincoding.com/network/2_http/http_interview.html", type: "tutorial" },
      { label: "MDN · HTTP 缓存", url: "https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Caching", type: "official" },
    ],
  },

  // ================= 后端语言 =================
  {
    id: "be-node-eventloop",
    track: "后端语言",
    category: "Node.js",
    title: "Node.js 事件循环与非阻塞 I/O",
    difficulty: "进阶",
    focus: "libuv 事件循环各阶段、宏任务与 process.nextTick。",
    references: [
      { label: "菜鸟教程 · Node.js 事件循环", url: "https://www.runoob.com/nodejs/nodejs-event-loop.html", type: "tutorial" },
      { label: "Node 官方 · 事件循环", url: "https://nodejs.org/zh-cn/learn/asynchronous-work/event-loop-timers-and-nexttick", type: "official" },
    ],
  },
  {
    id: "be-java-jvm-gc",
    track: "后端语言",
    category: "Java",
    title: "JVM 内存区域与垃圾回收",
    difficulty: "高级",
    focus: "堆/栈/方法区、GC Roots、常见 GC 算法与收集器。",
    references: [
      { label: "JavaGuide · JVM 内存区域", url: "https://javaguide.cn/java/jvm/memory-area.html", type: "tutorial" },
      { label: "JavaGuide · JVM 垃圾回收", url: "https://javaguide.cn/java/jvm/jvm-garbage-collection.html", type: "tutorial" },
    ],
  },
  {
    id: "be-java-concurrency",
    track: "后端语言",
    category: "Java",
    title: "Java 并发：线程池与锁",
    difficulty: "高级",
    focus: "ThreadPoolExecutor 参数、synchronized 与 ReentrantLock。",
    references: [
      { label: "JavaGuide · 线程池详解", url: "https://javaguide.cn/java/concurrent/java-thread-pool-summary.html", type: "tutorial" },
      { label: "Java 官方 · 并发教程", url: "https://docs.oracle.com/javase/tutorial/essential/concurrency/", type: "official" },
    ],
  },
  {
    id: "be-python-gil",
    track: "后端语言",
    category: "Python",
    title: "GIL、多线程与多进程",
    difficulty: "进阶",
    focus: "理解 GIL 的影响，CPU 密集与 IO 密集的并发选择。",
    references: [
      { label: "菜鸟教程 · Python3 多线程", url: "https://www.runoob.com/python3/python3-multithreading.html", type: "tutorial" },
      { label: "Python 官方 · threading", url: "https://docs.python.org/zh-cn/3/library/threading.html", type: "official" },
    ],
  },
  {
    id: "be-python-asyncio",
    track: "后端语言",
    category: "Python",
    title: "asyncio 协程与事件循环",
    difficulty: "进阶",
    focus: "async/await、任务调度与常见误用。",
    references: [
      { label: "菜鸟教程 · Python asyncio", url: "https://www.runoob.com/python3/python-asyncio.html", type: "tutorial" },
      { label: "Python 官方 · asyncio", url: "https://docs.python.org/zh-cn/3/library/asyncio.html", type: "official" },
    ],
  },
  {
    id: "be-go-goroutine",
    track: "后端语言",
    category: "Go",
    title: "Goroutine 与 Channel 并发模型",
    difficulty: "进阶",
    focus: "CSP 模型、channel 使用模式与 select。",
    references: [
      { label: "Go 圣经中文 · 基于通信的并发（channel）", url: "https://gopl-zh.github.io/ch8/ch8-04.html", type: "tutorial" },
      { label: "Effective Go · 并发", url: "https://go.dev/doc/effective_go#concurrency", type: "official" },
    ],
  },
  {
    id: "be-go-gc",
    track: "后端语言",
    category: "Go",
    title: "Go 内存管理与 GC",
    difficulty: "高级",
    focus: "逃逸分析、三色标记与 GC 调优。",
    references: [
      { label: "Go 圣经中文 · Goroutines 与线程", url: "https://gopl-zh.github.io/ch9/ch9-08.html", type: "tutorial" },
      { label: "Go 官方 · GC 指南", url: "https://go.dev/doc/gc-guide", type: "official" },
    ],
  },
  {
    id: "be-rust-ownership",
    track: "后端语言",
    category: "Rust",
    title: "所有权、借用与生命周期",
    difficulty: "高级",
    focus: "Rust 内存安全的核心：move、borrow、lifetime。",
    references: [
      { label: "Rust 程序设计语言（中文）· 什么是所有权", url: "https://kaisery.github.io/trpl-zh-cn/ch04-01-what-is-ownership.html", type: "tutorial" },
      { label: "Rust Book · 所有权（章节目录）", url: "https://kaisery.github.io/trpl-zh-cn/ch04-00-understanding-ownership.html", type: "official" },
    ],
  },

  // ================= 数据库 =================
  {
    id: "db-mysql-index",
    track: "数据库",
    category: "MySQL",
    title: "InnoDB 索引与 B+ 树",
    difficulty: "进阶",
    focus: "聚簇索引、二级索引、回表与最左前缀。",
    references: [
      { label: "小林 coding · MySQL 索引面试题", url: "https://xiaolincoding.com/mysql/index/index_interview.html", type: "tutorial" },
      { label: "菜鸟教程 · MySQL 索引", url: "https://www.runoob.com/mysql/mysql-index.html", type: "tutorial" },
    ],
  },
  {
    id: "db-mysql-tx",
    track: "数据库",
    category: "MySQL",
    title: "事务隔离级别与 MVCC",
    difficulty: "高级",
    focus: "四种隔离级别、脏读/幻读、MVCC 与锁。",
    references: [
      { label: "小林 coding · MVCC 详解", url: "https://xiaolincoding.com/mysql/transaction/mvcc.html", type: "tutorial" },
      { label: "MySQL 官方 · 事务隔离级别", url: "https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html", type: "official" },
    ],
  },
  {
    id: "db-pg-mvcc",
    track: "数据库",
    category: "PostgreSQL",
    title: "PostgreSQL MVCC 与 VACUUM",
    difficulty: "高级",
    focus: "多版本并发、膨胀问题与 autovacuum。",
    references: [
      { label: "PG 官方 · 事务隔离", url: "https://www.postgresql.org/docs/current/transaction-iso.html", type: "official" },
      { label: "PG 官方 · MVCC 概述", url: "https://www.postgresql.org/docs/current/mvcc-intro.html", type: "official" },
    ],
  },
  {
    id: "db-mongo-model",
    track: "数据库",
    category: "MongoDB",
    title: "文档模型与嵌入 vs 引用",
    difficulty: "进阶",
    focus: "何时嵌入、何时引用，索引与聚合基础。",
    references: [
      { label: "菜鸟教程 · MongoDB 教程", url: "https://www.runoob.com/mongodb/mongodb-tutorial.html", type: "tutorial" },
      { label: "MongoDB 官方 · 数据建模", url: "https://www.mongodb.com/docs/manual/core/data-modeling-introduction/", type: "official" },
    ],
  },
  {
    id: "db-redis-datastruct",
    track: "数据库",
    category: "Redis",
    title: "Redis 数据结构与使用场景",
    difficulty: "入门",
    focus: "String/Hash/List/Set/ZSet 及典型用法。",
    references: [
      { label: "小林 coding · Redis 数据类型与命令", url: "https://xiaolincoding.com/redis/data_struct/command.html", type: "tutorial" },
      { label: "菜鸟教程 · Redis 教程", url: "https://www.runoob.com/redis/redis-tutorial.html", type: "tutorial" },
    ],
  },
  {
    id: "db-redis-persist",
    track: "数据库",
    category: "Redis",
    title: "Redis 持久化：RDB 与 AOF",
    difficulty: "进阶",
    focus: "两种持久化机制的取舍与混合模式。",
    references: [
      { label: "JavaGuide · Redis 常见问题（含持久化）", url: "https://javaguide.cn/database/redis/redis-questions-01.html", type: "tutorial" },
      { label: "Redis 官方 · 持久化", url: "https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/", type: "official" },
    ],
  },

  // ================= 中间件与运维 =================
  {
    id: "mw-nginx-reverse",
    track: "中间件与运维",
    category: "Nginx",
    title: "Nginx 反向代理与负载均衡",
    difficulty: "进阶",
    focus: "location 匹配、upstream 策略、常见配置。",
    references: [
      { label: "菜鸟教程 · Nginx 安装与配置", url: "https://www.runoob.com/w3cnote/nginx-setup-intro.html", type: "tutorial" },
      { label: "Nginx 官方 · HTTP 负载均衡", url: "https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/", type: "official" },
    ],
  },
  {
    id: "mw-kafka-basics",
    track: "中间件与运维",
    category: "Kafka",
    title: "Kafka 分区、消费组与顺序性",
    difficulty: "高级",
    focus: "Topic/Partition、消费组再均衡、消息顺序保证。",
    references: [
      { label: "JavaGuide · Kafka 常见问题", url: "https://javaguide.cn/high-performance/message-queue/kafka-questions-01.html", type: "tutorial" },
      { label: "Kafka 官方 · 设计", url: "https://kafka.apache.org/documentation/#design", type: "official" },
    ],
  },
  {
    id: "mw-rabbitmq",
    track: "中间件与运维",
    category: "RabbitMQ",
    title: "RabbitMQ 交换机与路由模型",
    difficulty: "进阶",
    focus: "Exchange 类型、绑定、确认与死信队列。",
    references: [
      { label: "JavaGuide · RabbitMQ 常见问题", url: "https://javaguide.cn/high-performance/message-queue/rabbitmq-intro.html", type: "tutorial" },
      { label: "RabbitMQ 官方 · 教程", url: "https://www.rabbitmq.com/tutorials", type: "official" },
    ],
  },
  {
    id: "mw-docker-image",
    track: "中间件与运维",
    category: "Docker",
    title: "Docker 镜像分层与多阶段构建",
    difficulty: "进阶",
    focus: "镜像分层缓存、Dockerfile 优化与多阶段构建。",
    references: [
      { label: "菜鸟教程 · Docker 教程", url: "https://www.runoob.com/docker/docker-tutorial.html", type: "tutorial" },
      { label: "Docker 官方 · 构建最佳实践", url: "https://docs.docker.com/build/building/best-practices/", type: "official" },
    ],
  },
  {
    id: "mw-k8s-pod",
    track: "中间件与运维",
    category: "Kubernetes",
    title: "K8s 核心对象：Pod/Deployment/Service",
    difficulty: "高级",
    focus: "调度单位、副本管理与服务发现。",
    references: [
      { label: "K8s 官方教程 · 基础（交互式）", url: "https://kubernetes.io/zh-cn/docs/tutorials/kubernetes-basics/", type: "tutorial" },
      { label: "K8s 官方 · 概念总览", url: "https://kubernetes.io/zh-cn/docs/concepts/overview/", type: "official" },
    ],
  },
  {
    id: "mw-es-inverted",
    track: "中间件与运维",
    category: "Elasticsearch",
    title: "倒排索引与分词分析",
    difficulty: "进阶",
    focus: "倒排索引原理、analyzer 与相关性打分。",
    references: [
      { label: "JavaGuide · Elasticsearch 常见问题", url: "https://javaguide.cn/database/elasticsearch/elasticsearch-questions-01.html", type: "tutorial" },
      { label: "ES 官方 · Reference（当前版本）", url: "https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html", type: "official" },
    ],
  },

  // ================= AI Agent =================
  {
    id: "ai-react-pattern",
    track: "AI Agent",
    category: "Agent 范式",
    title: "ReAct：推理与行动的交织",
    difficulty: "入门",
    focus: "Thought/Action/Observation 循环，降低幻觉。",
    references: [
      { label: "LangChain · Agent 概念（实战框架）", url: "https://python.langchain.com/docs/concepts/agents/", type: "tutorial" },
      { label: "ReAct 论文", url: "https://arxiv.org/abs/2210.03629", type: "official" },
    ],
  },
  {
    id: "ai-tool-calling",
    track: "AI Agent",
    category: "工具使用",
    title: "Function Calling 的本质",
    difficulty: "入门",
    focus: "模型只输出调用意图，执行由宿主程序完成。",
    references: [
      { label: "OpenAI · Function Calling 指南", url: "https://platform.openai.com/docs/guides/function-calling", type: "tutorial" },
    ],
  },
  {
    id: "ai-rag",
    track: "AI Agent",
    category: "检索增强",
    title: "RAG：给模型外挂知识库",
    difficulty: "入门",
    focus: "切块、向量化、检索、重排与生成。",
    references: [
      { label: "LangChain · RAG 教程", url: "https://python.langchain.com/docs/tutorials/rag/", type: "tutorial" },
      { label: "RAG 论文", url: "https://arxiv.org/abs/2005.11401", type: "official" },
    ],
  },
  {
    id: "ai-mcp",
    track: "AI Agent",
    category: "协议",
    title: "MCP：给 Agent 接工具的标准协议",
    difficulty: "进阶",
    focus: "Server/Client、Tools/Resources/Prompts。",
    references: [
      { label: "MCP 官方 · 快速上手", url: "https://modelcontextprotocol.io/docs/getting-started/intro", type: "tutorial" },
      { label: "MCP 官方文档", url: "https://modelcontextprotocol.io/", type: "official" },
    ],
  },
];

export const tracks: string[] = Array.from(new Set(topics.map((t) => t.track)));

/** 以“距离纪元的天数”作索引，保证每天轮换、当天稳定。 */
const EPOCH = Date.UTC(2024, 0, 1);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function dayIndex(date: Date = new Date()): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((utc - EPOCH) / MS_PER_DAY);
}

export function getTodayTopic(date: Date = new Date()): {
  topic: Topic;
  index: number;
  total: number;
  dayNumber: number;
} {
  const total = topics.length;
  const dn = dayIndex(date);
  const index = ((dn % total) + total) % total;
  return { topic: topics[index], index, total, dayNumber: dn + 1 };
}

export function getTopicById(id: string): Topic | undefined {
  return topics.find((t) => t.id === id);
}

export function formatDate(date: Date = new Date()): string {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}
