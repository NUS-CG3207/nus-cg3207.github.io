var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@yowasp/runtime/lib/fetch.js
var fetch2;
if (typeof process === "object" && process.release?.name === "node") {
  fetch2 = async function(url, options) {
    if (url.protocol === "file:") {
      const { readFile } = await import("node:fs/promises");
      const data = await readFile(url);
      const isWasm = url.pathname.endsWith(".wasm");
      const headers = {
        "content-length": data.length,
        "content-type": isWasm ? "application/wasm" : "application/octet-stream"
      };
      return new Response(data, { headers });
    } else {
      return globalThis.fetch(url, options);
    }
  };
} else {
  fetch2 = globalThis.fetch;
}
var fetch_default = fetch2;

// node_modules/@yowasp/runtime/lib/wasi-virt.js
var Exit = class extends Error {
  constructor(code = 0) {
    super(`Exited with status ${code}`);
    this.code = code;
  }
};
function monotonicNow() {
  return BigInt(Math.floor(performance.now() * 1e6));
}
function wallClockNow() {
  let now = Date.now();
  const seconds = BigInt(Math.floor(now / 1e3));
  const nanoseconds = now % 1e3 * 1e6;
  return { seconds, nanoseconds };
}
var Xoroshiro128StarStar = class {
  constructor(seed) {
    if (BigInt(seed) === 0n) {
      throw new Error("xoroshiro128** must be seeded with a non-zero state");
    }
    this.s = [BigInt(seed) & 0xffffffffffffffffn, BigInt(seed) >> 64n & 0xffffffffffffffffn];
  }
  next() {
    function trunc64(x) {
      return x & 0xffffffffffffffffn;
    }
    function rotl(x, k) {
      return x << k | x >> 64n - k;
    }
    let [s0, s1] = this.s;
    const r = trunc64(rotl(s0 * 5n, 7n) * 9n);
    s1 ^= s0;
    s0 = trunc64(rotl(s0, 24n) ^ s1 ^ s1 << 16n);
    s1 = trunc64(rotl(s1, 37n));
    this.s = [s0, s1];
    return r;
  }
  getBytes(length) {
    return Uint8Array.from({ length }, () => Number(BigInt.asUintN(8, this.next() >> 32n)));
  }
};
var Pollable = class {
  ready() {
    return true;
  }
  block() {
    return Promise.resolve();
  }
};
var IoError = class extends Error {
};
var InputStream = class {
  read(_len) {
    throw { tag: "closed" };
  }
  blockingRead(len) {
    return this.read(len);
  }
};
var OutputStream = class {
  checkWrite() {
    throw { tag: "closed" };
  }
  write(_contents) {
    this.checkWrite();
  }
  flush() {
  }
  blockingFlush() {
    this.flush();
  }
  blockingWriteAndFlush(contents) {
    this.write(contents);
    this.blockingFlush();
  }
};
var CallbackInputStream = class extends InputStream {
  constructor(callback = null) {
    super();
    this.callback = callback;
  }
  read(len) {
    if (this.callback === null)
      throw { tag: "closed" };
    let contents = this.callback(Number(len));
    if (contents === null)
      throw { tag: "closed" };
    return contents;
  }
};
var CallbackOutputStream = class extends OutputStream {
  constructor(callback = null) {
    super();
    this.callback = callback;
  }
  checkWrite() {
    return 4096;
  }
  write(contents) {
    if (this.callback !== null)
      this.callback(contents);
  }
  flush() {
    if (this.callback !== null)
      this.callback(null);
  }
};
var TerminalInput = class {
};
var TerminalOutput = class {
};
var nextFilesystemId = /* @__PURE__ */ (function() {
  let id = 0;
  return () => id++;
})();
var File = class {
  constructor(data = "") {
    this.id = nextFilesystemId();
    if (data instanceof Uint8Array) {
      this.data = data;
    } else if (typeof data === "string") {
      this.data = new TextEncoder().encode(data);
    } else {
      throw new Error(`Cannot construct a file from ${typeof data}`);
    }
  }
  get size() {
    return this.data.length;
  }
};
var Directory = class _Directory {
  constructor(files = {}) {
    this.id = nextFilesystemId();
    this.files = files;
  }
  get size() {
    return Object.keys(this.files).length;
  }
  traverse(path, { create = null, remove = false } = {}) {
    let entry = this;
    let separatorAt = -1;
    do {
      if (entry instanceof File)
        throw "not-directory";
      const files = entry.files;
      separatorAt = path.indexOf("/");
      const segment = separatorAt === -1 ? path : path.substring(0, separatorAt);
      if (separatorAt === -1 && remove)
        delete files[segment];
      else if (segment === "" || segment === ".")
        ;
      else if (segment === "..")
        ;
      else if (Object.hasOwn(files, segment))
        entry = files[segment];
      else if (create === "directory" || create !== null && separatorAt !== -1)
        entry = files[segment] = new _Directory({});
      else if (create === "file")
        entry = files[segment] = new File(new Uint8Array());
      else if (create instanceof File || create instanceof _Directory)
        entry = files[segment] = create;
      else
        throw "no-entry";
      path = path.substring(separatorAt + 1);
    } while (separatorAt !== -1);
    return entry;
  }
};
var ReadStream = class extends InputStream {
  constructor(file, offset) {
    super();
    this.file = file;
    this.offset = offset;
  }
  read(len) {
    const data = this.file.data.subarray(Number(this.offset), Number(this.offset + len));
    this.offset += len;
    return data;
  }
};
var WriteStream = class extends OutputStream {
  constructor(file, offset) {
    super();
    this.file = file;
    this.offset = offset;
  }
  write(contents) {
    const offset = Number(this.offset);
    const newData = new Uint8Array(Math.max(this.file.data.length, offset + contents.length));
    newData.set(this.file.data);
    newData.subarray(offset).set(contents);
    this.file.data = newData;
    this.offset += BigInt(contents.length);
  }
};
var Descriptor = class _Descriptor {
  constructor(entry) {
    this.entry = entry;
  }
  getType() {
    if (this.entry instanceof Directory)
      return "directory";
    if (this.entry instanceof File)
      return "regular-file";
  }
  getFlags() {
    return {};
  }
  metadataHash() {
    return { upper: 0, lower: this.entry.id };
  }
  metadataHashAt(_pathFlags, path) {
    if (!(this.entry instanceof Directory))
      throw "invalid";
    const pathEntry = this.entry.traverse(path);
    return new _Descriptor(pathEntry).metadataHash();
  }
  stat() {
    let type;
    if (this.entry instanceof Directory)
      type = "directory";
    if (this.entry instanceof File)
      type = "regular-file";
    return {
      type,
      linkCount: 1,
      size: this.entry.size,
      dataAccessTimestamp: null,
      dataModificationTimestamp: null,
      statusChangeTimestamp: null
    };
  }
  statAt(_pathFlags, path) {
    if (!(this.entry instanceof Directory))
      throw "invalid";
    const pathEntry = this.entry.traverse(path);
    return new _Descriptor(pathEntry).stat();
  }
  openAt(_pathFlags, path, openFlags, _descriptorFlags) {
    if (!(this.entry instanceof Directory))
      throw "invalid";
    const openEntry = this.entry.traverse(path, openFlags.create ? { create: "file" } : {});
    if (openFlags.directory) {
      if (!(openEntry instanceof Directory))
        throw "not-directory";
    } else {
      if (openEntry instanceof Directory)
        throw "is-directory";
      if (openFlags.truncate)
        openEntry.data = new Uint8Array();
    }
    return new _Descriptor(openEntry);
  }
  read(length, offset) {
    if (this.entry instanceof Directory)
      throw "is-directory";
    [length, offset] = [Number(length), Number(offset)];
    return [this.entry.data.subarray(offset, offset + length), offset + length >= this.entry.data.byteLength];
  }
  readViaStream(offset) {
    return new ReadStream(this.entry, offset);
  }
  write(_buffer, _offset) {
    if (this.entry instanceof Directory)
      throw "is-directory";
    console.error("Descriptor.write not implemented");
    throw "unsupported";
  }
  writeViaStream(offset) {
    return new WriteStream(this.entry, offset);
  }
  setSize(size) {
    if (this.entry instanceof Directory)
      throw "is-directory";
    size = Number(size);
    if (size > this.entry.data.length) {
      const newData = new Uint8Array(size);
      newData.set(this.entry.data);
      this.entry.data = newData;
    } else if (size < this.entry.data.length) {
      this.entry.data = this.entry.data.subarray(0, size);
    }
  }
  readDirectory() {
    return new DirectoryEntryStream(this.entry);
  }
  createDirectoryAt(path) {
    this.entry.traverse(path, { create: "directory" });
  }
  unlinkFileAt(path) {
    const pathEntry = this.entry.traverse(path);
    if (pathEntry instanceof Directory)
      throw "is-directory";
    this.entry.traverse(path, { remove: true });
  }
  removeDirectoryAt(path) {
    const pathEntry = this.entry.traverse(path);
    if (!(pathEntry instanceof Directory))
      throw "not-directory";
    this.entry.traverse(path, { remove: true });
  }
  readlinkAt(path) {
    const _pathEntry = this.entry.traverse(path);
    throw "invalid";
  }
  renameAt(oldPath, newDescriptor, newPath) {
    if (!(this.entry instanceof Directory))
      throw "not-directory";
    if (!(newDescriptor.entry instanceof Directory))
      throw "not-directory";
    const oldEntry = this.entry.traverse(oldPath);
    this.entry.traverse(newPath, { create: oldEntry });
    this.entry.traverse(oldPath, { remove: true });
  }
};
var DirectoryEntryStream = class {
  constructor(directory) {
    this.entries = Object.entries(directory.files);
    this.index = 0;
  }
  readDirectoryEntry() {
    if (this.index === this.entries.length)
      return null;
    const [name, entry] = this.entries[this.index++];
    let type;
    if (entry instanceof Directory)
      type = "directory";
    if (entry instanceof File)
      type = "regular-file";
    return { name, type };
  }
};
function directoryFromTree(tree) {
  const files = {};
  for (const [filename, data] of Object.entries(tree)) {
    if (typeof data === "string" || data instanceof Uint8Array)
      files[filename] = new File(tree[filename]);
    else
      files[filename] = directoryFromTree(tree[filename]);
  }
  return new Directory(files);
}
function directoryIntoTree(directory, { decodeASCII = true } = {}) {
  function isASCII(buffer) {
    for (const byte of buffer)
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13 || byte >= 127)
        return false;
    return true;
  }
  const tree = {};
  for (const [filename, entry] of Object.entries(directory.files)) {
    if (entry instanceof File)
      tree[filename] = decodeASCII && isASCII(entry.data) ? new TextDecoder().decode(entry.data) : entry.data;
    if (entry instanceof Directory)
      tree[filename] = directoryIntoTree(entry, { decodeASCII });
  }
  return tree;
}
var Environment = class {
  vars = {};
  args = [];
  root = new Directory({});
  constructor() {
    this.prng = new Xoroshiro128StarStar(1n);
    this.standardInputStream = new CallbackInputStream();
    this.standardOutputStream = new CallbackOutputStream();
    this.standardErrorStream = new CallbackOutputStream();
    this.terminalInput = new TerminalInput();
    this.terminalOutput = new TerminalOutput();
    const $this = this;
    this.exports = {
      monotonicClock: {
        now: monotonicNow,
        subscribeDuration(time) {
          if (time !== 0n)
            throw new Error("unsupported");
          return new Pollable();
        },
        subscribeInstant() {
          throw new Error("unsupported");
        }
      },
      wallClock: {
        now: wallClockNow
      },
      random: {
        getRandomBytes(length) {
          return $this.prng.getBytes(Number(length));
        }
      },
      io: {
        Error: IoError,
        InputStream,
        OutputStream,
        Pollable,
        poll(list) {
          return Array.from(list, (p, i) => i);
        }
      },
      cli: {
        exit(status) {
          throw new Exit(status.tag === "ok" ? 0 : 1);
        },
        getEnvironment() {
          return $this.vars;
        },
        getArguments() {
          return $this.args;
        },
        getStdin() {
          return $this.standardInputStream;
        },
        getStdout() {
          return $this.standardOutputStream;
        },
        getStderr() {
          return $this.standardErrorStream;
        },
        getTerminalStdin() {
          return $this.terminalInput;
        },
        getTerminalStdout() {
          return $this.terminalOutput;
        },
        getTerminalStderr() {
          return $this.terminalOutput;
        },
        TerminalInput,
        TerminalOutput
      },
      fs: {
        Descriptor,
        DirectoryEntryStream,
        filesystemErrorCode() {
        },
        getDirectories() {
          if ($this.root === null) return [];
          return [[new Descriptor($this.root), "/"]];
        }
      }
    };
  }
  get stdin() {
    return this.standardInputStream.callback;
  }
  set stdin(callback) {
    this.standardInputStream.callback = callback;
  }
  get stdout() {
    return this.standardOutputStream.callback;
  }
  set stdout(callback) {
    this.standardOutputStream.callback = callback;
  }
  get stderr() {
    return this.standardErrorStream.callback;
  }
  set stderr(callback) {
    this.standardErrorStream.callback = callback;
  }
};

// node_modules/@yowasp/runtime/lib/util.js
function lineBuffered(processLine) {
  let buffer = new Uint8Array();
  return (bytes) => {
    if (bytes === null)
      return;
    let newBuffer = new Uint8Array(buffer.length + bytes.length);
    newBuffer.set(buffer);
    newBuffer.set(bytes, buffer.length);
    buffer = newBuffer;
    let newlineAt = -1;
    while (true) {
      const nextNewlineAt = buffer.indexOf(10, newlineAt + 1);
      if (nextNewlineAt === -1)
        break;
      processLine(new TextDecoder().decode(buffer.subarray(newlineAt + 1, nextNewlineAt)));
      newlineAt = nextNewlineAt;
    }
    buffer = buffer.subarray(newlineAt + 1);
  };
}

// node_modules/@yowasp/runtime/lib/api.js
var Application = class {
  #resourceModule;
  #resourceData;
  #instantiate;
  #argv0;
  constructor(resourceModule, instantiate2, argv0) {
    this.#resourceModule = resourceModule;
    this.#resourceData = null;
    this.#instantiate = instantiate2;
    this.#argv0 = argv0;
  }
  get argv0() {
    return this.#argv0;
  }
  async #fetchResources(fetchProgress) {
    const resourceModule = await this.#resourceModule;
    let fetchFn = fetch_default;
    if (fetchProgress !== void 0) {
      const status = { source: this, totalLength: resourceModule.totalSize, doneLength: 0 };
      fetchProgress(status);
      fetchFn = (input, init) => fetch_default(input, init).then((response) => {
        return new Response(response.body.pipeThrough(new TransformStream({
          transform(chunk, controller) {
            controller.enqueue(chunk);
            status.doneLength += chunk.length;
            fetchProgress(status);
          }
        })), response);
      });
    }
    const [modules2, filesystem2] = await Promise.all([
      resourceModule.modules(fetchFn),
      resourceModule.filesystem(fetchFn)
    ]);
    this.#resourceData = { modules: modules2, filesystem: filesystem2 };
  }
  // The `printLine` option is deprecated and not documented but still accepted for compatibility.
  run(args = null, files = {}, options = {}) {
    if (this.#resourceData === null) {
      if (options.synchronously)
        throw new Error("Cannot run application synchronously unless resources are prefetched first; use `await run()` to do so");
      const defaultFetchProgress = ({ source, totalLength, doneLength }) => {
        const percent = (100 * doneLength / totalLength).toFixed(0);
        console.log(`${source.argv0}: fetched ${percent}% (${doneLength} / ${totalLength})`);
      };
      return this.#fetchResources(options.fetchProgress ?? defaultFetchProgress).then(() => {
        return this.run(args, files, options);
      });
    }
    if (args === null)
      return;
    const environment = new Environment();
    environment.args = [this.#argv0].concat(args);
    environment.root = directoryFromTree(files);
    for (const [dirName, dirContents] of Object.entries(this.#resourceData.filesystem))
      environment.root.files[dirName] = directoryFromTree(dirContents);
    const lineBufferedConsole = lineBuffered(options.printLine ?? console.log);
    environment.stdin = options.stdin === void 0 ? null : options.stdin;
    environment.stdout = options.stdout === void 0 ? lineBufferedConsole : options.stdout;
    environment.stderr = options.stderr === void 0 ? lineBufferedConsole : options.stderr;
    const runCommand = (wasmCommand) => {
      let error = null;
      try {
        wasmCommand.run.run();
      } catch (e) {
        if (!(e instanceof Exit))
          throw e;
        if (e instanceof Exit && e.code !== 0)
          error = e;
      }
      for (const dirName of Object.keys(this.#resourceData.filesystem))
        delete environment.root.files[dirName];
      files = directoryIntoTree(environment.root, { decodeASCII: options.decodeASCII ?? true });
      if (error !== null) {
        error.files = files;
        throw error;
      } else {
        return files;
      }
    };
    const getCoreModule = (filename) => this.#resourceData.modules[filename];
    const imports = { runtime: environment.exports };
    if (options.synchronously) {
      const instantiateCore = (module, imports2) => new WebAssembly.Instance(module, imports2);
      return runCommand(this.#instantiate(getCoreModule, imports, instantiateCore));
    } else {
      return this.#instantiate(getCoreModule, imports).then(runCommand);
    }
  }
};

// gen/yosys-resources.js
var yosys_resources_exports = {};
__export(yosys_resources_exports, {
  filesystem: () => filesystem,
  modules: () => modules,
  totalSize: () => totalSize
});

// node_modules/nanotar/dist/index.mjs
var TAR_TYPE_FILE = 0;
var TAR_TYPE_DIR = 5;
function parseTar(data, opts) {
  const buffer = data.buffer || data;
  const files = [];
  let offset = 0;
  while (offset < buffer.byteLength - 512) {
    let name = _readString(buffer, offset, 100);
    if (name.length === 0) {
      break;
    }
    const mode = _readString(buffer, offset + 100, 8).trim();
    const uid = Number.parseInt(_readString(buffer, offset + 108, 8));
    const gid = Number.parseInt(_readString(buffer, offset + 116, 8));
    const size = _readNumber(buffer, offset + 124, 12);
    const seek = 512 + 512 * Math.trunc(size / 512) + (size % 512 ? 512 : 0);
    const mtime = _readNumber(buffer, offset + 136, 12);
    const _type = _readNumber(buffer, offset + 156, 1);
    const type = _type === TAR_TYPE_FILE ? "file" : _type === TAR_TYPE_DIR ? "directory" : _type;
    const user = _readString(buffer, offset + 265, 32);
    const group = _readString(buffer, offset + 297, 32);
    name = _sanitizePath(name);
    const meta = {
      name,
      type,
      size,
      attrs: {
        mode,
        uid,
        gid,
        mtime,
        user,
        group
      }
    };
    if (opts?.filter && !opts.filter(meta)) {
      offset += seek;
      continue;
    }
    if (opts?.metaOnly) {
      files.push(meta);
      offset += seek;
      continue;
    }
    const data2 = _type === TAR_TYPE_DIR ? void 0 : new Uint8Array(buffer, offset + 512, size);
    files.push({
      ...meta,
      data: data2,
      get text() {
        return new TextDecoder().decode(this.data);
      }
    });
    offset += seek;
  }
  return files;
}
function _sanitizePath(path) {
  let normalized = path.replace(/\\/g, "/");
  normalized = normalized.replace(/^[a-zA-Z]:\//, "");
  normalized = normalized.replace(/^\/+/, "");
  const hasLeadingDotSlash = normalized.startsWith("./");
  const parts = normalized.split("/");
  const resolved = [];
  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== "." && part !== "") {
      resolved.push(part);
    }
  }
  let result = resolved.join("/");
  if (hasLeadingDotSlash && !result.startsWith("./")) {
    result = "./" + result;
  }
  if (path.endsWith("/") && !result.endsWith("/")) {
    result += "/";
  }
  return result;
}
function _readString(buffer, offset, size) {
  const view = new Uint8Array(buffer, offset, size);
  const i = view.indexOf(0);
  const td = new TextDecoder();
  return td.decode(i === -1 ? view : view.slice(0, i));
}
function _readNumber(buffer, offset, size) {
  const view = new Uint8Array(buffer, offset, size);
  let str = "";
  for (let i = 0; i < size; i++) {
    str += String.fromCodePoint(view[i]);
  }
  return Number.parseInt(str, 8);
}

// gen/yosys-resources.js
function compileWasmModule(response) {
  if (WebAssembly.compileStreaming !== void 0) {
    return WebAssembly.compileStreaming(response);
  } else {
    return WebAssembly.compile(response.arrayBuffer());
  }
}
function unpackTarFilesystem(buffer) {
  const root = {};
  for (const tarEntry of parseTar(buffer)) {
    const nameParts = tarEntry.name.split("/");
    const dirNames = nameParts.slice(0, -1);
    const fileName = nameParts[nameParts.length - 1];
    let dir = root;
    for (const dirName of dirNames)
      dir = dir[dirName];
    if (tarEntry.type === "directory") {
      dir[fileName] = {};
    } else {
      dir[fileName] = tarEntry.data;
    }
  }
  return root;
}
var modules = async (fetch3) => ({
  "yosys.core.wasm": await fetch3(new URL("./yosys.core.wasm", import.meta.url)).then(compileWasmModule),
  "yosys.core2.wasm": await fetch3(new URL("./yosys.core2.wasm", import.meta.url)).then(compileWasmModule),
  "yosys.core3.wasm": await fetch3(new URL("./yosys.core3.wasm", import.meta.url)).then(compileWasmModule),
  "yosys.core4.wasm": await fetch3(new URL("./yosys.core4.wasm", import.meta.url)).then(compileWasmModule)
});
var filesystem = async (fetch3) => {
  var chunks = [];
  chunks.push(await fetch3(new URL("./yosys-resources.0.tar", import.meta.url)).then((resp) => resp.arrayBuffer()));
  return {
    "share": await new Blob(chunks).arrayBuffer().then(unpackTarFilesystem)
  };
};
var totalSize = 77829808;

// gen/yosys.js
function instantiate(getCoreModule, imports, instantiateCore = WebAssembly.instantiate) {
  function promiseWithResolvers() {
    if (Promise.withResolvers) {
      return Promise.withResolvers();
    } else {
      let resolve2;
      let reject2;
      const promise2 = new Promise((res, rej) => {
        resolve2 = res;
        reject2 = rej;
      });
      return { promise: promise2, resolve: resolve2, reject: reject2 };
    }
  }
  const symbolDispose = Symbol.dispose || Symbol.for("dispose");
  const symbolAsyncIterator = Symbol.asyncIterator;
  const symbolIterator = Symbol.iterator;
  const _debugLog = (...args) => {
    if (!globalThis?.process?.env?.JCO_DEBUG) {
      return;
    }
    console.debug(...args);
  };
  const ASYNC_DETERMINISM = "random";
  const GLOBAL_COMPONENT_MEMORY_MAP = /* @__PURE__ */ new Map();
  const CURRENT_TASK_META = {};
  function _getGlobalCurrentTaskMeta(componentIdx2) {
    const v = CURRENT_TASK_META[componentIdx2];
    if (v === void 0) {
      return v;
    }
    return { ...v };
  }
  function _setGlobalCurrentTaskMeta(args) {
    if (!args) {
      throw new TypeError("args missing");
    }
    if (args.taskID === void 0) {
      throw new TypeError("missing task ID");
    }
    if (args.componentIdx === void 0) {
      throw new TypeError("missing component idx");
    }
    const { taskID, componentIdx: componentIdx2 } = args;
    return CURRENT_TASK_META[componentIdx2] = { taskID, componentIdx: componentIdx2 };
  }
  function _withGlobalCurrentTaskMeta(args) {
    _debugLog("[_withGlobalCurrentTaskMeta()] args", args);
    if (!args) {
      throw new TypeError("args missing");
    }
    if (args.taskID === void 0) {
      throw new TypeError("missing task ID");
    }
    if (args.componentIdx === void 0) {
      throw new TypeError("missing component idx");
    }
    if (!args.fn) {
      throw new TypeError("missing fn");
    }
    const { taskID, componentIdx: componentIdx2, fn } = args;
    try {
      CURRENT_TASK_META[componentIdx2] = { taskID, componentIdx: componentIdx2 };
      return fn();
    } catch (err) {
      _debugLog("error while executing sync callee/callback", {
        ...args,
        err
      });
      throw err;
    } finally {
      CURRENT_TASK_META[componentIdx2] = null;
    }
  }
  async function _withGlobalCurrentTaskMetaAsync(args) {
    _debugLog("[_withGlobalCurrentTaskMetaAsync()] args", args);
    if (!args) {
      throw new TypeError("args missing");
    }
    if (args.taskID === void 0) {
      throw new TypeError("missing task ID");
    }
    if (args.componentIdx === void 0) {
      throw new TypeError("missing component idx");
    }
    if (!args.fn) {
      throw new TypeError("missing fn");
    }
    const { taskID, componentIdx: componentIdx2, fn } = args;
    let current = CURRENT_TASK_META[componentIdx2];
    let cstate;
    if (current && current.taskID !== taskID) {
      cstate = getOrCreateAsyncState(componentIdx2);
      while (current && current.taskID !== taskID) {
        const { promise: promise2, resolve: resolve2 } = Promise.withResolvers();
        cstate.onNextExclusiveRelease(resolve2);
        await promise2;
        current = CURRENT_TASK_META[componentIdx2];
      }
      cstate.exclusiveLock();
    }
    try {
      CURRENT_TASK_META[componentIdx2] = { taskID, componentIdx: componentIdx2 };
      return await fn();
    } catch (err) {
      _debugLog("error while executing async callee/callback", {
        ...args,
        err
      });
      throw err;
    } finally {
      CURRENT_TASK_META[componentIdx2] = null;
    }
  }
  async function _clearCurrentTask(args) {
    _debugLog("[_clearCurrentTask()] args", args);
    if (!args) {
      throw new TypeError("args missing");
    }
    if (args.taskID === void 0) {
      throw new TypeError("missing task ID");
    }
    if (args.componentIdx === void 0) {
      throw new TypeError("missing component idx");
    }
    const { taskID, componentIdx: componentIdx2 } = args;
    const meta = CURRENT_TASK_META[componentIdx2];
    if (!meta) {
      throw new Error(`missing current task meta for component idx [${componentIdx2}]n`);
    }
    if (meta.taskID !== taskID) {
      throw new Error(`task ID [${meta.taskID}] != requested ID [${taskID}]`);
    }
    if (meta.componentIdx !== componentIdx2) {
      throw new Error(`component idx [${meta.componentIdx}] != requested idx [${componentIdx2}]`);
    }
    CURRENT_TASK_META[componentIdx2] = null;
  }
  function lookupMemoriesForComponent(args) {
    const { componentIdx: componentIdx2 } = args ?? {};
    if (args.componentIdx === void 0) {
      throw new TypeError("missing component idx");
    }
    const metas = GLOBAL_COMPONENT_MEMORY_MAP.get(componentIdx2);
    if (!metas) {
      return [];
    }
    if (args.memoryIdx === void 0) {
      return Object.values(metas);
    }
    const meta = metas[args.memoryIdx];
    return meta?.memory;
  }
  function registerGlobalMemoryForComponent(args) {
    const { componentIdx: componentIdx2, memory, memoryIdx } = args ?? {};
    if (componentIdx2 === void 0) {
      throw new TypeError("missing component idx");
    }
    if (memory === void 0 && memoryIdx === void 0) {
      throw new TypeError("missing both memory & memory idx");
    }
    let inner = GLOBAL_COMPONENT_MEMORY_MAP.get(componentIdx2);
    if (!inner) {
      inner = {};
      GLOBAL_COMPONENT_MEMORY_MAP.set(componentIdx2, inner);
    }
    inner[memoryIdx] = { memory, memoryIdx, componentIdx: componentIdx2 };
  }
  class RepTable {
    #data = [0, null];
    #target;
    constructor(args) {
      this.target = args?.target;
    }
    data() {
      return this.#data;
    }
    insert(val) {
      _debugLog("[RepTable#insert()] args", { val, target: this.target });
      const freeIdx = this.#data[0];
      if (freeIdx === 0) {
        this.#data.push(val);
        this.#data.push(null);
        const rep2 = (this.#data.length >> 1) - 1;
        _debugLog("[RepTable#insert()] inserted", { val, target: this.target, rep: rep2 });
        return rep2;
      }
      this.#data[0] = this.#data[freeIdx << 1];
      const placementIdx = freeIdx << 1;
      this.#data[placementIdx] = val;
      this.#data[placementIdx + 1] = null;
      _debugLog("[RepTable#insert()] inserted", { val, target: this.target, rep: freeIdx });
      return freeIdx;
    }
    get(rep2) {
      _debugLog("[RepTable#get()] args", { rep: rep2, target: this.target });
      if (rep2 === 0) {
        throw new Error("invalid resource rep during get, (cannot be 0)");
      }
      const baseIdx = rep2 << 1;
      const val = this.#data[baseIdx];
      return val;
    }
    contains(rep2) {
      _debugLog("[RepTable#contains()] args", { rep: rep2, target: this.target });
      if (rep2 === 0) {
        throw new Error("invalid resource rep during contains, (cannot be 0)");
      }
      const baseIdx = rep2 << 1;
      return !!this.#data[baseIdx];
    }
    remove(rep2) {
      _debugLog("[RepTable#remove()] args", { rep: rep2, target: this.target });
      if (rep2 === 0) {
        throw new Error("invalid resource rep during remove, (cannot be 0)");
      }
      if (this.#data.length === 2) {
        throw new Error("invalid");
      }
      const baseIdx = rep2 << 1;
      const val = this.#data[baseIdx];
      this.#data[baseIdx] = this.#data[0];
      this.#data[0] = rep2;
      return val;
    }
    clear() {
      _debugLog("[RepTable#clear()] args", { rep, target: this.target });
      this.#data = [0, null];
    }
  }
  const _coinFlip = () => {
    return Math.random() > 0.5;
  };
  let SCOPE_ID = 0;
  const I32_MIN = -2147483648;
  const I32_MAX = 2147483647;
  function _isValidNumericPrimitive(ty, v) {
    if (v === void 0 || v === null) {
      return false;
    }
    switch (ty) {
      case "bool":
        return v === 0 || v === 1;
        break;
      case "u8":
        return v >= 0 && v <= 255;
        break;
      case "s8":
        return v >= -128 && v <= 127;
        break;
      case "u16":
        return v >= 0 && v <= 65535;
        break;
      case "s16":
        return v >= -32768 && v <= 32767;
      case "u32":
        return v >= 0 && v <= 4294967295;
      case "s32":
        return v >= -2147483648 && v <= 2147483647;
      case "u64":
        return typeof v === "bigint" && v >= 0 && v <= 18446744073709551615n;
      case "s64":
        return typeof v === "bigint" && v >= -9223372036854775808n && v <= 9223372036854775807n;
        break;
      case "f32":
      case "f64":
        return typeof v === "number";
      default:
        return false;
    }
    return true;
  }
  function _requireValidNumericPrimitive(ty, v) {
    if (v === void 0 || v === null || !_isValidNumericPrimitive(ty, v)) {
      throw new TypeError(`invalid ${ty} value [${v}]`);
    }
    return true;
  }
  const _typeCheckValidI32 = (n) => typeof n === "number" && n >= I32_MIN && n <= I32_MAX;
  const _typeCheckAsyncFn = (f) => {
    return f instanceof ASYNC_FN_CTOR;
  };
  let RESOURCE_CALL_BORROWS = [];
  const ASYNC_FN_CTOR = (async () => {
  }).constructor;
  function clearCurrentTask(componentIdx2, taskID) {
    _debugLog("[clearCurrentTask()] args", { componentIdx: componentIdx2, taskID });
    if (componentIdx2 === void 0 || componentIdx2 === null) {
      throw new Error("missing/invalid component instance index while ending current task");
    }
    const tasks = ASYNC_TASKS_BY_COMPONENT_IDX.get(componentIdx2);
    if (!tasks || !Array.isArray(tasks)) {
      throw new Error("missing/invalid tasks for component instance while ending task");
    }
    if (tasks.length == 0) {
      throw new Error(`no current tasks for component instance [${componentIdx2}] while ending task`);
    }
    if (taskID !== void 0) {
      const last = tasks[tasks.length - 1];
      if (last.id !== taskID) {
        return;
      }
    }
    ASYNC_CURRENT_TASK_IDS.pop();
    ASYNC_CURRENT_COMPONENT_IDXS.pop();
    const taskMeta = tasks.pop();
    return taskMeta.task;
  }
  const CURRENT_TASK_MAY_BLOCK = new WebAssembly.Global({ value: "i32", mutable: true }, 0);
  const ASYNC_CURRENT_TASK_IDS = [];
  const ASYNC_CURRENT_COMPONENT_IDXS = [];
  function unpackCallbackResult(result) {
    if (!_typeCheckValidI32(result)) {
      throw new Error("invalid callback return value [" + result + "], not a valid i32");
    }
    const eventCode = result & 15;
    if (eventCode < 0 || eventCode > 3) {
      throw new Error("invalid async return value [" + eventCode + "], outside callback code range");
    }
    if (result < 0 || result >= 2 ** 32) {
      throw new Error("invalid callback result");
    }
    const waitableSetRep = result >> 4;
    return [eventCode, waitableSetRep];
  }
  class AsyncSubtask {
    static _ID = 0n;
    static State = {
      STARTING: 0,
      STARTED: 1,
      RETURNED: 2,
      CANCELLED_BEFORE_STARTED: 3,
      CANCELLED_BEFORE_RETURNED: 4
    };
    #id;
    #state = AsyncSubtask.State.STARTING;
    #componentIdx;
    #parentTask;
    #childTask = null;
    #dropped = false;
    #cancelRequested = false;
    #memoryIdx = null;
    #lenders = null;
    #waitable = null;
    #callbackFn = null;
    #callbackFnName = null;
    #postReturnFn = null;
    #onProgressFn = null;
    #pendingEventFn = null;
    #callMetadata = {};
    #resolved = false;
    #onResolveHandlers = [];
    #onStartHandlers = [];
    #result = null;
    #resultSet = false;
    fnName;
    target;
    isAsync;
    isManualAsync;
    constructor(args) {
      if (typeof args.componentIdx !== "number") {
        throw new Error("invalid componentIdx for subtask creation");
      }
      this.#componentIdx = args.componentIdx;
      this.#id = ++AsyncSubtask._ID;
      this.fnName = args.fnName;
      if (!args.parentTask) {
        throw new Error("missing parent task during subtask creation");
      }
      this.#parentTask = args.parentTask;
      if (args.childTask) {
        this.#childTask = args.childTask;
      }
      if (args.memoryIdx) {
        this.#memoryIdx = args.memoryIdx;
      }
      if (!args.waitable) {
        throw new Error("missing/invalid waitable");
      }
      this.#waitable = args.waitable;
      if (args.callMetadata) {
        this.#callMetadata = args.callMetadata;
      }
      this.#lenders = [];
      this.target = args.target;
      this.isAsync = args.isAsync;
      this.isManualAsync = args.isManualAsync;
    }
    id() {
      return this.#id;
    }
    parentTaskID() {
      return this.#parentTask?.id();
    }
    childTaskID() {
      return this.#childTask?.id();
    }
    state() {
      return this.#state;
    }
    waitable() {
      return this.#waitable;
    }
    waitableRep() {
      return this.#waitable.idx();
    }
    join() {
      return this.#waitable.join(...arguments);
    }
    getPendingEvent() {
      return this.#waitable.getPendingEvent(...arguments);
    }
    hasPendingEvent() {
      return this.#waitable.hasPendingEvent(...arguments);
    }
    setPendingEvent() {
      return this.#waitable.setPendingEvent(...arguments);
    }
    setTarget(tgt) {
      this.target = tgt;
    }
    getResult() {
      if (!this.#resultSet) {
        throw new Error("subtask result has not been set");
      }
      return this.#result;
    }
    setResult(v) {
      if (this.#resultSet) {
        throw new Error("subtask result has already been set");
      }
      this.#result = v;
      this.#resultSet = true;
    }
    componentIdx() {
      return this.#componentIdx;
    }
    setChildTask(t) {
      if (!t) {
        throw new Error("cannot set missing/invalid child task on subtask");
      }
      if (this.#childTask) {
        throw new Error("child task is already set on subtask");
      }
      if (this.#parentTask === t) {
        throw new Error("parent cannot be child");
      }
      this.#childTask = t;
    }
    getChildTask(t) {
      return this.#childTask;
    }
    getParentTask() {
      return this.#parentTask;
    }
    setCallbackFn(f, name) {
      if (!f) {
        return;
      }
      if (this.#callbackFn) {
        throw new Error("callback fn can only be set once");
      }
      this.#callbackFn = f;
      this.#callbackFnName = name;
    }
    getCallbackFnName() {
      if (!this.#callbackFn) {
        return void 0;
      }
      return this.#callbackFn.name;
    }
    setPostReturnFn(f) {
      if (!f) {
        return;
      }
      if (this.#postReturnFn) {
        throw new Error("postReturn fn can only be set once");
      }
      this.#postReturnFn = f;
    }
    setOnProgressFn(f) {
      if (this.#onProgressFn) {
        throw new Error("on progress fn can only be set once");
      }
      this.#onProgressFn = f;
    }
    isNotStarted() {
      return this.#state == AsyncSubtask.State.STARTING;
    }
    registerOnStartHandler(f) {
      this.#onStartHandlers.push(f);
    }
    onStart(args) {
      _debugLog("[AsyncSubtask#onStart()] args", {
        componentIdx: this.#componentIdx,
        subtaskID: this.#id,
        parentTaskID: this.parentTaskID(),
        fnName: this.fnName
      });
      if (this.#onProgressFn) {
        this.#onProgressFn();
      }
      this.#state = AsyncSubtask.State.STARTED;
      let result;
      if (this.#callMetadata.startFn) {
        result = this.#callMetadata.startFn.apply(null, args?.startFnParams ?? []);
      }
      return result;
    }
    registerOnResolveHandler(f) {
      this.#onResolveHandlers.push(f);
    }
    reject(subtaskErr) {
      this.#childTask?.reject(subtaskErr);
    }
    onResolve(subtaskValue) {
      _debugLog("[AsyncSubtask#onResolve()] args", {
        componentIdx: this.#componentIdx,
        subtaskID: this.#id,
        isAsync: this.isAsync,
        childTaskID: this.childTaskID(),
        parentTaskID: this.parentTaskID(),
        parentTaskFnName: this.#parentTask?.entryFnName(),
        fnName: this.fnName
      });
      if (this.#resolved) {
        throw new Error("subtask has already been resolved");
      }
      if (this.#onProgressFn) {
        this.#onProgressFn();
      }
      if (subtaskValue === null) {
        if (this.#cancelRequested) {
          throw new Error("cancel was not requested, but no value present at return");
        }
        if (this.#state === AsyncSubtask.State.STARTING) {
          this.#state = AsyncSubtask.State.CANCELLED_BEFORE_STARTED;
        } else {
          if (this.#state !== AsyncSubtask.State.STARTED) {
            throw new Error("resolved subtask must have been started before cancellation");
          }
          this.#state = AsyncSubtask.State.CANCELLED_BEFORE_RETURNED;
        }
      } else {
        if (this.#state !== AsyncSubtask.State.STARTED) {
          throw new Error("resolved subtask must have been started before completion");
        }
        this.#state = AsyncSubtask.State.RETURNED;
      }
      this.setResult(subtaskValue);
      for (const f of this.#onResolveHandlers) {
        try {
          f(subtaskValue);
        } catch (err) {
          console.error("error during subtask resolve handler", err);
          throw err;
        }
      }
      const callMetadata = this.getCallMetadata();
      const memory = callMetadata.memory ?? this.#parentTask?.getReturnMemory() ?? lookupMemoriesForComponent({ componentIdx: this.#parentTask?.componentIdx() })[0];
      if (callMetadata && !callMetadata.returnFn && this.isAsync && callMetadata.resultPtr && memory) {
        const { resultPtr, realloc } = callMetadata;
        const lowers = callMetadata.lowers;
        if (lowers && lowers.length > 0) {
          lowers[0]({
            componentIdx: this.#componentIdx,
            memory,
            realloc,
            vals: [subtaskValue],
            storagePtr: resultPtr,
            stringEncoding: callMetadata.stringEncoding
          });
        }
      }
      this.#resolved = true;
      this.#parentTask.removeSubtask(this);
    }
    getStateNumber() {
      return this.#state;
    }
    isReturned() {
      return this.#state === AsyncSubtask.State.RETURNED;
    }
    getCallMetadata() {
      return this.#callMetadata;
    }
    isResolved() {
      if (this.#state === AsyncSubtask.State.STARTING || this.#state === AsyncSubtask.State.STARTED) {
        return false;
      }
      if (this.#state === AsyncSubtask.State.RETURNED || this.#state === AsyncSubtask.State.CANCELLED_BEFORE_STARTED || this.#state === AsyncSubtask.State.CANCELLED_BEFORE_RETURNED) {
        return true;
      }
      throw new Error("unrecognized internal Subtask state [" + this.#state + "]");
    }
    addLender(handle) {
      _debugLog("[AsyncSubtask#addLender()] args", { handle });
      if (!Number.isNumber(handle)) {
        throw new Error("missing/invalid lender handle [" + handle + "]");
      }
      if (this.#lenders.length === 0 || this.isResolved()) {
        throw new Error("subtask has no lendors or has already been resolved");
      }
      handle.lends++;
      this.#lenders.push(handle);
    }
    deliverResolve() {
      _debugLog("[AsyncSubtask#deliverResolve()] args", {
        lenders: this.#lenders,
        parentTaskID: this.parentTaskID(),
        subtaskID: this.#id,
        childTaskID: this.childTaskID(),
        resolved: this.isResolved(),
        resolveDelivered: this.resolveDelivered()
      });
      const cannotDeliverResolve = this.resolveDelivered() || !this.isResolved();
      if (cannotDeliverResolve) {
        throw new Error("subtask cannot deliver resolution twice, and the subtask must be resolved");
      }
      for (const lender of this.#lenders) {
        lender.lends--;
      }
      this.#lenders = null;
    }
    resolveDelivered() {
      _debugLog("[AsyncSubtask#resolveDelivered()] args", {});
      if (this.#lenders === null && !this.isResolved()) {
        throw new Error("invalid subtask state, lenders missing and subtask has not been resolved");
      }
      return this.#lenders === null;
    }
    drop() {
      _debugLog("[AsyncSubtask#drop()] args", {
        componentIdx: this.#componentIdx,
        parentTaskID: this.#parentTask?.id(),
        parentTaskFnName: this.#parentTask?.entryFnName(),
        childTaskID: this.#childTask?.id(),
        childTaskFnName: this.#childTask?.entryFnName(),
        subtaskFnName: this.fnName
      });
      if (!this.#waitable) {
        throw new Error("missing/invalid inner waitable");
      }
      if (!this.resolveDelivered()) {
        throw new Error("cannot drop subtask before resolve is delivered");
      }
      if (this.#waitable) {
        this.#waitable.drop();
      }
      this.#dropped = true;
    }
    #getComponentState() {
      const state = getOrCreateAsyncState(this.#componentIdx);
      if (!state) {
        throw new Error("invalid/missing async state for component [" + componentIdx + "]");
      }
      return state;
    }
    getWaitableHandleIdx() {
      _debugLog("[AsyncSubtask#getWaitableHandleIdx()] args", {});
      if (!this.#waitable) {
        throw new Error("missing/invalid waitable");
      }
      return this.waitableRep();
    }
  }
  function _prepareCall(memoryIdx, getMemoryFn, startFn, returnFn, callerComponentIdx, calleeComponentIdx, taskReturnTypeIdx, calleeIsAsyncInt, stringEncoding, resultCountOrAsync) {
    _debugLog("[_prepareCall()]", {
      memoryIdx,
      callerComponentIdx,
      calleeComponentIdx,
      taskReturnTypeIdx,
      calleeIsAsyncInt,
      stringEncoding,
      resultCountOrAsync
    });
    const argArray = [...arguments];
    resultCountOrAsync >>>= 0;
    let isAsync = false;
    let hasResultPointer = false;
    if (resultCountOrAsync === 2 ** 32 - 1) {
      isAsync = true;
      hasResultPointer = false;
    } else if (resultCountOrAsync === 2 ** 32 - 2) {
      isAsync = true;
      hasResultPointer = true;
    }
    const currentCallerTaskMeta = getCurrentTask(callerComponentIdx);
    if (!currentCallerTaskMeta) {
      throw new Error("invalid/missing current task for caller during prepare call");
    }
    const currentCallerTask = currentCallerTaskMeta.task;
    if (!currentCallerTask) {
      throw new Error("unexpectedly missing task in meta for caller during prepare call");
    }
    if (currentCallerTask.componentIdx() !== callerComponentIdx) {
      throw new Error(`task component idx [${currentCallerTask.componentIdx()}] !== [${callerComponentIdx}] (callee ${calleeComponentIdx})`);
    }
    let getCalleeParamsFn;
    let resultPtr = null;
    let directParamsArr;
    if (hasResultPointer) {
      directParamsArr = argArray.slice(10, argArray.length - 1);
      getCalleeParamsFn = () => directParamsArr;
      resultPtr = argArray[argArray.length - 1];
    } else {
      directParamsArr = argArray.slice(10);
      getCalleeParamsFn = () => directParamsArr;
    }
    let encoding;
    switch (stringEncoding) {
      case 0:
        encoding = "utf8";
        break;
      case 1:
        encoding = "utf16";
        break;
      case 2:
        encoding = "compact-utf16";
        break;
      default:
        throw new Error(`unrecognized string encoding enum [${stringEncoding}]`);
    }
    const subtask = currentCallerTask.createSubtask({
      componentIdx: callerComponentIdx,
      parentTask: currentCallerTask,
      isAsync,
      callMetadata: {
        getMemoryFn,
        memoryIdx,
        resultPtr,
        returnFn,
        startFn,
        stringEncoding
      }
    });
    const [newTask, newTaskID] = createNewCurrentTask({
      componentIdx: calleeComponentIdx,
      isAsync,
      getCalleeParamsFn,
      entryFnName: [
        "task",
        subtask.getParentTask().id(),
        "subtask",
        subtask.id(),
        "new-prepared-async-task"
      ].join("/"),
      stringEncoding
    });
    newTask.setParentSubtask(subtask);
    newTask.setReturnMemoryIdx(memoryIdx);
    newTask.setReturnMemory(getMemoryFn);
    subtask.setChildTask(newTask);
    newTask.subtaskMeta = {
      subtask,
      calleeComponentIdx,
      callerComponentIdx,
      getCalleeParamsFn,
      stringEncoding,
      isAsync
    };
    _setGlobalCurrentTaskMeta({
      taskID: newTask.id(),
      componentIdx: newTask.componentIdx()
    });
  }
  function _asyncStartCall(args, callee, paramCount, resultCount, flags) {
    const componentIdx2 = ASYNC_CURRENT_COMPONENT_IDXS.at(-1);
    const globalTaskMeta = _getGlobalCurrentTaskMeta(componentIdx2);
    if (!globalTaskMeta) {
      throw new Error("missing global current task globalTaskMeta");
    }
    const taskID = globalTaskMeta.taskID;
    _debugLog("[_asyncStartCall()] args", { args, componentIdx: componentIdx2 });
    const { getCallbackFn, callbackIdx, getPostReturnFn, postReturnIdx } = args;
    const preparedTaskMeta = getCurrentTask(componentIdx2, taskID);
    if (!preparedTaskMeta) {
      throw new Error("unexpectedly missing current task");
    }
    const preparedTask = preparedTaskMeta.task;
    if (!preparedTask) {
      throw new Error("unexpectedly missing current task");
    }
    if (!preparedTask.subtaskMeta) {
      throw new Error("missing subtask meta from prepare");
    }
    const {
      subtask,
      returnMemoryIdx,
      getReturnMemoryFn,
      callerComponentIdx,
      calleeComponentIdx,
      getCalleeParamsFn,
      isAsync,
      stringEncoding
    } = preparedTask.subtaskMeta;
    if (!subtask) {
      throw new Error("missing subtask from cstate during async start call");
    }
    if (calleeComponentIdx !== preparedTask.componentIdx()) {
      throw new Error(`meta callee idx [${calleeComponentIdx}] != current task idx [${preparedTask.componentIdx()}] during async start call`);
    }
    if (calleeComponentIdx !== componentIdx2) {
      throw new Error("mismatched componentIdx for async start call (does not match prepare)");
    }
    const argArray = [...arguments];
    if (resultCount < 0 || resultCount > 1) {
      throw new Error("invalid/unsupported result count");
    }
    const callbackFnName = "callback_" + callbackIdx;
    const callbackFn = getCallbackFn();
    preparedTask.setCallbackFn(callbackFn, callbackFnName);
    preparedTask.setPostReturnFn(getPostReturnFn());
    if (resultCount < 0 || resultCount > 1) {
      throw new Error(`unsupported result count [${resultCount}]`);
    }
    const params2 = preparedTask.getCalleeParams();
    if (paramCount !== params2.length) {
      throw new Error(`unexpected callee param count [${params2.length}], _asyncStartCall invocation expected [${paramCount}]`);
    }
    const callerComponentState = getOrCreateAsyncState(subtask.componentIdx());
    const calleeComponentState = getOrCreateAsyncState(preparedTask.componentIdx());
    const calleeBackpressure = calleeComponentState.hasBackpressure();
    subtask.registerOnResolveHandler((res) => {
      _debugLog("[_asyncStartCall()] handling subtask result", { res, subtaskID: subtask.id() });
      let subtaskCallMeta = subtask.getCallMetadata();
      if (subtaskCallMeta.memory || subtaskCallMeta.realloc) {
        throw new Error("call metadata unexpectedly contains memory/realloc for guest->guest call");
      }
      const callerTask = subtask.getParentTask();
      const calleeTask = preparedTask;
      const callerMemoryIdx = callerTask.getReturnMemoryIdx();
      const callerComponentIdx2 = callerTask.componentIdx();
      if (subtaskCallMeta && subtaskCallMeta.returnFn) {
        _debugLog("[_asyncStartCall()] return function present while handling subtask result, returning early (skipping lower)");
        if (subtaskCallMeta.returnFnCalled) {
          return;
        }
        subtaskCallMeta.returnFn.apply(null, [subtaskCallMeta.resultPtr]);
        return;
      }
      if (!subtaskCallMeta.resultPtr) {
        _debugLog("[_asyncStartCall()] no result ptr during subtask result handling, returning early (skipping lower)");
        return;
      }
      let callerMemory;
      if (callerMemoryIdx !== null && callerMemoryIdx !== void 0) {
        callerMemory = lookupMemoriesForComponent({ componentIdx: callerComponentIdx2, memoryIdx: callerMemoryIdx });
      } else {
        const callerMemories = lookupMemoriesForComponent({ componentIdx: callerComponentIdx2 });
        if (callerMemories.length !== 1) {
          throw new Error(`unsupported amount of caller memories`);
        }
        callerMemory = callerMemories[0];
      }
      if (!callerMemory) {
        _debugLog("[_asyncStartCall()] missing memory", { subtaskID: subtask.id(), res });
        throw new Error(`missing memory for to guest->guest call result (subtask [${subtask.id()}])`);
      }
      const lowerFns = calleeTask.getReturnLowerFns();
      if (!lowerFns || lowerFns.length === 0) {
        _debugLog("[_asyncStartCall()] missing result lower metadata for guest->guest call", { subtaskID: subtask.id() });
        throw new Error(`missing result lower metadata for guest->guest call (subtask [${subtask.id()}])`);
      }
      if (lowerFns.length !== 1) {
        _debugLog("[_asyncStartCall()] only single result reportetd for guest->guest call", { subtaskID: subtask.id() });
        throw new Error(`only single result supported for guest->guest calls (subtask [${subtask.id()}])`);
      }
      _debugLog("[_asyncStartCall()] lowering results", { subtaskID: subtask.id() });
      lowerFns[0]({
        realloc: void 0,
        memory: callerMemory,
        vals: [res],
        storagePtr: subtaskCallMeta.resultPtr,
        componentIdx: callerComponentIdx2,
        stringEncoding: subtaskCallMeta.stringEncoding
      });
    });
    subtask.setOnProgressFn(() => {
      subtask.setPendingEvent(() => {
        if (subtask.isResolved()) {
          subtask.deliverResolve();
        }
        const event = {
          code: ASYNC_EVENT_CODE.SUBTASK,
          payload0: subtask.waitableRep(),
          payload1: subtask.getStateNumber()
        };
        return event;
      });
    });
    queueMicrotask(async () => {
      let startRes = subtask.onStart({ startFnParams: params2 });
      startRes = Array.isArray(startRes) ? startRes : [startRes];
      await calleeComponentState.suspendTask({
        task: preparedTask,
        readyFn: () => !calleeComponentState.isExclusivelyLocked()
      });
      const started = await preparedTask.enter();
      if (!started) {
        _debugLog("[_asyncStartCall()] task failed early", {
          taskID: preparedTask.id(),
          subtaskID: subtask.id()
        });
        throw new Error("task failed to start");
        return;
      }
      let callbackResult;
      try {
        let jspiCallee = WebAssembly.promising(callee);
        callbackResult = await _withGlobalCurrentTaskMetaAsync({
          taskID: preparedTask.id(),
          componentIdx: preparedTask.componentIdx(),
          fn: () => {
            return jspiCallee.apply(null, startRes);
          }
        });
      } catch (err) {
        _debugLog("[_asyncStartCall()] initial subtask callee run failed", err);
        subtask.getParentTask().setErrored(err);
        return;
      }
      if (!callbackFn) {
        _debugLog("[_asyncStartCall()] no callback, resolving w/ callee result", {
          taskID: preparedTask.id(),
          componentIdx: preparedTask.componentIdx(),
          preparedTask,
          stateNumber: preparedTask.taskState(),
          isResolved: preparedTask.isResolved(),
          callbackFn
        });
        preparedTask.resolve([callbackResult]);
        return;
      }
      let fnName = callbackFn.fnName;
      if (!fnName) {
        fnName = [
          "<task ",
          subtask.parentTaskID(),
          "/subtask ",
          subtask.id(),
          "/task ",
          preparedTask.id(),
          ">"
        ].join("");
      }
      try {
        _debugLog("[_asyncStartCall()] starting driver loop", {
          fnName,
          componentIdx: preparedTask.componentIdx(),
          subtaskID: subtask.id(),
          childTaskID: subtask.childTaskID(),
          parentTaskID: subtask.parentTaskID()
        });
        await _driverLoop({
          componentState: calleeComponentState,
          task: preparedTask,
          fnName,
          isAsync: true,
          callbackResult,
          resolve,
          reject
        });
      } catch (err) {
        _debugLog("[AsyncStartCall] drive loop call failure", { err });
      }
    });
    const subtaskState = subtask.getStateNumber();
    if (subtaskState < 0 || subtaskState > 2 ** 5) {
      throw new Error("invalid subtask state, out of valid range");
    }
    _debugLog("[_asyncStartCall()] returning subtask rep & state", {
      subtask: {
        rep: subtask.waitableRep(),
        state: subtaskState
      }
    });
    return Number(subtask.waitableRep()) << 4 | subtaskState;
  }
  function _syncStartCall(callbackIdx) {
    _debugLog("[_syncStartCall()] args", { callbackIdx });
    throw new Error("synchronous start call not implemented!");
  }
  class Waitable {
    #componentIdx;
    #pendingEventFn = null;
    #promise;
    #resolve;
    #reject;
    #waitableSet = null;
    #idx = null;
    // to component-global waitables
    target;
    constructor(args) {
      const { componentIdx: componentIdx2, target } = args;
      this.#componentIdx = componentIdx2;
      this.target = args.target;
      this.#resetPromise();
    }
    componentIdx() {
      return this.#componentIdx;
    }
    isInSet() {
      return this.#waitableSet !== null;
    }
    idx() {
      return this.#idx;
    }
    setIdx(idx) {
      if (idx === 0) {
        throw new Error("waitable idx cannot be zero");
      }
      this.#idx = idx;
    }
    setTarget(tgt) {
      this.target = tgt;
    }
    #resetPromise() {
      const { promise: promise2, resolve: resolve2, reject: reject2 } = promiseWithResolvers();
      this.#promise = promise2;
      this.#resolve = resolve2;
      this.#reject = reject2;
    }
    resolve() {
      this.#resolve();
    }
    reject(err) {
      this.#reject(err);
    }
    promise() {
      return this.#promise;
    }
    hasPendingEvent() {
      return this.#pendingEventFn !== null;
    }
    setPendingEvent(fn) {
      _debugLog("[Waitable#setPendingEvent()] args", {
        waitable: this,
        inSet: this.#waitableSet
      });
      this.#pendingEventFn = fn;
    }
    getPendingEvent() {
      _debugLog("[Waitable#getPendingEvent()] args", {
        waitable: this,
        inSet: this.#waitableSet,
        hasPendingEvent: this.#pendingEventFn !== null
      });
      if (this.#pendingEventFn === null) {
        return null;
      }
      const eventFn = this.#pendingEventFn;
      this.#pendingEventFn = null;
      const e = eventFn();
      this.#resetPromise();
      return e;
    }
    join(waitableSet) {
      _debugLog("[Waitable#join()] args", {
        waitable: this,
        waitableSet
      });
      if (this.#waitableSet) {
        this.#waitableSet.removeWaitable(this);
      }
      if (!waitableSet) {
        this.#waitableSet = null;
        return;
      }
      waitableSet.addWaitable(this);
      this.#waitableSet = waitableSet;
    }
    drop() {
      _debugLog("[Waitable#drop()] args", {
        componentIdx: this.#componentIdx,
        waitable: this
      });
      if (this.hasPendingEvent()) {
        throw new Error("waitables with pending events cannot be dropped");
      }
      this.join(null);
    }
  }
  const ERR_CTX_TABLES = {};
  let dv = new DataView(new ArrayBuffer());
  const dataView = (mem) => dv.buffer === mem.buffer ? dv : dv = new DataView(mem.buffer);
  function toUint64(val) {
    const converted = BigInt(val);
    return BigInt.asUintN(64, converted);
  }
  function toUint32(val) {
    return val >>> 0;
  }
  const utf16Decoder = new TextDecoder("utf-16");
  const TEXT_DECODER_UTF8 = new TextDecoder();
  const TEXT_ENCODER_UTF8 = new TextEncoder();
  function _utf8AllocateAndEncode(s, realloc, memory) {
    if (typeof s !== "string") {
      throw new TypeError("expected a string, received [" + typeof s + "]");
    }
    if (s.length === 0) {
      return { ptr: 1, len: 0 };
    }
    let buf = TEXT_ENCODER_UTF8.encode(s);
    let ptr = realloc(0, 0, 1, buf.length);
    new Uint8Array(memory.buffer).set(buf, ptr);
    const res = { ptr, len: buf.length, codepoints: [...s].length };
    return res;
  }
  const T_FLAG = 1 << 30;
  function rscTableCreateOwn(table, rep2) {
    const free = table[0] & ~T_FLAG;
    if (free === 0) {
      table.push(0);
      table.push(rep2 | T_FLAG);
      return (table.length >> 1) - 1;
    }
    table[0] = table[free << 1];
    table[free << 1] = 0;
    table[(free << 1) + 1] = rep2 | T_FLAG;
    return free;
  }
  function rscTableRemove(table, handle) {
    const scope = table[handle << 1];
    const val = table[(handle << 1) + 1];
    const own = (val & T_FLAG) !== 0;
    const rep2 = val & ~T_FLAG;
    if (val === 0 || (scope & T_FLAG) !== 0) {
      throw new TypeError("Invalid handle");
    }
    table[handle << 1] = table[0] | T_FLAG;
    table[0] = handle | T_FLAG;
    return { rep: rep2, scope, own };
  }
  let curResourceBorrows = [];
  function getCurrentTask(componentIdx2, taskID) {
    let usedGlobal = false;
    if (componentIdx2 === void 0 || componentIdx2 === null) {
      throw new Error("missing component idx");
    }
    const taskMetas = ASYNC_TASKS_BY_COMPONENT_IDX.get(componentIdx2);
    if (taskMetas === void 0 || taskMetas.length === 0) {
      return void 0;
    }
    if (taskID) {
      return taskMetas.find((meta) => meta.task.id() === taskID);
    }
    const taskMeta = taskMetas[taskMetas.length - 1];
    if (!taskMeta || !taskMeta.task) {
      return void 0;
    }
    return taskMeta;
  }
  function createNewCurrentTask(args) {
    _debugLog("[createNewCurrentTask()] args", args);
    const {
      componentIdx: componentIdx2,
      isAsync,
      isManualAsync,
      entryFnName,
      parentSubtaskID,
      callbackFnName,
      getCallbackFn,
      getParamsFn,
      stringEncoding,
      errHandling,
      getCalleeParamsFn,
      resultPtr,
      callingWasmExport
    } = args;
    if (componentIdx2 === void 0 || componentIdx2 === null) {
      throw new Error("missing/invalid component instance index while starting task");
    }
    let taskMetas = ASYNC_TASKS_BY_COMPONENT_IDX.get(componentIdx2);
    const callbackFn = getCallbackFn ? getCallbackFn() : null;
    const newTask = new AsyncTask({
      componentIdx: componentIdx2,
      isAsync,
      isManualAsync,
      entryFnName,
      callbackFn,
      callbackFnName,
      stringEncoding,
      getCalleeParamsFn,
      resultPtr,
      errHandling
    });
    const newTaskID = newTask.id();
    const newTaskMeta = { id: newTaskID, componentIdx: componentIdx2, task: newTask };
    ASYNC_CURRENT_TASK_IDS.push(newTaskID);
    ASYNC_CURRENT_COMPONENT_IDXS.push(componentIdx2);
    if (!taskMetas) {
      taskMetas = [newTaskMeta];
      ASYNC_TASKS_BY_COMPONENT_IDX.set(componentIdx2, [newTaskMeta]);
    } else {
      taskMetas.push(newTaskMeta);
    }
    return [newTask, newTaskID];
  }
  const ASYNC_TASKS_BY_COMPONENT_IDX = /* @__PURE__ */ new Map();
  class AsyncTask {
    static _ID = 0n;
    static State = {
      INITIAL: "initial",
      CANCELLED: "cancelled",
      CANCEL_PENDING: "cancel-pending",
      CANCEL_DELIVERED: "cancel-delivered",
      RESOLVED: "resolved"
    };
    static BlockResult = {
      CANCELLED: "block.cancelled",
      NOT_CANCELLED: "block.not-cancelled"
    };
    #id;
    #componentIdx;
    #state;
    #isAsync;
    #isManualAsync;
    #entryFnName = null;
    #onResolveHandlers = [];
    #completionPromise = null;
    #rejected = false;
    #exitPromise = null;
    #onExitHandlers = [];
    #memoryIdx = null;
    #memory = null;
    #callbackFn = null;
    #callbackFnName = null;
    #postReturnFn = null;
    #getCalleeParamsFn = null;
    #stringEncoding = null;
    #parentSubtask = null;
    #needsExclusiveLock = false;
    #errHandling;
    #backpressurePromise;
    #backpressureWaiters = 0n;
    #returnLowerFns = null;
    #subtasks = [];
    #entered = false;
    #exited = false;
    #errored = null;
    cancelled = false;
    cancelRequested = false;
    alwaysTaskReturn = false;
    returnCalls = 0;
    storage = [0, 0];
    borrowedHandles = {};
    tmpRetI64HighBits = 0 | 0;
    constructor(opts) {
      this.#id = ++AsyncTask._ID;
      if (opts?.componentIdx === void 0) {
        throw new TypeError("missing component id during task creation");
      }
      this.#componentIdx = opts.componentIdx;
      this.#state = AsyncTask.State.INITIAL;
      this.#isAsync = opts?.isAsync ?? false;
      this.#isManualAsync = opts?.isManualAsync ?? false;
      this.#entryFnName = opts.entryFnName;
      const {
        promise: completionPromise,
        resolve: resolveCompletionPromise,
        reject: rejectCompletionPromise
      } = promiseWithResolvers();
      this.#completionPromise = completionPromise;
      this.#onResolveHandlers.push((results) => {
        if (this.#errored !== null) {
          rejectCompletionPromise(this.#errored);
          return;
        } else if (this.#rejected) {
          rejectCompletionPromise(results);
          return;
        }
        resolveCompletionPromise(results);
      });
      const {
        promise: exitPromise,
        resolve: resolveExitPromise,
        reject: rejectExitPromise
      } = promiseWithResolvers();
      this.#exitPromise = exitPromise;
      this.#onExitHandlers.push(() => {
        resolveExitPromise();
      });
      if (opts.callbackFn) {
        this.#callbackFn = opts.callbackFn;
      }
      if (opts.callbackFnName) {
        this.#callbackFnName = opts.callbackFnName;
      }
      if (opts.getCalleeParamsFn) {
        this.#getCalleeParamsFn = opts.getCalleeParamsFn;
      }
      if (opts.stringEncoding) {
        this.#stringEncoding = opts.stringEncoding;
      }
      if (opts.parentSubtask) {
        this.#parentSubtask = opts.parentSubtask;
      }
      this.#needsExclusiveLock = this.isSync() || !this.hasCallback();
      if (opts.errHandling) {
        this.#errHandling = opts.errHandling;
      }
    }
    taskState() {
      return this.#state;
    }
    id() {
      return this.#id;
    }
    componentIdx() {
      return this.#componentIdx;
    }
    entryFnName() {
      return this.#entryFnName;
    }
    completionPromise() {
      return this.#completionPromise;
    }
    exitPromise() {
      return this.#exitPromise;
    }
    isAsync() {
      return this.#isAsync;
    }
    isSync() {
      return !this.isAsync();
    }
    getErrHandling() {
      return this.#errHandling;
    }
    hasCallback() {
      return this.#callbackFn !== null;
    }
    getReturnMemoryIdx() {
      return this.#memoryIdx;
    }
    setReturnMemoryIdx(idx) {
      if (idx === null) {
        return;
      }
      this.#memoryIdx = idx;
    }
    getReturnMemory() {
      return this.#memory;
    }
    setReturnMemory(m) {
      if (m === null) {
        return;
      }
      this.#memory = m;
    }
    setReturnLowerFns(fns) {
      this.#returnLowerFns = fns;
    }
    getReturnLowerFns() {
      return this.#returnLowerFns;
    }
    setParentSubtask(subtask) {
      if (!subtask || !(subtask instanceof AsyncSubtask)) {
        return;
      }
      if (this.#parentSubtask) {
        throw new Error("parent subtask can only be set once");
      }
      this.#parentSubtask = subtask;
    }
    getParentSubtask() {
      return this.#parentSubtask;
    }
    // TODO(threads): this is very inefficient, we can pass along a root task,
    // and ideally do not need this once thread support is in place
    getRootTask() {
      let currentSubtask = this.getParentSubtask();
      let task = this;
      while (currentSubtask) {
        task = currentSubtask.getParentTask();
        currentSubtask = task.getParentSubtask();
      }
      return task;
    }
    setPostReturnFn(f) {
      if (!f) {
        return;
      }
      if (this.#postReturnFn) {
        throw new Error("postReturn fn can only be set once");
      }
      this.#postReturnFn = f;
    }
    setCallbackFn(f, name) {
      if (!f) {
        return;
      }
      if (this.#callbackFn) {
        throw new Error("callback fn can only be set once");
      }
      this.#callbackFn = f;
      this.#callbackFnName = name;
    }
    getCallbackFnName() {
      if (!this.#callbackFnName) {
        return void 0;
      }
      return this.#callbackFnName;
    }
    async runCallbackFn(...args) {
      if (!this.#callbackFn) {
        throw new Error("on callback function has been set for task");
      }
      return await this.#callbackFn.apply(null, args);
    }
    getCalleeParams() {
      if (!this.#getCalleeParamsFn) {
        throw new Error("missing/invalid getCalleeParamsFn");
      }
      return this.#getCalleeParamsFn();
    }
    mayBlock() {
      return this.isAsync() || this.isResolvedState();
    }
    mayEnter(task) {
      const cstate = getOrCreateAsyncState(this.#componentIdx);
      if (cstate.hasBackpressure()) {
        _debugLog("[AsyncTask#mayEnter()] disallowed due to backpressure", { taskID: this.#id });
        return false;
      }
      if (!cstate.callingSyncImport()) {
        _debugLog("[AsyncTask#mayEnter()] disallowed due to sync import call", { taskID: this.#id });
        return false;
      }
      const callingSyncExportWithSyncPending = cstate.callingSyncExport && !task.isAsync;
      if (!callingSyncExportWithSyncPending) {
        _debugLog("[AsyncTask#mayEnter()] disallowed due to sync export w/ sync pending", { taskID: this.#id });
        return false;
      }
      return true;
    }
    enterSync() {
      if (this.needsExclusiveLock()) {
        const cstate = getOrCreateAsyncState(this.#componentIdx);
        cstate.exclusiveLock();
      }
      return true;
    }
    async enter(opts) {
      _debugLog("[AsyncTask#enter()] args", {
        taskID: this.#id,
        componentIdx: this.#componentIdx,
        subtaskID: this.getParentSubtask()?.id()
      });
      if (this.#entered) {
        throw new Error(`task with ID [${this.#id}] should not be entered twice`);
      }
      const cstate = getOrCreateAsyncState(this.#componentIdx);
      if (this.isSync() || opts?.isHost) {
        this.#entered = true;
        if (this.#isManualAsync) {
          if (this.needsExclusiveLock()) {
            cstate.exclusiveLock();
          }
        }
        return this.#entered;
      }
      if (cstate.hasBackpressure()) {
        cstate.addBackpressureWaiter();
        const result = await this.waitUntil({
          readyFn: () => !cstate.hasBackpressure(),
          cancellable: true
        });
        cstate.removeBackpressureWaiter();
        if (result === AsyncTask.BlockResult.CANCELLED) {
          this.cancel();
          return false;
        }
      }
      if (this.needsExclusiveLock()) {
        cstate.exclusiveLock();
      }
      this.#entered = true;
      return this.#entered;
    }
    isRunningState() {
      return this.#state !== AsyncTask.State.RESOLVED;
    }
    isResolvedState() {
      return this.#state === AsyncTask.State.RESOLVED;
    }
    isResolved() {
      return this.#state === AsyncTask.State.RESOLVED;
    }
    async waitUntil(opts) {
      const { readyFn, waitableSetRep, cancellable } = opts;
      _debugLog("[AsyncTask#waitUntil()] args", { taskID: this.#id, waitableSetRep, cancellable });
      const state = getOrCreateAsyncState(this.#componentIdx);
      const wset = state.handles.get(waitableSetRep);
      let event;
      wset.incrementNumWaiting();
      const keepGoing = await this.suspendUntil({
        readyFn: () => {
          const hasPendingEvent = wset.hasPendingEvent();
          const ready = readyFn();
          return ready && hasPendingEvent;
        },
        cancellable
      });
      if (keepGoing) {
        event = wset.getPendingEvent();
      } else {
        event = {
          code: ASYNC_EVENT_CODE.TASK_CANCELLED,
          payload0: 0,
          payload1: 0
        };
      }
      wset.decrementNumWaiting();
      return event;
    }
    async yieldUntil(opts) {
      const { readyFn, cancellable } = opts;
      _debugLog("[AsyncTask#yieldUntil()] args", { taskID: this.#id, cancellable });
      const keepGoing = await this.suspendUntil({ readyFn, cancellable });
      if (keepGoing) {
        return {
          code: ASYNC_EVENT_CODE.NONE,
          payload0: 0,
          payload1: 0
        };
      }
      return {
        code: ASYNC_EVENT_CODE.TASK_CANCELLED,
        payload0: 0,
        payload1: 0
      };
    }
    async suspendUntil(opts) {
      const { cancellable, readyFn } = opts;
      _debugLog("[AsyncTask#suspendUntil()] args", { cancellable });
      const pendingCancelled = this.deliverPendingCancel({ cancellable });
      if (pendingCancelled) {
        return false;
      }
      const completed = await this.immediateSuspendUntil({ readyFn, cancellable });
      return completed;
    }
    // TODO(threads): equivalent to thread.suspend_until()
    async immediateSuspendUntil(opts) {
      const { cancellable, readyFn } = opts;
      _debugLog("[AsyncTask#immediateSuspendUntil()] args", { cancellable, readyFn });
      const ready = readyFn();
      if (ready && ASYNC_DETERMINISM === "random") {
        return true;
      }
      const keepGoing = await this.immediateSuspend({ cancellable, readyFn });
      return keepGoing;
    }
    async immediateSuspend(opts) {
      const { cancellable, readyFn } = opts;
      _debugLog("[AsyncTask#immediateSuspend()] args", { cancellable, readyFn });
      const pendingCancelled = this.deliverPendingCancel({ cancellable });
      if (pendingCancelled) {
        return false;
      }
      const cstate = getOrCreateAsyncState(this.#componentIdx);
      const keepGoing = await cstate.suspendTask({ task: this, readyFn });
      return keepGoing;
    }
    deliverPendingCancel(opts) {
      const { cancellable } = opts;
      _debugLog("[AsyncTask#deliverPendingCancel()] args", { cancellable });
      if (cancellable && this.#state === AsyncTask.State.PENDING_CANCEL) {
        this.#state = AsyncTask.State.CANCEL_DELIVERED;
        return true;
      }
      return false;
    }
    isCancelled() {
      return this.cancelled;
    }
    cancel(args) {
      _debugLog("[AsyncTask#cancel()] args", {});
      if (this.taskState() !== AsyncTask.State.CANCEL_DELIVERED) {
        throw new Error(`(component [${this.#componentIdx}]) task [${this.#id}] invalid task state [${this.taskState()}] for cancellation`);
      }
      if (this.borrowedHandles.length > 0) {
        throw new Error("task still has borrow handles");
      }
      this.cancelled = true;
      this.onResolve(args?.error ?? new Error("task cancelled"));
      this.#state = AsyncTask.State.RESOLVED;
    }
    onResolve(taskValue) {
      const handlers = this.#onResolveHandlers;
      this.#onResolveHandlers = [];
      for (const f of handlers) {
        try {
          f(taskValue);
        } catch (err) {
          _debugLog("[AsyncTask#onResolve] error during task resolve handler", err);
          throw err;
        }
      }
      if (this.#parentSubtask) {
        const meta = this.#parentSubtask.getCallMetadata();
        if (meta.returnFn && !meta.returnFnCalled) {
          _debugLog("[AsyncTask#onResolve()] running returnFn", {
            componentIdx: this.#componentIdx,
            taskID: this.#id,
            subtaskID: this.#parentSubtask.id()
          });
          const memory = meta.getMemoryFn();
          meta.returnFn.apply(null, [taskValue, meta.resultPtr]);
          meta.returnFnCalled = true;
        }
      }
      if (this.#postReturnFn) {
        _debugLog("[AsyncTask#onResolve()] running post return ", {
          componentIdx: this.#componentIdx,
          taskID: this.#id
        });
        try {
          this.#postReturnFn(taskValue);
        } catch (err) {
          _debugLog("[AsyncTask#onResolve] error during task resolve handler", err);
          throw err;
        }
      }
      if (this.#parentSubtask) {
        this.#parentSubtask.onResolve(taskValue);
      }
    }
    registerOnResolveHandler(f) {
      this.#onResolveHandlers.push(f);
    }
    isRejected() {
      return this.#rejected;
    }
    setErrored(err) {
      this.#errored = err;
    }
    reject(taskErr) {
      _debugLog("[AsyncTask#reject()] args", {
        componentIdx: this.#componentIdx,
        taskID: this.#id,
        parentSubtask: this.#parentSubtask,
        parentSubtaskID: this.#parentSubtask?.id(),
        entryFnName: this.entryFnName(),
        callbackFnName: this.#callbackFnName,
        errMsg: taskErr.message
      });
      if (this.isResolvedState() || this.#rejected) {
        return;
      }
      for (const subtask of this.#subtasks) {
        subtask.reject(taskErr);
      }
      this.#rejected = true;
      this.cancelRequested = true;
      this.#state = AsyncTask.State.PENDING_CANCEL;
      const cancelled = this.deliverPendingCancel({ cancellable: true });
      this.cancel({ error: taskErr });
    }
    resolve(results) {
      _debugLog("[AsyncTask#resolve()] args", {
        componentIdx: this.#componentIdx,
        taskID: this.#id,
        entryFnName: this.entryFnName(),
        callbackFnName: this.#callbackFnName
      });
      if (this.#state === AsyncTask.State.RESOLVED) {
        throw new Error(`(component [${this.#componentIdx}]) task [${this.#id}]  is already resolved (did you forget to wait for an import?)`);
      }
      if (this.borrowedHandles.length > 0) {
        throw new Error("task still has borrow handles");
      }
      this.#state = AsyncTask.State.RESOLVED;
      switch (results.length) {
        case 0:
          this.onResolve(void 0);
          break;
        case 1:
          this.onResolve(results[0]);
          break;
        default:
          _debugLog("[AsyncTask#resolve()] unexpected number of results", {
            componentIdx: this.#componentIdx,
            results,
            taskID: this.#id,
            subtaskID: this.#parentSubtask?.id(),
            entryFnName: this.#entryFnName,
            callbackFnName: this.#callbackFnName
          });
          throw new Error("unexpected number of results");
      }
    }
    exit() {
      _debugLog("[AsyncTask#exit()]", {
        componentIdx: this.#componentIdx,
        taskID: this.#id
      });
      if (this.#exited) {
        throw new Error("task has already exited");
      }
      if (this.#state !== AsyncTask.State.RESOLVED) {
        _debugLog("[AsyncTask#exit()] task exited without resolution", {
          componentIdx: this.#componentIdx,
          taskID: this.#id,
          subtask: this.getParentSubtask(),
          subtaskID: this.getParentSubtask()?.id()
        });
        this.#state = AsyncTask.State.RESOLVED;
      }
      if (this.borrowedHandles > 0) {
        throw new Error("task [${this.#id}] exited without clearing borrowed handles");
      }
      const state = getOrCreateAsyncState(this.#componentIdx);
      if (!state) {
        throw new Error("missing async state for component [" + this.#componentIdx + "]");
      }
      if (this.#componentIdx !== -1 && this.needsExclusiveLock() && !state.isExclusivelyLocked()) {
        throw new Error(`task [${this.#id}] exit: component [${this.#componentIdx}] should have been exclusively locked`);
      }
      state.exclusiveRelease();
      for (const f of this.#onExitHandlers) {
        try {
          f();
        } catch (err) {
          console.error("error during task exit handler", err);
          throw err;
        }
      }
      this.#exited = true;
      clearCurrentTask(this.#componentIdx, this.id());
    }
    needsExclusiveLock() {
      return !this.#isAsync || this.hasCallback();
    }
    createSubtask(args) {
      _debugLog("[AsyncTask#createSubtask()] args", args);
      const { componentIdx: componentIdx2, childTask, callMetadata, fnName, isAsync, isManualAsync } = args;
      const cstate = getOrCreateAsyncState(this.#componentIdx);
      if (!cstate) {
        throw new Error(`invalid/missing async state for component idx [${componentIdx2}]`);
      }
      const waitable = new Waitable({
        componentIdx: this.#componentIdx,
        target: `subtask (internal ID [${this.#id}])`
      });
      const newSubtask = new AsyncSubtask({
        componentIdx: componentIdx2,
        childTask,
        parentTask: this,
        callMetadata,
        isAsync,
        isManualAsync,
        fnName,
        waitable
      });
      this.#subtasks.push(newSubtask);
      newSubtask.setTarget(`subtask (internal ID [${newSubtask.id()}], waitable [${waitable.idx()}], component [${componentIdx2}])`);
      waitable.setIdx(cstate.handles.insert(newSubtask));
      waitable.setTarget(`waitable for subtask (waitable id [${waitable.idx()}], subtask internal ID [${newSubtask.id()}])`);
      return newSubtask;
    }
    getLatestSubtask() {
      return this.#subtasks.at(-1);
    }
    getSubtaskByWaitableRep(rep2) {
      if (rep2 === void 0) {
        throw new TypeError("missing rep");
      }
      return this.#subtasks.find((s) => s.waitableRep() === rep2);
    }
    currentSubtask() {
      _debugLog("[AsyncTask#currentSubtask()]");
      if (this.#subtasks.length === 0) {
        return void 0;
      }
      return this.#subtasks.at(-1);
    }
    removeSubtask(subtask) {
      if (this.#subtasks.length === 0) {
        throw new Error("cannot end current subtask: no current subtask");
      }
      this.#subtasks = this.#subtasks.filter((t) => t !== subtask);
      return subtask;
    }
  }
  function _lowerImportBackwardsCompat(args) {
    const params2 = [...arguments].slice(1);
    _debugLog("[_lowerImportBackwardsCompat()] args", { args, params: params2 });
    const {
      functionIdx,
      componentIdx: componentIdx2,
      isAsync,
      isManualAsync,
      paramLiftFns,
      resultLowerFns,
      funcTypeIsAsync,
      metadata,
      memoryIdx,
      getMemoryFn,
      getReallocFn,
      importFn,
      stringEncoding
    } = args;
    let meta = _getGlobalCurrentTaskMeta(componentIdx2);
    let createdTask;
    if (!meta) {
      if (funcTypeIsAsync || isAsync && !isManualAsync) {
        throw new Error("p3 async wasm exports cannot use backwards compat auto-task init");
      }
      const [newTask, newTaskID] = createNewCurrentTask({
        componentIdx: componentIdx2,
        isAsync,
        isManualAsync,
        callingWasmExport: false
      });
      createdTask = newTask;
      createdTask.registerOnResolveHandler(() => {
        _clearCurrentTask({
          taskID: task.id(),
          componentIdx: task.componentIdx()
        });
      });
      _setGlobalCurrentTaskMeta({
        componentIdx: componentIdx2,
        taskID: newTaskID
      });
      meta = _getGlobalCurrentTaskMeta(componentIdx2);
    }
    const { taskID } = meta;
    const taskMeta = getCurrentTask(componentIdx2, taskID);
    if (!taskMeta) {
      throw new Error("invalid/missing async task meta");
    }
    const task = taskMeta.task;
    if (!task) {
      throw new Error("invalid/missing async task");
    }
    const cstate = getOrCreateAsyncState(componentIdx2);
    if (!task.mayBlock() && funcTypeIsAsync && !isAsync) {
      throw new Error("non async exports cannot synchronously call async functions");
    }
    const memory = getMemoryFn();
    const subtask = task.createSubtask({
      componentIdx: componentIdx2,
      parentTask: task,
      fnName: importFn.fnName,
      isAsync,
      isManualAsync,
      callMetadata: {
        memoryIdx,
        memory,
        realloc: getReallocFn(),
        resultPtr: params2[0],
        lowers: resultLowerFns,
        stringEncoding
      }
    });
    task.setReturnMemoryIdx(memoryIdx);
    task.setReturnMemory(getMemoryFn());
    subtask.onStart();
    if (!isManualAsync && !isAsync && !funcTypeIsAsync) {
      if (createdTask) {
        createdTask.enterSync();
      }
      const res = importFn(...params2);
      if (!funcTypeIsAsync && !subtask.isReturned()) {
        throw new Error("post-execution subtasks must either be async or returned");
      }
      const syncRes = subtask.getResult();
      if (createdTask) {
        createdTask.resolve([syncRes]);
      }
      return syncRes;
    }
    if (!isManualAsync && !isAsync && funcTypeIsAsync) {
      const { promise: promise2, resolve: resolve2 } = new Promise();
      queueMicrotask(async () => {
        if (!subtask.isResolvedState()) {
          await task.suspendUntil({ readyFn: () => task.isResolvedState() });
        }
        resolve2(subtask.getResult());
      });
      return promise2;
    }
    const subtaskState = subtask.getStateNumber();
    if (subtaskState < 0 || subtaskState > 2 ** 5) {
      throw new Error("invalid subtask state, out of valid range");
    }
    subtask.setOnProgressFn(() => {
      subtask.setPendingEvent(() => {
        if (subtask.isResolved()) {
          subtask.deliverResolve();
        }
        const event = {
          code: ASYNC_EVENT_CODE.SUBTASK,
          payload0: subtask.waitableRep(),
          payload1: subtask.getStateNumber()
        };
        return event;
      });
    });
    const requiresManualAsyncResult = !isAsync && !funcTypeIsAsync && isManualAsync;
    let manualAsyncResult;
    if (requiresManualAsyncResult) {
      manualAsyncResult = promiseWithResolvers();
    }
    queueMicrotask(async () => {
      try {
        _debugLog("[_lowerImportBackwardsCompat()] calling lowered import", { importFn, params: params2 });
        if (createdTask) {
          await createdTask.enter();
        }
        const asyncRes = await importFn(...params2);
        if (requiresManualAsyncResult) {
          manualAsyncResult.resolve(subtask.getResult());
        }
        if (createdTask) {
          createdTask.resolve([asyncRes]);
        }
      } catch (err) {
        _debugLog("[_lowerImportBackwardsCompat()] import fn error:", err);
        if (requiresManualAsyncResult) {
          manualAsyncResult.reject(err);
        }
        throw err;
      }
    });
    if (requiresManualAsyncResult) {
      return manualAsyncResult.promise;
    }
    return Number(subtask.waitableRep()) << 4 | subtaskState;
  }
  function _liftFlatU8(ctx) {
    _debugLog("[_liftFlatU8()] args", { ctx });
    let val;
    if (ctx.useDirectParams) {
      if (ctx.params.length === 0) {
        throw new Error("expected at least a single i32 argument");
      }
      val = ctx.params[0];
      ctx.params = ctx.params.slice(1);
      return [val, ctx];
    }
    if (ctx.storageLen !== void 0 && ctx.storageLen < 1) {
      throw new Error(`insufficient storage ([${ctx.storageLen}] bytes) for lift (u8 requires 1 byte)`);
    }
    val = new DataView(ctx.memory.buffer).getUint8(ctx.storagePtr, true);
    ctx.storagePtr += 1;
    if (ctx.storageLen !== void 0) {
      ctx.storageLen -= 1;
    }
    return [val, ctx];
  }
  function _liftFlatU16(ctx) {
    _debugLog("[_liftFlatU16()] args", { ctx });
    let val;
    if (ctx.useDirectParams) {
      if (params.length === 0) {
        throw new Error("expected at least a single i32 argument");
      }
      val = ctx.params[0];
      ctx.params = ctx.params.slice(1);
      return [val, ctx];
    }
    if (ctx.storageLen !== void 0 && ctx.storageLen < 2) {
      throw new Error(`insufficient storage ([${ctx.storageLen}] bytes) for lift (u16 requires 2 bytes)`);
    }
    val = new DataView(ctx.memory.buffer).getUint16(ctx.storagePtr, true);
    ctx.storagePtr += 2;
    if (ctx.storageLen !== void 0) {
      ctx.storageLen -= 2;
    }
    const rem = ctx.storagePtr % 2;
    if (rem !== 0) {
      ctx.storagePtr += 2 - rem;
    }
    return [val, ctx];
  }
  function _liftFlatU32(ctx) {
    _debugLog("[_liftFlatU32()] args", { ctx });
    let val;
    if (ctx.useDirectParams) {
      if (ctx.params.length === 0) {
        throw new Error("expected at least a single i34 argument");
      }
      val = ctx.params[0];
      ctx.params = ctx.params.slice(1);
      return [val, ctx];
    }
    if (ctx.storageLen !== void 0 && ctx.storageLen < 4) {
      throw new Error(`insufficient storage ([${ctx.storageLen}] bytes) for lift (u32 requires 4 bytes)`);
    }
    val = new DataView(ctx.memory.buffer).getUint32(ctx.storagePtr, true);
    ctx.storagePtr += 4;
    if (ctx.storageLen !== void 0) {
      ctx.storageLen -= 4;
    }
    return [val, ctx];
  }
  function _liftFlatU64(ctx) {
    _debugLog("[_liftFlatU64()] args", { ctx });
    let val;
    if (ctx.useDirectParams) {
      if (ctx.params.length === 0) {
        throw new Error("expected at least one single i64 argument");
      }
      if (typeof ctx.params[0] !== "bigint") {
        throw new Error("expected bigint");
      }
      val = ctx.params[0];
      ctx.params = ctx.params.slice(1);
      return [val, ctx];
    }
    if (ctx.storageLen !== void 0 && ctx.storageLen < 8) {
      throw new Error(`insufficient storage ([${ctx.storageLen}] bytes) for lift (u64 requires 8 bytes)`);
    }
    val = new DataView(ctx.memory.buffer).getBigUint64(ctx.storagePtr, true);
    ctx.storagePtr += 8;
    if (ctx.storageLen !== void 0) {
      ctx.storageLen -= 8;
    }
    return [val, ctx];
  }
  function _liftFlatStringAny(ctx) {
    switch (ctx.stringEncoding) {
      case "utf8":
        return _liftFlatStringUTF8(ctx);
      case "utf16":
        return _liftFlatStringUTF16(ctx);
      default:
        throw new Error(`missing/unrecognized/unsupported string encoding [${ctx.stringEncoding}]`);
    }
  }
  function _liftFlatStringUTF8(ctx) {
    _debugLog("[_liftFlatStringUTF8()] args", { ctx });
    let val;
    if (ctx.useDirectParams) {
      if (ctx.params.length < 2) {
        throw new Error("expected at least two u32 arguments");
      }
      const offset = ctx.params[0];
      if (!Number.isSafeInteger(offset)) {
        throw new Error("invalid offset");
      }
      const len = ctx.params[1];
      if (!Number.isSafeInteger(len)) {
        throw new Error("invalid len");
      }
      val = TEXT_DECODER_UTF8.decode(new DataView(ctx.memory.buffer, offset, len));
      ctx.params = ctx.params.slice(2);
      return [val, ctx];
    }
    const rem = ctx.storagePtr % 4;
    if (rem !== 0) {
      ctx.storagePtr += 4 - rem;
    }
    const dv2 = new DataView(ctx.memory.buffer);
    const start2 = dv2.getUint32(ctx.storagePtr, true);
    const codeUnits2 = dv2.getUint32(ctx.storagePtr + 4, true);
    val = TEXT_DECODER_UTF8.decode(new Uint8Array(ctx.memory.buffer, start2, codeUnits2));
    ctx.storagePtr += 8;
    if (ctx.storageLen !== void 0) {
      ctx.storagelen -= 8;
    }
    return [val, ctx];
  }
  function _liftFlatStringUTF16(ctx) {
    _debugLog("[_liftFlatStringUTF16()] args", { ctx });
    let val;
    if (ctx.useDirectParams) {
      if (ctx.params.length < 2) {
        throw new Error("expected at least two u32 arguments");
      }
      const offset = ctx.params[0];
      if (!Number.isSafeInteger(offset)) {
        throw new Error("invalid offset");
      }
      const len = ctx.params[1];
      if (!Number.isSafeInteger(len)) {
        throw new Error("invalid len");
      }
      val = utf16Decoder.decode(new DataView(ctx.memory.buffer, offset, len));
      ctx.params = ctx.params.slice(2);
      return [val, ctx];
    }
    const data = new DataView(ctx.memory.buffer);
    const start2 = data.getUint32(ctx.storagePtr, vals[0], true);
    const codeUnits2 = data.getUint32(ctx.storagePtr, vals[0] + 4, true);
    val = utf16Decoder.decode(new Uint16Array(ctx.memory.buffer, start2, codeUnits2));
    ctx.storagePtr = ctx.storagePtr + 2 * codeUnits2;
    if (ctx.storageLen !== void 0) {
      ctx.storageLen = ctx.storageLen - 2 * codeUnits2;
    }
    return [val, ctx];
  }
  function _liftFlatVariant(casesAndLiftFns) {
    return function _liftFlatVariantInner(ctx) {
      _debugLog("[_liftFlatVariant()] args", { ctx });
      const origUseParams = ctx.useDirectParams;
      let caseIdx;
      let liftRes;
      const originalPtr = ctx.storagePtr;
      const numCases = casesAndLiftFns.length;
      if (casesAndLiftFns.length < 256) {
        liftRes = _liftFlatU8(ctx);
      } else if (numCases >= 256 && numCases < 65536) {
        liftRes = _liftFlatU16(ctx);
      } else if (numCases >= 65536 && numCases < 4294967296) {
        liftRes = _liftFlatU32(ctx);
      } else {
        throw new Error(`unsupported number of variant cases [${numCases}]`);
      }
      caseIdx = liftRes[0];
      ctx = liftRes[1];
      const [tag, liftFn, size32, align32, payloadOffset32] = casesAndLiftFns[caseIdx];
      if (payloadOffset32 === void 0) {
        throw new Error("unexpectedly missing payload offset");
      }
      if (originalPtr !== void 0) {
        ctx.storagePtr = originalPtr + payloadOffset32;
      }
      let val;
      if (liftFn === null) {
        val = { tag };
        ctx.storagePtr = originalPtr + size32;
      } else {
        const [newVal, newCtx] = liftFn(ctx);
        val = { tag, val: newVal };
        ctx = newCtx;
        if (ctx.storagePtr < originalPtr + size32) {
          ctx.storagePtr = originalPtr + size32;
        }
      }
      const rem = ctx.storagePtr % align32;
      if (rem !== 0) {
        ctx.storagePtr += align32 - rem;
      }
      return [val, ctx];
    };
  }
  function _liftFlatList(meta) {
    const { elemLiftFn, elemSize32, elemAlign32, knownLen } = meta;
    const readValuesAndReset = (ctx, originalPtr, dataPtr, len) => {
      ctx.storagePtr = dataPtr;
      const val = [];
      for (var i = 0; i < len; i++) {
        const [res, nextCtx] = elemLiftFn(ctx);
        val.push(res);
        ctx = nextCtx;
        const rem = ctx.storagePtr % elemAlign32;
        if (rem !== 0) {
          ctx.storagePtr += elemAlign32 - rem;
        }
      }
      if (originalPtr !== null) {
        ctx.storagePtr = originalPtr;
      }
      return [val, ctx];
    };
    return function _liftFlatListInner(ctx) {
      _debugLog("[_liftFlatList()] args", { ctx });
      let liftResults;
      if (knownLen !== void 0) {
        if (ctx.useDirectParams) {
          const dataPtr = ctx.params[0];
          ctx.params = ctx.params.slice(1);
          ctx.useDirectParams = false;
          const originalPtr = ctx.storagePtr;
          ctx.storageLen = knownLen * elemSize32;
          liftResults = readValuesAndReset(ctx, originalPtr, dataPtr, knownLen);
          ctx.useDirectParams = true;
          ctx.storagePtr = null;
          ctx.storageLen = null;
        } else {
          ctx.storageLen = knownLen * elemSize32;
          liftResults = readValuesAndReset(ctx, null, ctx.storagePtr, knownLen);
        }
      } else {
        if (ctx.useDirectParams) {
          const dataPtr = ctx.params[0];
          const len = ctx.params[1];
          ctx.params = ctx.params.slice(2);
          ctx.useDirectParams = false;
          const originalPtr = ctx.storagePtr;
          ctx.storageLen = len * elemSize32;
          liftResults = readValuesAndReset(ctx, originalPtr, dataPtr, len);
          ctx.useDirectParams = true;
          ctx.storagePtr = null;
          ctx.storageLen = null;
        } else {
          ctx.storageLen = 8;
          const dataPtrLiftRes = _liftFlatU32(ctx);
          const dataPtr = dataPtrLiftRes[0];
          ctx = dataPtrLiftRes[1];
          const lenLiftRes = _liftFlatU32(ctx);
          const len = lenLiftRes[0];
          ctx = lenLiftRes[1];
          const originalPtr = ctx.storagePtr;
          ctx.storagePtr = dataPtr;
          ctx.storageLen = len * elemSize32;
          liftResults = readValuesAndReset(ctx, originalPtr, dataPtr, len);
        }
      }
      return liftResults;
    };
  }
  function _liftFlatFlags(meta) {
    const { names, size32, align32, intSizeBytes } = meta;
    return function _liftFlatFlagsInner(ctx) {
      _debugLog("[_liftFlatFlags()] args", { ctx });
      const val = {};
      let liftRes;
      let align;
      switch (intSizeBytes) {
        case 1:
          liftRes = _liftFlatU8(ctx);
          break;
        case 2:
          liftRes = _liftFlatU16(ctx);
          break;
        case 4:
          liftRes = _liftFlatU32(ctx);
          break;
        default:
          throw new Error("invalid flags size");
      }
      let bits = liftRes[0];
      ctx = liftRes[1];
      for (const name of names) {
        val[name] = (bits & 1) === 1;
        bits >>>= 1;
      }
      const rem = ctx.storagePtr % align32;
      if (rem !== 0) {
        ctx.storagePtr += align32 - rem;
      }
      return [val, ctx];
    };
  }
  function _liftFlatResult(casesAndLiftFns) {
    return function _liftFlatResultInner(ctx) {
      _debugLog("[_liftFlatResult()] args", { ctx });
      return _liftFlatVariant(casesAndLiftFns)(ctx);
    };
  }
  function _liftFlatBorrow(componentTableIdx, size, memory, vals2, storagePtr, storageLen) {
    _debugLog("[_liftFlatBorrow()] args", { size, memory, vals: vals2, storagePtr, storageLen });
    throw new Error("flat lift for borrowed resources is not supported!");
  }
  function _lowerFlatU8(ctx) {
    _debugLog("[_lowerFlatU8()] args", ctx);
    if (ctx.vals.length !== 1) {
      throw new Error(`unexpected number [${ctx.vals.length}] of vals (expected 1)`);
    }
    _requireValidNumericPrimitive.bind("u8", ctx.vals[0]);
    if (!ctx.memory) {
      throw new Error("missing memory for lower");
    }
    new DataView(ctx.memory.buffer).setUint32(ctx.storagePtr, ctx.vals[0], true);
    ctx.storagePtr += 1;
  }
  function _lowerFlatU16(ctx) {
    _debugLog("[_lowerFlatU16()] args", { ctx });
    if (!ctx.memory) {
      throw new Error("missing memory for lower");
    }
    if (ctx.vals.length !== 1) {
      throw new Error(`unexpected number [${ctx.vals.length}] of vals (expected 1)`);
    }
    const rem = ctx.storagePtr % 2;
    if (rem !== 0) {
      ctx.storagePtr += 2 - rem;
    }
    _requireValidNumericPrimitive.bind("u16", ctx.vals[0]);
    new DataView(ctx.memory.buffer).setUint16(ctx.storagePtr, ctx.vals[0], true);
    ctx.storagePtr += 2;
  }
  function _lowerFlatU32(ctx) {
    _debugLog("[_lowerFlatU32()] args", { ctx });
    if (ctx.vals.length !== 1) {
      throw new Error(`expected single value to lower, got [${ctx.vals.length}]`);
    }
    const rem = ctx.storagePtr % 4;
    if (rem !== 0) {
      ctx.storagePtr += 4 - rem;
    }
    _requireValidNumericPrimitive.bind("u32", ctx.vals[0]);
    new DataView(ctx.memory.buffer).setUint32(ctx.storagePtr, ctx.vals[0], true);
    ctx.storagePtr += 4;
  }
  function _lowerFlatU64(ctx) {
    _debugLog("[_lowerFlatU64()] args", { ctx });
    if (ctx.vals.length !== 1) {
      throw new Error("unexpected number of vals");
    }
    const rem = ctx.storagePtr % 8;
    if (rem !== 0) {
      ctx.storagePtr += 8 - rem;
    }
    _requireValidNumericPrimitive.bind("u64", ctx.vals[0]);
    new DataView(ctx.memory.buffer).setBigUint64(ctx.storagePtr, ctx.vals[0], true);
    ctx.storagePtr += 8;
  }
  function _lowerFlatStringAny(ctx) {
    switch (ctx.stringEncoding) {
      case "utf8":
        return _lowerFlatStringUTF8(ctx);
      case "utf16":
        return _lowerFlatStringUTF16(ctx);
      default:
        throw new Error(`missing/unrecognized/unsupported string encoding [${ctx.stringEncoding}]`);
    }
  }
  function _lowerFlatStringUTF8(ctx) {
    _debugLog("[_lowerFlatStringUTF8()] args", ctx);
    if (!ctx.realloc) {
      throw new Error("missing realloc during flat string lower");
    }
    const s = ctx.vals[0];
    const { ptr, codepoints } = _utf8AllocateAndEncode(ctx.vals[0], ctx.realloc, ctx.memory);
    const view = new DataView(ctx.memory.buffer);
    view.setUint32(ctx.storagePtr, ptr, true);
    view.setUint32(ctx.storagePtr + 4, codepoints, true);
    ctx.storagePtr += 8;
  }
  function _lowerFlatStringUTF16(ctx) {
    _debugLog("[_lowerFlatStringUTF16()] args", { ctx });
    if (!ctx.realloc) {
      throw new Error("missing realloc during flat string lower");
    }
    const s = ctx.vals[0];
    const { ptr, len, codepoints } = _utf16AllocateAndEncode(ctx.vals[0], ctx.realloc, ctx.memory);
    const view = new DataView(ctx.memory.buffer);
    view.setUint32(ctx.storagePtr, ptr, true);
    view.setUint32(ctx.storagePtr + 4, codepoints, true);
    const bytes = new Uint16Array(ctx.memory.buffer, start, codeUnits);
    if (ctx.memory.buffer.byteLength < start + bytes.byteLength) {
      throw new Error("memory out of bounds");
    }
    if (ctx.storageLen !== void 0 && ctx.storageLen !== bytes.byteLength) {
      throw new Error(`storage length [${ctx.storageLen}] != [${bytes.byteLength}])`);
    }
    new Uint16Array(ctx.memory.buffer, ctx.storagePtr).set(bytes);
    ctx.storagePtr += len;
  }
  function _lowerFlatRecord(fieldMetas) {
    return function _lowerFlatRecordInner(ctx) {
      _debugLog("[_lowerFlatRecord()] args", { ctx });
      const r = ctx.vals[0];
      for (const [tag, lowerFn, size32, align32] of fieldMetas) {
        ctx.vals = [r[tag]];
        lowerFn(ctx);
      }
    };
  }
  function _lowerFlatVariant(lowerMetas) {
    let caseLookup = {};
    for (const [idx, meta] of lowerMetas.entries()) {
      let tag = meta[0];
      caseLookup[tag] = { discriminant: idx, meta };
    }
    return function _lowerFlatVariantInner(ctx) {
      _debugLog("[_lowerFlatVariant()] args", { ctx });
      const { tag, val } = ctx.vals[0];
      const variantCase = caseLookup[tag];
      if (!variantCase) {
        throw new Error(`missing tag [${tag}] (valid tags: ${Object.keys(caseLookup)})`);
      }
      const [_tag, lowerFn, size32, align32, payloadOffset32] = variantCase.meta;
      const originalPtr = ctx.storagePtr;
      ctx.vals = [variantCase.discriminant];
      let discLowerRes;
      if (lowerMetas.length < 256) {
        discLowerRes = _lowerFlatU8(ctx);
      } else if (lowerMetas.length >= 256 && lowerMetas.length < 65536) {
        discLowerRes = _lowerFlatU16(ctx);
      } else if (lowerMetas.length >= 65536 && lowerMetas.length < 4294967296) {
        discLowerRes = _lowerFlatU32(ctx);
      } else {
        throw new Error(`unsupported number of cases [${lowerMetas.length}]`);
      }
      const payloadOffsetPtr = originalPtr + payloadOffset32;
      ctx.storagePtr = payloadOffsetPtr;
      ctx.vals = [val];
      if (lowerFn) {
        lowerFn(ctx);
      }
      let bytesWritten = ctx.storagePtr - payloadOffsetPtr;
      const rem = ctx.storagePtr % align32;
      if (rem !== 0) {
        const pad = align32 - rem;
        ctx.storagePtr += pad;
        bytesWritten += pad;
      }
      ctx.storagePtr += bytesWritten;
    };
  }
  function _lowerFlatList(meta) {
    const {
      elemLowerFn,
      knownLen,
      size32,
      align32,
      elemSize32,
      elemAlign32
    } = meta;
    if (!elemLowerFn) {
      throw new TypeError("missing/invalid element lower fn for list");
    }
    return function _lowerFlatListInner(ctx) {
      _debugLog("[_lowerFlatList()] args", { ctx });
      if (ctx.useDirectParams) {
        if (ctx.params.length < 2) {
          throw new Error("insufficient params left to lower list");
        }
        const storagePtr = ctx.params[0];
        const elemCount = ctx.params[1];
        ctx.params = ctx.params.slice(2);
        const list = ctx.vals[0];
        if (!list) {
          throw new Error("missing direct param value");
        }
        const lowerCtx = {
          storagePtr,
          memory: ctx.memory,
          stringEncoding: ctx.stringEncoding
        };
        for (let idx = 0; idx < list.length; idx++) {
          lowerCtx.vals = list.slice(idx, idx + 1);
          elemLowerFn(lowerCtx);
        }
        const bytesLowered = lowerCtx.storagePtr - ctx.storagePtr;
        ctx.storagePtr = lowerCtx.storagePtr;
        ctx.storagePtr += bytesLowered;
        return;
      }
      const elems = ctx.vals[0];
      if (knownLen === void 0) {
        if (!ctx.realloc) {
          throw new Error("missing realloc during flat string lower");
        }
        const dataPtr = ctx.realloc(0, 0, elemAlign32, elemSize32 * elems.length);
        ctx.vals[0] = dataPtr;
        _lowerFlatU32(ctx);
        ctx.vals[0] = elems.length;
        _lowerFlatU32(ctx);
        const origPtr = ctx.storagePtr;
        ctx.storagePtr = dataPtr;
        ctx.storagePtr = dataPtr;
        for (const elem of elems) {
          ctx.vals = [elem];
          elemLowerFn(ctx);
        }
        ctx.storagePtr = origPtr;
      } else {
        if (elems.length !== knownLen) {
          throw new TypeError(`invalid list input of length [${elems.length}], must be length [${knownLen}]`);
        }
        for (const elem of elems) {
          ctx.vals = [elem];
          elemLowerFn(ctx);
        }
      }
      const totalSizeBytes = elems.length * size32;
      if (ctx.storageLen !== void 0 && totalSizeBytes > ctx.storageLen) {
        throw new Error("not enough storage remaining for list flat lower");
      }
    };
  }
  function _lowerFlatTuple(elemLowerMetas) {
    return function _lowerFlatTupleInner(ctx) {
      _debugLog("[_lowerFlatTuple()] args", { ctx });
      const tuple = ctx.vals[0];
      for (const [idx, [lowerFn, size32, align32]] of elemLowerMetas.entries()) {
        ctx.vals = [tuple[idx]];
        lowerFn(ctx);
      }
    };
  }
  function _lowerFlatFlags(meta) {
    const { names, size32, align32, intSizeBytes } = meta;
    return function _lowerFlatFlagsInner(ctx) {
      _debugLog("[_lowerFlatFlags()] args", { ctx });
      if (ctx.vals.length !== 1) {
        throw new Error("unexpected number of vals");
      }
      let flagObj = ctx.vals[0];
      let flagValue = 0;
      for (const [idx, name] of names.entries()) {
        if (flagObj[name] === true) {
          flagValue |= 1 << idx;
        }
      }
      const rem = ctx.storagePtr % align32;
      if (rem !== 0) {
        ctx.storagePtr += align32 - rem;
      }
      const dv2 = new DataView(ctx.memory.buffer);
      if (intSizeBytes === 1) {
        dv2.setUint8(ctx.storagePtr, flagValue);
      } else if (intSizeBytes === 2) {
        dv2.setUint16(ctx.storagePtr, flagValue);
      } else if (intSizeBytes === 4) {
        dv2.setUint32(ctx.storagePtr, flagValue);
      } else {
        throw new Error(`unrecognized flag size [${intSizeBytes} bytes]`);
      }
      ctx.storagePtr += intSizeBytes;
    };
  }
  function _lowerFlatEnum(lowerMetas) {
    return function _lowerFlatEnumInner(ctx) {
      _debugLog("[_lowerFlatEnum()] args", { ctx });
      const v = ctx.vals[0];
      const isNotEnumObject = typeof v !== "object" || Object.keys(v).length !== 2 || !("tag" in v);
      if (isNotEnumObject) {
        ctx.vals[0] = { tag: v };
      }
      _lowerFlatVariant(lowerMetas)(ctx);
    };
  }
  function _lowerFlatOption(lowerMetas) {
    return function _lowerFlatOptionInner(ctx) {
      _debugLog("[_lowerFlatOption()] args", { ctx });
      const v = ctx.vals[0];
      if (v === null) {
        ctx.vals[0] = { tag: "none" };
      } else {
        const isNotOptionObject = typeof v !== "object" || Object.keys(v).length !== 2 || !("tag" in v) || !(v.tag === "some" || v.tag === "none") || !("val" in v);
        if (isNotOptionObject) {
          ctx.vals[0] = { tag: "some", val: v };
        }
      }
      _lowerFlatVariant(lowerMetas)(ctx);
    };
  }
  function _lowerFlatResult(lowerMetas) {
    return function _lowerFlatResultInner(ctx) {
      _debugLog("[_lowerFlatResult()] args", { lowerMetas });
      const v = ctx.vals[0];
      const isNotResultObject = typeof v !== "object" || Object.keys(v).length !== 2 || !("tag" in v) || !("ok" === v.tag || "err" === v.tag) || !("val" in v);
      if (isNotResultObject) {
        ctx.vals[0] = { tag: "ok", val: v };
      }
      _lowerFlatVariant(lowerMetas)(ctx);
    };
  }
  function _lowerFlatOwn(meta) {
    const { lowerFn, componentIdx: componentIdx2 } = meta;
    return function _lowerFlatOwnInner(ctx) {
      _debugLog("[_lowerFlatOwn()] args", { ctx });
      const { createFn } = ctx;
      if (ctx.componentIdx !== componentIdx2) {
        throw new Error(`component index mismatch (expected [${componentIdx2}], lift called from [${ctx.componentIdx}])`);
      }
      const obj = ctx.vals[0];
      if (obj === void 0 || obj === null) {
        throw new Error("missing resource");
      }
      const handle = lowerFn(obj);
      ctx.vals[0] = handle;
      _lowerFlatU32(ctx);
    };
  }
  const STREAMS = new RepTable({ target: "global stream map" });
  const ASYNC_STATE = /* @__PURE__ */ new Map();
  function getOrCreateAsyncState(componentIdx2, init) {
    if (!ASYNC_STATE.has(componentIdx2)) {
      const newState = new ComponentAsyncState({ componentIdx: componentIdx2 });
      ASYNC_STATE.set(componentIdx2, newState);
    }
    return ASYNC_STATE.get(componentIdx2);
  }
  class ComponentAsyncState {
    static EVENT_HANDLER_EVENTS = ["backpressure-change"];
    #componentIdx;
    #callingAsyncImport = false;
    #syncImportWait = promiseWithResolvers();
    #locked = false;
    #parkedTasks = /* @__PURE__ */ new Map();
    #suspendedTasksByTaskID = /* @__PURE__ */ new Map();
    #suspendedTaskIDs = [];
    #errored = null;
    #backpressure = 0;
    #backpressureWaiters = 0n;
    #handlerMap = /* @__PURE__ */ new Map();
    #nextHandlerID = 0n;
    #tickLoop = null;
    #tickLoopInterval = null;
    #onExclusiveReleaseHandlers = [];
    mayLeave = true;
    handles;
    subtasks;
    constructor(args) {
      this.#componentIdx = args.componentIdx;
      this.handles = new RepTable({ target: `component [${this.#componentIdx}] handles (waitable objects)` });
      this.subtasks = new RepTable({ target: `component [${this.#componentIdx}] subtasks` });
    }
    componentIdx() {
      return this.#componentIdx;
    }
    errored() {
      return this.#errored !== null;
    }
    setErrored(err) {
      _debugLog("[ComponentAsyncState#setErrored()] component errored", { err, componentIdx: this.#componentIdx });
      if (this.#errored) {
        return;
      }
      if (!err) {
        err = new Error("error elswehere (see other component instance error)");
        err.componentIdx = this.#componentIdx;
      }
      this.#errored = err;
    }
    callingSyncImport(val) {
      if (val === void 0) {
        return this.#callingAsyncImport;
      }
      if (typeof val !== "boolean") {
        throw new TypeError("invalid setting for async import");
      }
      const prev = this.#callingAsyncImport;
      this.#callingAsyncImport = val;
      if (prev === true && this.#callingAsyncImport === false) {
        this.#notifySyncImportEnd();
      }
    }
    #notifySyncImportEnd() {
      const existing = this.#syncImportWait;
      this.#syncImportWait = promiseWithResolvers();
      existing.resolve();
    }
    async waitForSyncImportCallEnd() {
      await this.#syncImportWait.promise;
    }
    setBackpressure(v) {
      this.#backpressure = v;
      return this.#backpressure;
    }
    getBackpressure() {
      return this.#backpressure;
    }
    incrementBackpressure() {
      const current = this.#backpressure;
      if (current < 0 || current > 2 ** 16) {
        throw new Error(`invalid current backpressure value [${current}]`);
      }
      const newValue = this.getBackpressure() + 1;
      if (newValue >= 2 ** 16) {
        throw new Error(`invalid new backpressure value [${newValue}], overflow`);
      }
      return this.setBackpressure(newValue);
    }
    decrementBackpressure() {
      const current = this.#backpressure;
      if (current < 0 || current > 2 ** 16) {
        throw new Error(`invalid current backpressure value [${current}]`);
      }
      const newValue = Math.max(0, current - 1);
      if (newValue < 0) {
        throw new Error(`invalid new backpressure value [${newValue}], underflow`);
      }
      return this.setBackpressure(newValue);
    }
    hasBackpressure() {
      return this.#backpressure > 0;
    }
    waitForBackpressure() {
      let backpressureCleared = false;
      const cstate = this;
      cstate.addBackpressureWaiter();
      const handlerID = this.registerHandler({
        event: "backpressure-change",
        fn: (bp) => {
          if (bp === 0) {
            cstate.removeHandler(handlerID);
            backpressureCleared = true;
          }
        }
      });
      return new Promise((resolve2) => {
        const interval = setInterval(() => {
          if (backpressureCleared) {
            return;
          }
          clearInterval(interval);
          cstate.removeBackpressureWaiter();
          resolve2(null);
        }, 0);
      });
    }
    registerHandler(args) {
      const { event, fn } = args;
      if (!event) {
        throw new Error("missing handler event");
      }
      if (!fn) {
        throw new Error("missing handler fn");
      }
      if (!ComponentAsyncState.EVENT_HANDLER_EVENTS.includes(event)) {
        throw new Error(`unrecognized event handler [${event}]`);
      }
      const handlerID = this.#nextHandlerID++;
      let handlers = this.#handlerMap.get(event);
      if (!handlers) {
        handlers = [];
        this.#handlerMap.set(event, handlers);
      }
      handlers.push({ id: handlerID, fn, event });
      return handlerID;
    }
    removeHandler(args) {
      const { event, handlerID } = args;
      const registeredHandlers = this.#handlerMap.get(event);
      if (!registeredHandlers) {
        return;
      }
      const found = registeredHandlers.find((h) => h.id === handlerID);
      if (!found) {
        return;
      }
      this.#handlerMap.set(event, this.#handlerMap.get(event).filter((h) => h.id !== handlerID));
    }
    getBackpressureWaiters() {
      return this.#backpressureWaiters;
    }
    addBackpressureWaiter() {
      this.#backpressureWaiters++;
    }
    removeBackpressureWaiter() {
      this.#backpressureWaiters--;
      if (this.#backpressureWaiters < 0) {
        throw new Error("unexepctedly negative number of backpressure waiters");
      }
    }
    isExclusivelyLocked() {
      return this.#locked === true;
    }
    setLocked(locked) {
      this.#locked = locked;
    }
    // TODO(fix): we might want to check for pre-locked status here, we should be deterministically
    // going from locked -> unlocked and vice versa
    exclusiveLock() {
      _debugLog("[ComponentAsyncState#exclusiveLock()]", {
        locked: this.#locked,
        componentIdx: this.#componentIdx
      });
      this.setLocked(true);
    }
    exclusiveRelease() {
      _debugLog("[ComponentAsyncState#exclusiveRelease()] args", {
        locked: this.#locked,
        componentIdx: this.#componentIdx
      });
      this.setLocked(false);
      this.#onExclusiveReleaseHandlers = this.#onExclusiveReleaseHandlers.filter((v) => !!v);
      for (const [idx, f] of this.#onExclusiveReleaseHandlers.entries()) {
        try {
          this.#onExclusiveReleaseHandlers[idx] = null;
          f();
        } catch (err) {
          _debugLog("error while executing handler for next exclusive release", err);
          throw err;
        }
      }
    }
    onNextExclusiveRelease(fn) {
      _debugLog("[ComponentAsyncState#()onNextExclusiveRelease] registering");
      this.#onExclusiveReleaseHandlers.push(fn);
    }
    #getSuspendedTaskMeta(taskID) {
      return this.#suspendedTasksByTaskID.get(taskID);
    }
    #removeSuspendedTaskMeta(taskID) {
      _debugLog("[ComponentAsyncState#removeSuspendedTaskMeta()] removing suspended task", { taskID });
      const idx = this.#suspendedTaskIDs.findIndex((t) => t === taskID);
      const meta = this.#suspendedTasksByTaskID.get(taskID);
      this.#suspendedTaskIDs[idx] = null;
      this.#suspendedTasksByTaskID.delete(taskID);
      return meta;
    }
    #addSuspendedTaskMeta(meta) {
      if (!meta) {
        throw new Error("missing task meta");
      }
      const taskID = meta.taskID;
      this.#suspendedTasksByTaskID.set(taskID, meta);
      this.#suspendedTaskIDs.push(taskID);
      if (this.#suspendedTasksByTaskID.size < this.#suspendedTaskIDs.length - 10) {
        this.#suspendedTaskIDs = this.#suspendedTaskIDs.filter((t) => t !== null);
      }
    }
    // TODO(threads): readyFn is normally on the thread
    suspendTask(args) {
      const { task, readyFn } = args;
      const taskID = task.id();
      _debugLog("[ComponentAsyncState#suspendTask()]", {
        taskID,
        componentIdx: this.#componentIdx,
        taskEntryFnName: task.entryFnName(),
        subtask: task.getParentSubtask()
      });
      if (this.#getSuspendedTaskMeta(taskID)) {
        throw new Error(`task [${taskID}] already suspended`);
      }
      const { promise: promise2, resolve: resolve2, reject: reject2 } = promiseWithResolvers();
      this.#addSuspendedTaskMeta({
        task,
        taskID,
        readyFn,
        resume: () => {
          _debugLog("[ComponentAsyncState#suspendTask()] resuming suspended task", { taskID });
          resolve2(!task.isCancelled());
        }
      });
      this.runTickLoop();
      return promise2;
    }
    resumeTaskByID(taskID) {
      const meta = this.#removeSuspendedTaskMeta(taskID);
      if (!meta) {
        return;
      }
      if (meta.taskID !== taskID) {
        throw new Error("task ID does not match");
      }
      meta.resume();
    }
    async runTickLoop() {
      if (this.#tickLoop !== null) {
        return;
      }
      this.#tickLoop = 1;
      setTimeout(async () => {
        let done = this.tick();
        while (!done) {
          await new Promise((resolve2) => setTimeout(resolve2, 30));
          done = this.tick();
        }
        this.#tickLoop = null;
      }, 10);
    }
    tick() {
      const resumableTasks = this.#suspendedTaskIDs.filter((t) => t !== null);
      for (const taskID of resumableTasks) {
        const meta = this.#suspendedTasksByTaskID.get(taskID);
        if (!meta || !meta.readyFn) {
          throw new Error(`missing/invalid task despite ID [${taskID}] being present`);
        }
        if (meta.task.isRejected()) {
          _debugLog("[ComponentAsyncState#suspendTask()] detected task rejection, leaving early", { meta });
          this.resumeTaskByID(taskID);
          return;
        }
        const isReady = meta.readyFn();
        if (!isReady) {
          continue;
        }
        this.resumeTaskByID(taskID);
      }
      return this.#suspendedTaskIDs.filter((t) => t !== null).length === 0;
    }
    addStreamEndToTable(args) {
      _debugLog("[ComponentAsyncState#addStreamEnd()] args", args);
      const { tableIdx, streamEnd } = args;
      if (typeof streamEnd === "number") {
        throw new Error("INSERTING BAD STREAMEND");
      }
      let { table, componentIdx: componentIdx2 } = STREAM_TABLES[tableIdx];
      if (componentIdx2 === void 0 || !table) {
        throw new Error(`invalid global stream table state for table [${tableIdx}]`);
      }
      const handle = table.insert(streamEnd);
      streamEnd.setHandle(handle);
      streamEnd.setStreamTableIdx(tableIdx);
      const cstate = getOrCreateAsyncState(componentIdx2);
      const waitableIdx = cstate.handles.insert(streamEnd);
      streamEnd.setWaitableIdx(waitableIdx);
      _debugLog("[ComponentAsyncState#addStreamEnd()] added stream end", {
        tableIdx,
        table,
        handle,
        streamEnd,
        destComponentIdx: componentIdx2
      });
      return { handle, waitableIdx };
    }
    createWaitable(args) {
      return new Waitable({ target: args?.target });
    }
    createReadableStreamEnd(args) {
      _debugLog("[ComponentAsyncState#createStreamEnd()] args", args);
      const { tableIdx, elemMeta, hostInjectFn } = args;
      const { table: localStreamTable, componentIdx: componentIdx2 } = STREAM_TABLES[tableIdx];
      if (!localStreamTable) {
        throw new Error(`missing global stream table lookup for table [${tableIdx}] while creating stream`);
      }
      if (componentIdx2 !== this.#componentIdx) {
        throw new Error("component idx mismatch while creating stream");
      }
      const waitable = this.createWaitable();
      const streamEnd = new StreamReadableEnd({
        tableIdx,
        elemMeta,
        hostInjectFn,
        pendingBufferMeta: {},
        target: `stream read end (lowered, @init)`,
        waitable
      });
      streamEnd.setWaitableIdx(this.handles.insert(streamEnd));
      streamEnd.setHandle(localStreamTable.insert(streamEnd));
      if (streamEnd.streamTableIdx() !== tableIdx) {
        throw new Error("unexpectedly mismatched stream table");
      }
      const streamEndWaitableIdx = streamEnd.waitableIdx();
      const streamEndHandle = streamEnd.handle();
      waitable.setTarget(`waitable for stream read end (lowered, waitable [${streamEndWaitableIdx}])`);
      streamEnd.setTarget(`stream read end (lowered, waitable [${streamEndWaitableIdx}])`);
      return {
        waitableIdx: streamEndWaitableIdx,
        handle: streamEndHandle,
        streamEnd
      };
    }
    createStream(args) {
      _debugLog("[ComponentAsyncState#createStream()] args", args);
      const { tableIdx, elemMeta, hostInjectFn } = args;
      if (tableIdx === void 0) {
        throw new Error("missing table idx while adding stream");
      }
      if (elemMeta === void 0) {
        throw new Error("missing element metadata while adding stream");
      }
      const { table: localStreamTable, componentIdx: componentIdx2 } = STREAM_TABLES[tableIdx];
      if (!localStreamTable) {
        throw new Error(`missing global stream table lookup for table [${tableIdx}] while creating stream`);
      }
      if (componentIdx2 !== this.#componentIdx) {
        throw new Error("component idx mismatch while creating stream");
      }
      const readWaitable = this.createWaitable();
      const writeWaitable = this.createWaitable();
      const stream = new InternalStream({
        tableIdx,
        elemMeta,
        readWaitable,
        writeWaitable,
        hostInjectFn
      });
      stream.setGlobalStreamMapRep(STREAMS.insert(stream));
      const writeEnd = stream.writeEnd();
      writeEnd.setWaitableIdx(this.handles.insert(writeEnd));
      writeEnd.setHandle(localStreamTable.insert(writeEnd));
      if (writeEnd.streamTableIdx() !== tableIdx) {
        throw new Error("unexpectedly mismatched stream table");
      }
      const writeEndWaitableIdx = writeEnd.waitableIdx();
      const writeEndHandle = writeEnd.handle();
      writeWaitable.setTarget(`waitable for stream write end (waitable [${writeEndWaitableIdx}])`);
      writeEnd.setTarget(`stream write end (waitable [${writeEndWaitableIdx}])`);
      const readEnd = stream.readEnd();
      readEnd.setWaitableIdx(this.handles.insert(readEnd));
      readEnd.setHandle(localStreamTable.insert(readEnd));
      if (readEnd.streamTableIdx() !== tableIdx) {
        throw new Error("unexpectedly mismatched stream table");
      }
      const readEndWaitableIdx = readEnd.waitableIdx();
      const readEndHandle = readEnd.handle();
      readWaitable.setTarget(`waitable for read end (waitable [${readEndWaitableIdx}])`);
      readEnd.setTarget(`stream read end (waitable [${readEndWaitableIdx}])`);
      return {
        writeEnd,
        writeEndWaitableIdx,
        writeEndHandle,
        readEndWaitableIdx,
        readEndHandle,
        readEnd
      };
    }
    getStreamEnd(args) {
      _debugLog("[ComponentAsyncState#getStreamEnd()] args", args);
      const { tableIdx, streamEndHandle, streamEndWaitableIdx } = args;
      if (tableIdx === void 0) {
        throw new Error("missing table idx while getting stream end");
      }
      const { table, componentIdx: componentIdx2 } = STREAM_TABLES[tableIdx];
      const cstate = getOrCreateAsyncState(componentIdx2);
      let streamEnd;
      if (streamEndWaitableIdx !== void 0) {
        streamEnd = cstate.handles.get(streamEndWaitableIdx);
      } else if (streamEndHandle !== void 0) {
        if (!table) {
          throw new Error(`missing/invalid table [${tableIdx}] while getting stream end`);
        }
        streamEnd = table.get(streamEndHandle);
      } else {
        throw new TypeError("must specify either waitable idx or handle to retrieve stream");
      }
      if (!streamEnd) {
        throw new Error(`missing stream end (tableIdx [${tableIdx}], handle [${streamEndHandle}], waitableIdx [${streamEndWaitableIdx}])`);
      }
      if (tableIdx && streamEnd.streamTableIdx() !== tableIdx) {
        throw new Error(`stream end table idx [${streamEnd.streamTableIdx()}] does not match [${tableIdx}]`);
      }
      return streamEnd;
    }
    deleteStreamEnd(args) {
      _debugLog("[ComponentAsyncState#deleteStreamEnd()] args", args);
      const { tableIdx, streamEndWaitableIdx } = args;
      if (tableIdx === void 0) {
        throw new Error("missing table idx while removing stream end");
      }
      if (streamEndWaitableIdx === void 0) {
        throw new Error("missing stream idx while removing stream end");
      }
      const { table, componentIdx: componentIdx2 } = STREAM_TABLES[tableIdx];
      const cstate = getOrCreateAsyncState(componentIdx2);
      const streamEnd = cstate.handles.get(streamEndWaitableIdx);
      if (!streamEnd) {
        throw new Error(`missing stream end [${streamEndWaitableIdx}] in component handles while deleting stream`);
      }
      if (streamEnd.streamTableIdx() !== tableIdx) {
        throw new Error(`stream end table idx [${streamEnd.streamTableIdx()}] does not match [${tableIdx}]`);
      }
      let removed = cstate.handles.remove(streamEnd.waitableIdx());
      if (!removed) {
        throw new Error(`failed to remove stream end [${streamEndWaitableIdx}] waitable obj in component [${componentIdx2}]`);
      }
      removed = table.remove(streamEnd.handle());
      if (!removed) {
        throw new Error(`failed to remove stream end with handle [${streamEnd.handle()}] from stream table [${tableIdx}] in component [${componentIdx2}]`);
      }
      return streamEnd;
    }
    removeStreamEndFromTable(args) {
      _debugLog("[ComponentAsyncState#removeStreamEndFromTable()] args", args);
      const { tableIdx, streamWaitableIdx } = args;
      if (tableIdx === void 0) {
        throw new Error("missing table idx while removing stream end");
      }
      if (streamWaitableIdx === void 0) {
        throw new Error("missing stream end waitable idx while removing stream end");
      }
      const { table, componentIdx: componentIdx2 } = STREAM_TABLES[tableIdx];
      if (!table) {
        throw new Error(`missing/invalid table [${tableIdx}] while removing stream end`);
      }
      const cstate = getOrCreateAsyncState(componentIdx2);
      const streamEnd = cstate.handles.get(streamWaitableIdx);
      if (!streamEnd) {
        throw new Error(`missing stream end (handle [${streamWaitableIdx}], table [${tableIdx}])`);
      }
      const handle = streamEnd.handle();
      let removed = cstate.handles.remove(streamWaitableIdx);
      if (!removed) {
        throw new Error(`failed to remove streamEnd from handles (waitable idx [${streamWaitableIdx}]), component [${componentIdx2}])`);
      }
      removed = table.remove(handle);
      if (!removed) {
        throw new Error(`failed to remove streamEnd from table (handle [${handle}]), table [${tableIdx}], component [${componentIdx2}])`);
      }
      return streamEnd;
    }
    createFuture(args) {
      _debugLog("[ComponentAsyncState#createFuture()] args", args);
      const { tableIdx, elemMeta, hostInjectFn } = args;
      if (tableIdx === void 0) {
        throw new Error("missing table idx while adding future");
      }
      if (elemMeta === void 0) {
        throw new Error("missing element metadata while adding future");
      }
      const { table: futureTable, componentIdx: componentIdx2 } = FUTURE_TABLES[tableIdx];
      if (!futureTable) {
        throw new Error(`missing global future table lookup for table [${tableIdx}] while creating future`);
      }
      if (componentIdx2 !== this.#componentIdx) {
        throw new Error("component idx mismatch while creating future");
      }
      const readWaitable = this.createWaitable();
      const writeWaitable = this.createWaitable();
      const future = new InternalFuture({
        tableIdx,
        componentIdx: this.#componentIdx,
        elemMeta,
        readWaitable,
        writeWaitable,
        hostInjectFn
      });
      future.setGlobalFutureMapRep(FUTURES.insert(future));
      const writeEnd = future.writeEnd();
      writeEnd.setWaitableIdx(this.handles.insert(writeEnd));
      writeEnd.setHandle(futureTable.insert(writeEnd));
      if (writeEnd.futureTableIdx() !== tableIdx) {
        throw new Error("unexpectedly mismatched future table");
      }
      const writeEndWaitableIdx = writeEnd.waitableIdx();
      const writeEndHandle = writeEnd.handle();
      writeWaitable.setTarget(`waitable for future write end (waitable [${writeEndWaitableIdx}])`);
      writeEnd.setTarget(`future write end (waitable [${writeEndWaitableIdx}])`);
      const readEnd = future.readEnd();
      readEnd.setWaitableIdx(this.handles.insert(readEnd));
      readEnd.setHandle(futureTable.insert(readEnd));
      if (readEnd.futureTableIdx() !== tableIdx) {
        throw new Error("unexpectedly mismatched future table");
      }
      const readEndWaitableIdx = readEnd.waitableIdx();
      const readEndHandle = readEnd.handle();
      readWaitable.setTarget(`waitable for read end (waitable [${readEndWaitableIdx}])`);
      readEnd.setTarget(`future read end (waitable [${readEndWaitableIdx}])`);
      return {
        writeEnd,
        writeEndWaitableIdx,
        writeEndHandle,
        readEndWaitableIdx,
        readEndHandle,
        readEnd
      };
    }
    getFutureEnd(args) {
      _debugLog("[ComponentAsyncState#getFutureEnd()] args", args);
      const { tableIdx, futureEndHandle, futureEndWaitableIdx } = args;
      if (tableIdx === void 0) {
        throw new Error("missing table idx while getting future end");
      }
      const { table, componentIdx: componentIdx2 } = FUTURE_TABLES[tableIdx];
      const cstate = getOrCreateAsyncState(componentIdx2);
      let futureEnd;
      if (futureEndWaitableIdx !== void 0) {
        futureEnd = cstate.handles.get(futureEndWaitableIdx);
      } else if (futureEndHandle !== void 0) {
        if (!table) {
          throw new Error(`missing/invalid table [${tableIdx}] while getting future end`);
        }
        futureEnd = table.get(futureEndHandle);
      } else {
        throw new TypeError("must specify either waitable idx or handle to retrieve future");
      }
      if (!futureEnd) {
        throw new Error(`missing future end (tableIdx [${tableIdx}], handle [${futureEndHandle}], waitableIdx [${futureEndWaitableIdx}])`);
      }
      if (tableIdx && futureEnd.futureTableIdx() !== tableIdx) {
        throw new Error(`future end table idx [${futureEnd.futureTableIdx()}] does not match [${tableIdx}]`);
      }
      return futureEnd;
    }
    removeFutureEndFromTable(args) {
      _debugLog("[ComponentAsyncState#removeFutureEndFromTable()] args", args);
      const { tableIdx, futureWaitableIdx } = args;
      if (tableIdx === void 0) {
        throw new Error("missing table idx while removing future end");
      }
      if (futureWaitableIdx === void 0) {
        throw new Error("missing future end waitable idx while removing future end");
      }
      const { table, componentIdx: componentIdx2 } = FUTURE_TABLES[tableIdx];
      if (!table) {
        throw new Error(`missing/invalid table [${tableIdx}] while removing future end`);
      }
      const cstate = getOrCreateAsyncState(componentIdx2);
      const futureEnd = cstate.handles.get(futureWaitableIdx);
      if (!futureEnd) {
        throw new Error(`missing future end (handle [${futureWaitableIdx}], table [${tableIdx}])`);
      }
      const handle = futureEnd.handle();
      let removed = cstate.handles.remove(futureWaitableIdx);
      if (!removed) {
        throw new Error(`failed to remove futureEnd from handles (waitable idx [${futureWaitableIdx}]), component [${componentIdx2}])`);
      }
      removed = table.remove(handle);
      if (!removed) {
        throw new Error(`failed to remove futureEnd from table (handle [${handle}]), table [${tableIdx}], component [${componentIdx2}])`);
      }
      return futureEnd;
    }
  }
  const isNode = typeof process !== "undefined" && process.versions && process.versions.node;
  let _fs;
  async function fetchCompile(url) {
    if (isNode) {
      _fs = _fs || await import("node:fs/promises");
      return WebAssembly.compile(await _fs.readFile(url));
    }
    return fetch(url).then(WebAssembly.compileStreaming);
  }
  const symbolCabiDispose = Symbol.for("cabiDispose");
  const symbolRscHandle = Symbol("handle");
  const symbolRscRep = Symbol.for("cabiRep");
  const handleTables = [];
  class ComponentError extends Error {
    constructor(value) {
      const enumerable = typeof value !== "string";
      super(enumerable ? `${String(value)} (see error.payload)` : value);
      Object.defineProperty(this, "payload", { value, enumerable });
    }
  }
  function getErrorPayload(e) {
    if (e && hasOwnProperty.call(e, "payload")) return e.payload;
    if (e instanceof Error) throw e;
    return e;
  }
  const isLE = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
  const hasOwnProperty = Object.prototype.hasOwnProperty;
  if (!getCoreModule) getCoreModule = (name) => fetchCompile(new URL(`./${name}`, import.meta.url));
  const module0 = getCoreModule("yosys.core.wasm");
  const module1 = getCoreModule("yosys.core2.wasm");
  const module2 = getCoreModule("yosys.core3.wasm");
  const module3 = getCoreModule("yosys.core4.wasm");
  const { cli, fs, io, monotonicClock, wallClock } = imports.runtime;
  if (cli === void 0) {
    const err = new Error("unexpectedly undefined instance import 'cli', was 'cli' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  cli._isHostProvided = true;
  if (fs === void 0) {
    const err = new Error("unexpectedly undefined instance import 'fs', was 'fs' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  fs._isHostProvided = true;
  if (io === void 0) {
    const err = new Error("unexpectedly undefined instance import 'io', was 'io' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  io._isHostProvided = true;
  if (monotonicClock === void 0) {
    const err = new Error("unexpectedly undefined instance import 'monotonicClock', was 'monotonicClock' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  monotonicClock._isHostProvided = true;
  if (wallClock === void 0) {
    const err = new Error("unexpectedly undefined instance import 'wallClock', was 'wallClock' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  wallClock._isHostProvided = true;
  const {
    TerminalInput: TerminalInput2,
    TerminalOutput: TerminalOutput2,
    exit,
    getArguments,
    getEnvironment,
    getStderr,
    getStdin,
    getStdout,
    getTerminalStderr,
    getTerminalStdin,
    getTerminalStdout
  } = cli;
  if (TerminalInput2 === void 0) {
    const err = new Error("unexpectedly undefined local import 'TerminalInput', was 'TerminalInput' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  TerminalInput2._isHostProvided = true;
  if (TerminalOutput2 === void 0) {
    const err = new Error("unexpectedly undefined local import 'TerminalOutput', was 'TerminalOutput' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  TerminalOutput2._isHostProvided = true;
  if (exit === void 0) {
    const err = new Error("unexpectedly undefined local import 'exit', was 'exit' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  exit._isHostProvided = true;
  if (getArguments === void 0) {
    const err = new Error("unexpectedly undefined local import 'getArguments', was 'getArguments' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  getArguments._isHostProvided = true;
  if (getEnvironment === void 0) {
    const err = new Error("unexpectedly undefined local import 'getEnvironment', was 'getEnvironment' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  getEnvironment._isHostProvided = true;
  if (getStderr === void 0) {
    const err = new Error("unexpectedly undefined local import 'getStderr', was 'getStderr' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  getStderr._isHostProvided = true;
  if (getStdin === void 0) {
    const err = new Error("unexpectedly undefined local import 'getStdin', was 'getStdin' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  getStdin._isHostProvided = true;
  if (getStdout === void 0) {
    const err = new Error("unexpectedly undefined local import 'getStdout', was 'getStdout' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  getStdout._isHostProvided = true;
  if (getTerminalStderr === void 0) {
    const err = new Error("unexpectedly undefined local import 'getTerminalStderr', was 'getTerminalStderr' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  getTerminalStderr._isHostProvided = true;
  if (getTerminalStdin === void 0) {
    const err = new Error("unexpectedly undefined local import 'getTerminalStdin', was 'getTerminalStdin' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  getTerminalStdin._isHostProvided = true;
  if (getTerminalStdout === void 0) {
    const err = new Error("unexpectedly undefined local import 'getTerminalStdout', was 'getTerminalStdout' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  getTerminalStdout._isHostProvided = true;
  const {
    Descriptor: Descriptor2,
    DirectoryEntryStream: DirectoryEntryStream2,
    filesystemErrorCode,
    getDirectories
  } = fs;
  if (Descriptor2 === void 0) {
    const err = new Error("unexpectedly undefined local import 'Descriptor', was 'Descriptor' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  Descriptor2._isHostProvided = true;
  if (DirectoryEntryStream2 === void 0) {
    const err = new Error("unexpectedly undefined local import 'DirectoryEntryStream', was 'DirectoryEntryStream' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  DirectoryEntryStream2._isHostProvided = true;
  if (filesystemErrorCode === void 0) {
    const err = new Error("unexpectedly undefined local import 'filesystemErrorCode', was 'filesystemErrorCode' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  filesystemErrorCode._isHostProvided = true;
  if (getDirectories === void 0) {
    const err = new Error("unexpectedly undefined local import 'getDirectories', was 'getDirectories' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  getDirectories._isHostProvided = true;
  const {
    Error: Error$1,
    InputStream: InputStream2,
    OutputStream: OutputStream2,
    Pollable: Pollable2,
    poll
  } = io;
  if (Error$1 === void 0) {
    const err = new Error("unexpectedly undefined local import 'Error$1', was 'Error' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  Error$1._isHostProvided = true;
  if (InputStream2 === void 0) {
    const err = new Error("unexpectedly undefined local import 'InputStream', was 'InputStream' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  InputStream2._isHostProvided = true;
  if (OutputStream2 === void 0) {
    const err = new Error("unexpectedly undefined local import 'OutputStream', was 'OutputStream' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  OutputStream2._isHostProvided = true;
  if (Pollable2 === void 0) {
    const err = new Error("unexpectedly undefined local import 'Pollable', was 'Pollable' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  Pollable2._isHostProvided = true;
  if (poll === void 0) {
    const err = new Error("unexpectedly undefined local import 'poll', was 'poll' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  poll._isHostProvided = true;
  const {
    now,
    subscribeDuration,
    subscribeInstant
  } = monotonicClock;
  if (now === void 0) {
    const err = new Error("unexpectedly undefined local import 'now', was 'now' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  now._isHostProvided = true;
  if (subscribeDuration === void 0) {
    const err = new Error("unexpectedly undefined local import 'subscribeDuration', was 'subscribeDuration' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  subscribeDuration._isHostProvided = true;
  if (subscribeInstant === void 0) {
    const err = new Error("unexpectedly undefined local import 'subscribeInstant', was 'subscribeInstant' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  subscribeInstant._isHostProvided = true;
  const { now: now$1 } = wallClock;
  if (now$1 === void 0) {
    const err = new Error("unexpectedly undefined local import 'now$1', was 'now' available at instantiation?");
    console.error("ERROR:", err.toString());
    throw err;
  }
  now$1._isHostProvided = true;
  let gen = (function* _initGenerator() {
    let exports0;
    let exports1;
    const _trampoline0 = function() {
      _debugLog('[iface="wasi:clocks/monotonic-clock@0.2.3", function="now"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "now",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => now()
      });
      _debugLog('[iface="wasi:clocks/monotonic-clock@0.2.3", function="now"][Instruction::Return]', {
        funcName: "now",
        paramCount: 1,
        async: false,
        postReturn: false
      });
      task.resolve([toUint64(ret)]);
      task.exit();
      return toUint64(ret);
    };
    _trampoline0.fnName = "wasi:clocks/monotonic-clock@0.2.3#now";
    const handleTable1 = [T_FLAG, 0];
    const captureTable1 = /* @__PURE__ */ new Map();
    let captureCnt1 = 0;
    handleTables[1] = handleTable1;
    const _trampoline6 = function(arg0) {
      _debugLog('[iface="wasi:clocks/monotonic-clock@0.2.3", function="subscribe-duration"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "subscribeDuration",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => subscribeDuration(BigInt.asUintN(64, BigInt(arg0)))
      });
      if (!(ret instanceof Pollable2)) {
        throw new TypeError('Resource error: Not a valid "Pollable" resource.');
      }
      var handle0 = ret[symbolRscHandle];
      if (!handle0) {
        const rep2 = ret[symbolRscRep] || ++captureCnt1;
        captureTable1.set(rep2, ret);
        handle0 = rscTableCreateOwn(handleTable1, rep2);
      }
      _debugLog('[iface="wasi:clocks/monotonic-clock@0.2.3", function="subscribe-duration"][Instruction::Return]', {
        funcName: "subscribe-duration",
        paramCount: 1,
        async: false,
        postReturn: false
      });
      task.resolve([handle0]);
      task.exit();
      return handle0;
    };
    _trampoline6.fnName = "wasi:clocks/monotonic-clock@0.2.3#subscribeDuration";
    const _trampoline7 = function(arg0) {
      _debugLog('[iface="wasi:clocks/monotonic-clock@0.2.3", function="subscribe-instant"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "subscribeInstant",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => subscribeInstant(BigInt.asUintN(64, BigInt(arg0)))
      });
      if (!(ret instanceof Pollable2)) {
        throw new TypeError('Resource error: Not a valid "Pollable" resource.');
      }
      var handle0 = ret[symbolRscHandle];
      if (!handle0) {
        const rep2 = ret[symbolRscRep] || ++captureCnt1;
        captureTable1.set(rep2, ret);
        handle0 = rscTableCreateOwn(handleTable1, rep2);
      }
      _debugLog('[iface="wasi:clocks/monotonic-clock@0.2.3", function="subscribe-instant"][Instruction::Return]', {
        funcName: "subscribe-instant",
        paramCount: 1,
        async: false,
        postReturn: false
      });
      task.resolve([handle0]);
      task.exit();
      return handle0;
    };
    _trampoline7.fnName = "wasi:clocks/monotonic-clock@0.2.3#subscribeInstant";
    const handleTable3 = [T_FLAG, 0];
    const captureTable3 = /* @__PURE__ */ new Map();
    let captureCnt3 = 0;
    handleTables[3] = handleTable3;
    const _trampoline8 = function(arg0) {
      var handle1 = arg0;
      var rep2 = handleTable3[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable3.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(OutputStream2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.subscribe"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "subscribe",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.subscribe()
      });
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      if (!(ret instanceof Pollable2)) {
        throw new TypeError('Resource error: Not a valid "Pollable" resource.');
      }
      var handle3 = ret[symbolRscHandle];
      if (!handle3) {
        const rep3 = ret[symbolRscRep] || ++captureCnt1;
        captureTable1.set(rep3, ret);
        handle3 = rscTableCreateOwn(handleTable1, rep3);
      }
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.subscribe"][Instruction::Return]', {
        funcName: "[method]output-stream.subscribe",
        paramCount: 1,
        async: false,
        postReturn: false
      });
      task.resolve([handle3]);
      task.exit();
      return handle3;
    };
    _trampoline8.fnName = "wasi:io/streams@0.2.3#subscribe";
    const handleTable2 = [T_FLAG, 0];
    const captureTable2 = /* @__PURE__ */ new Map();
    let captureCnt2 = 0;
    handleTables[2] = handleTable2;
    const _trampoline9 = function(arg0) {
      var handle1 = arg0;
      var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable2.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(InputStream2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.subscribe"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "subscribe",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => rsc0.subscribe()
      });
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      if (!(ret instanceof Pollable2)) {
        throw new TypeError('Resource error: Not a valid "Pollable" resource.');
      }
      var handle3 = ret[symbolRscHandle];
      if (!handle3) {
        const rep3 = ret[symbolRscRep] || ++captureCnt1;
        captureTable1.set(rep3, ret);
        handle3 = rscTableCreateOwn(handleTable1, rep3);
      }
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.subscribe"][Instruction::Return]', {
        funcName: "[method]input-stream.subscribe",
        paramCount: 1,
        async: false,
        postReturn: false
      });
      task.resolve([handle3]);
      task.exit();
      return handle3;
    };
    _trampoline9.fnName = "wasi:io/streams@0.2.3#subscribe";
    const _trampoline11 = function() {
      _debugLog('[iface="wasi:cli/stderr@0.2.3", function="get-stderr"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "getStderr",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => getStderr()
      });
      if (!(ret instanceof OutputStream2)) {
        throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
      }
      var handle0 = ret[symbolRscHandle];
      if (!handle0) {
        const rep2 = ret[symbolRscRep] || ++captureCnt3;
        captureTable3.set(rep2, ret);
        handle0 = rscTableCreateOwn(handleTable3, rep2);
      }
      _debugLog('[iface="wasi:cli/stderr@0.2.3", function="get-stderr"][Instruction::Return]', {
        funcName: "get-stderr",
        paramCount: 1,
        async: false,
        postReturn: false
      });
      task.resolve([handle0]);
      task.exit();
      return handle0;
    };
    _trampoline11.fnName = "wasi:cli/stderr@0.2.3#getStderr";
    const _trampoline14 = function() {
      _debugLog('[iface="wasi:cli/stdin@0.2.3", function="get-stdin"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "getStdin",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => getStdin()
      });
      if (!(ret instanceof InputStream2)) {
        throw new TypeError('Resource error: Not a valid "InputStream" resource.');
      }
      var handle0 = ret[symbolRscHandle];
      if (!handle0) {
        const rep2 = ret[symbolRscRep] || ++captureCnt2;
        captureTable2.set(rep2, ret);
        handle0 = rscTableCreateOwn(handleTable2, rep2);
      }
      _debugLog('[iface="wasi:cli/stdin@0.2.3", function="get-stdin"][Instruction::Return]', {
        funcName: "get-stdin",
        paramCount: 1,
        async: false,
        postReturn: false
      });
      task.resolve([handle0]);
      task.exit();
      return handle0;
    };
    _trampoline14.fnName = "wasi:cli/stdin@0.2.3#getStdin";
    const _trampoline15 = function() {
      _debugLog('[iface="wasi:cli/stdout@0.2.3", function="get-stdout"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "getStdout",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => getStdout()
      });
      if (!(ret instanceof OutputStream2)) {
        throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
      }
      var handle0 = ret[symbolRscHandle];
      if (!handle0) {
        const rep2 = ret[symbolRscRep] || ++captureCnt3;
        captureTable3.set(rep2, ret);
        handle0 = rscTableCreateOwn(handleTable3, rep2);
      }
      _debugLog('[iface="wasi:cli/stdout@0.2.3", function="get-stdout"][Instruction::Return]', {
        funcName: "get-stdout",
        paramCount: 1,
        async: false,
        postReturn: false
      });
      task.resolve([handle0]);
      task.exit();
      return handle0;
    };
    _trampoline15.fnName = "wasi:cli/stdout@0.2.3#getStdout";
    const _trampoline16 = function(arg0) {
      let variant0;
      switch (arg0) {
        case 0: {
          variant0 = {
            tag: "ok",
            val: void 0
          };
          break;
        }
        case 1: {
          variant0 = {
            tag: "err",
            val: void 0
          };
          break;
        }
        default: {
          throw new TypeError("invalid variant discriminant for expected");
        }
      }
      _debugLog('[iface="wasi:cli/exit@0.2.3", function="exit"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "exit",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => exit(variant0)
      });
      _debugLog('[iface="wasi:cli/exit@0.2.3", function="exit"][Instruction::Return]', {
        funcName: "exit",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline16.fnName = "wasi:cli/exit@0.2.3#exit";
    let exports2;
    let memory0;
    let realloc0;
    let realloc0Async;
    const _trampoline17 = function(arg0) {
      _debugLog('[iface="wasi:cli/environment@0.2.3", function="get-arguments"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "getArguments",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => getArguments()
      });
      var vec1 = ret;
      var len1 = vec1.length;
      var result1 = realloc0(0, 0, 4, len1 * 8);
      for (let i = 0; i < vec1.length; i++) {
        const e = vec1[i];
        const base = result1 + i * 8;
        var encodeRes = _utf8AllocateAndEncode(e, realloc0, memory0);
        var ptr0 = encodeRes.ptr;
        var len0 = encodeRes.len;
        dataView(memory0).setUint32(base + 4, len0, true);
        dataView(memory0).setUint32(base + 0, ptr0, true);
      }
      dataView(memory0).setUint32(arg0 + 4, len1, true);
      dataView(memory0).setUint32(arg0 + 0, result1, true);
      _debugLog('[iface="wasi:cli/environment@0.2.3", function="get-arguments"][Instruction::Return]', {
        funcName: "get-arguments",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline17.fnName = "wasi:cli/environment@0.2.3#getArguments";
    const _trampoline18 = function(arg0) {
      _debugLog('[iface="wasi:cli/environment@0.2.3", function="get-environment"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "getEnvironment",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => getEnvironment()
      });
      var vec3 = ret;
      var len3 = vec3.length;
      var result3 = realloc0(0, 0, 4, len3 * 16);
      for (let i = 0; i < vec3.length; i++) {
        const e = vec3[i];
        const base = result3 + i * 16;
        var [tuple0_0, tuple0_1] = e;
        var encodeRes = _utf8AllocateAndEncode(tuple0_0, realloc0, memory0);
        var ptr1 = encodeRes.ptr;
        var len1 = encodeRes.len;
        dataView(memory0).setUint32(base + 4, len1, true);
        dataView(memory0).setUint32(base + 0, ptr1, true);
        var encodeRes = _utf8AllocateAndEncode(tuple0_1, realloc0, memory0);
        var ptr2 = encodeRes.ptr;
        var len2 = encodeRes.len;
        dataView(memory0).setUint32(base + 12, len2, true);
        dataView(memory0).setUint32(base + 8, ptr2, true);
      }
      dataView(memory0).setUint32(arg0 + 4, len3, true);
      dataView(memory0).setUint32(arg0 + 0, result3, true);
      _debugLog('[iface="wasi:cli/environment@0.2.3", function="get-environment"][Instruction::Return]', {
        funcName: "get-environment",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline18.fnName = "wasi:cli/environment@0.2.3#getEnvironment";
    const _trampoline19 = function(arg0) {
      _debugLog('[iface="wasi:clocks/wall-clock@0.2.3", function="now"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "now$1",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => now$1()
      });
      var { seconds: v0_0, nanoseconds: v0_1 } = ret;
      dataView(memory0).setBigInt64(arg0 + 0, toUint64(v0_0), true);
      dataView(memory0).setInt32(arg0 + 8, toUint32(v0_1), true);
      _debugLog('[iface="wasi:clocks/wall-clock@0.2.3", function="now"][Instruction::Return]', {
        funcName: "now",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline19.fnName = "wasi:clocks/wall-clock@0.2.3#now$1";
    const handleTable7 = [T_FLAG, 0];
    const captureTable7 = /* @__PURE__ */ new Map();
    let captureCnt7 = 0;
    handleTables[7] = handleTable7;
    const _trampoline20 = function(arg0, arg1) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.get-flags"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "getFlags",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.getFlags()
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant5 = ret;
      switch (variant5.tag) {
        case "ok": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 0, true);
          let flags3 = 0;
          if (typeof e === "object" && e !== null) {
            flags3 = Boolean(e.read) << 0 | Boolean(e.write) << 1 | Boolean(e.fileIntegritySync) << 2 | Boolean(e.dataIntegritySync) << 3 | Boolean(e.requestedWriteSync) << 4 | Boolean(e.mutateDirectory) << 5;
          } else if (e !== null && e !== void 0) {
            throw new TypeError("only an object, undefined or null can be converted to flags");
          }
          dataView(memory0).setInt8(arg1 + 1, flags3, true);
          break;
        }
        case "err": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 1, true);
          var val4 = e;
          let enum4;
          switch (val4) {
            case "access": {
              enum4 = 0;
              break;
            }
            case "would-block": {
              enum4 = 1;
              break;
            }
            case "already": {
              enum4 = 2;
              break;
            }
            case "bad-descriptor": {
              enum4 = 3;
              break;
            }
            case "busy": {
              enum4 = 4;
              break;
            }
            case "deadlock": {
              enum4 = 5;
              break;
            }
            case "quota": {
              enum4 = 6;
              break;
            }
            case "exist": {
              enum4 = 7;
              break;
            }
            case "file-too-large": {
              enum4 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum4 = 9;
              break;
            }
            case "in-progress": {
              enum4 = 10;
              break;
            }
            case "interrupted": {
              enum4 = 11;
              break;
            }
            case "invalid": {
              enum4 = 12;
              break;
            }
            case "io": {
              enum4 = 13;
              break;
            }
            case "is-directory": {
              enum4 = 14;
              break;
            }
            case "loop": {
              enum4 = 15;
              break;
            }
            case "too-many-links": {
              enum4 = 16;
              break;
            }
            case "message-size": {
              enum4 = 17;
              break;
            }
            case "name-too-long": {
              enum4 = 18;
              break;
            }
            case "no-device": {
              enum4 = 19;
              break;
            }
            case "no-entry": {
              enum4 = 20;
              break;
            }
            case "no-lock": {
              enum4 = 21;
              break;
            }
            case "insufficient-memory": {
              enum4 = 22;
              break;
            }
            case "insufficient-space": {
              enum4 = 23;
              break;
            }
            case "not-directory": {
              enum4 = 24;
              break;
            }
            case "not-empty": {
              enum4 = 25;
              break;
            }
            case "not-recoverable": {
              enum4 = 26;
              break;
            }
            case "unsupported": {
              enum4 = 27;
              break;
            }
            case "no-tty": {
              enum4 = 28;
              break;
            }
            case "no-such-device": {
              enum4 = 29;
              break;
            }
            case "overflow": {
              enum4 = 30;
              break;
            }
            case "not-permitted": {
              enum4 = 31;
              break;
            }
            case "pipe": {
              enum4 = 32;
              break;
            }
            case "read-only": {
              enum4 = 33;
              break;
            }
            case "invalid-seek": {
              enum4 = 34;
              break;
            }
            case "text-file-busy": {
              enum4 = 35;
              break;
            }
            case "cross-device": {
              enum4 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val4}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg1 + 1, enum4, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.get-flags"][Instruction::Return]', {
        funcName: "[method]descriptor.get-flags",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline20.fnName = "wasi:filesystem/types@0.2.3#getFlags";
    const _trampoline21 = function(arg0, arg1) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.get-type"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "getType",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.getType()
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant5 = ret;
      switch (variant5.tag) {
        case "ok": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 0, true);
          var val3 = e;
          let enum3;
          switch (val3) {
            case "unknown": {
              enum3 = 0;
              break;
            }
            case "block-device": {
              enum3 = 1;
              break;
            }
            case "character-device": {
              enum3 = 2;
              break;
            }
            case "directory": {
              enum3 = 3;
              break;
            }
            case "fifo": {
              enum3 = 4;
              break;
            }
            case "symbolic-link": {
              enum3 = 5;
              break;
            }
            case "regular-file": {
              enum3 = 6;
              break;
            }
            case "socket": {
              enum3 = 7;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val3}" is not one of the cases of descriptor-type`);
            }
          }
          dataView(memory0).setInt8(arg1 + 1, enum3, true);
          break;
        }
        case "err": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 1, true);
          var val4 = e;
          let enum4;
          switch (val4) {
            case "access": {
              enum4 = 0;
              break;
            }
            case "would-block": {
              enum4 = 1;
              break;
            }
            case "already": {
              enum4 = 2;
              break;
            }
            case "bad-descriptor": {
              enum4 = 3;
              break;
            }
            case "busy": {
              enum4 = 4;
              break;
            }
            case "deadlock": {
              enum4 = 5;
              break;
            }
            case "quota": {
              enum4 = 6;
              break;
            }
            case "exist": {
              enum4 = 7;
              break;
            }
            case "file-too-large": {
              enum4 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum4 = 9;
              break;
            }
            case "in-progress": {
              enum4 = 10;
              break;
            }
            case "interrupted": {
              enum4 = 11;
              break;
            }
            case "invalid": {
              enum4 = 12;
              break;
            }
            case "io": {
              enum4 = 13;
              break;
            }
            case "is-directory": {
              enum4 = 14;
              break;
            }
            case "loop": {
              enum4 = 15;
              break;
            }
            case "too-many-links": {
              enum4 = 16;
              break;
            }
            case "message-size": {
              enum4 = 17;
              break;
            }
            case "name-too-long": {
              enum4 = 18;
              break;
            }
            case "no-device": {
              enum4 = 19;
              break;
            }
            case "no-entry": {
              enum4 = 20;
              break;
            }
            case "no-lock": {
              enum4 = 21;
              break;
            }
            case "insufficient-memory": {
              enum4 = 22;
              break;
            }
            case "insufficient-space": {
              enum4 = 23;
              break;
            }
            case "not-directory": {
              enum4 = 24;
              break;
            }
            case "not-empty": {
              enum4 = 25;
              break;
            }
            case "not-recoverable": {
              enum4 = 26;
              break;
            }
            case "unsupported": {
              enum4 = 27;
              break;
            }
            case "no-tty": {
              enum4 = 28;
              break;
            }
            case "no-such-device": {
              enum4 = 29;
              break;
            }
            case "overflow": {
              enum4 = 30;
              break;
            }
            case "not-permitted": {
              enum4 = 31;
              break;
            }
            case "pipe": {
              enum4 = 32;
              break;
            }
            case "read-only": {
              enum4 = 33;
              break;
            }
            case "invalid-seek": {
              enum4 = 34;
              break;
            }
            case "text-file-busy": {
              enum4 = 35;
              break;
            }
            case "cross-device": {
              enum4 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val4}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg1 + 1, enum4, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.get-type"][Instruction::Return]', {
        funcName: "[method]descriptor.get-type",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline21.fnName = "wasi:filesystem/types@0.2.3#getType";
    const _trampoline22 = function(arg0, arg1) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.metadata-hash"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "metadataHash",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.metadataHash()
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant5 = ret;
      switch (variant5.tag) {
        case "ok": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 0, true);
          var { lower: v3_0, upper: v3_1 } = e;
          dataView(memory0).setBigInt64(arg1 + 8, toUint64(v3_0), true);
          dataView(memory0).setBigInt64(arg1 + 16, toUint64(v3_1), true);
          break;
        }
        case "err": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 1, true);
          var val4 = e;
          let enum4;
          switch (val4) {
            case "access": {
              enum4 = 0;
              break;
            }
            case "would-block": {
              enum4 = 1;
              break;
            }
            case "already": {
              enum4 = 2;
              break;
            }
            case "bad-descriptor": {
              enum4 = 3;
              break;
            }
            case "busy": {
              enum4 = 4;
              break;
            }
            case "deadlock": {
              enum4 = 5;
              break;
            }
            case "quota": {
              enum4 = 6;
              break;
            }
            case "exist": {
              enum4 = 7;
              break;
            }
            case "file-too-large": {
              enum4 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum4 = 9;
              break;
            }
            case "in-progress": {
              enum4 = 10;
              break;
            }
            case "interrupted": {
              enum4 = 11;
              break;
            }
            case "invalid": {
              enum4 = 12;
              break;
            }
            case "io": {
              enum4 = 13;
              break;
            }
            case "is-directory": {
              enum4 = 14;
              break;
            }
            case "loop": {
              enum4 = 15;
              break;
            }
            case "too-many-links": {
              enum4 = 16;
              break;
            }
            case "message-size": {
              enum4 = 17;
              break;
            }
            case "name-too-long": {
              enum4 = 18;
              break;
            }
            case "no-device": {
              enum4 = 19;
              break;
            }
            case "no-entry": {
              enum4 = 20;
              break;
            }
            case "no-lock": {
              enum4 = 21;
              break;
            }
            case "insufficient-memory": {
              enum4 = 22;
              break;
            }
            case "insufficient-space": {
              enum4 = 23;
              break;
            }
            case "not-directory": {
              enum4 = 24;
              break;
            }
            case "not-empty": {
              enum4 = 25;
              break;
            }
            case "not-recoverable": {
              enum4 = 26;
              break;
            }
            case "unsupported": {
              enum4 = 27;
              break;
            }
            case "no-tty": {
              enum4 = 28;
              break;
            }
            case "no-such-device": {
              enum4 = 29;
              break;
            }
            case "overflow": {
              enum4 = 30;
              break;
            }
            case "not-permitted": {
              enum4 = 31;
              break;
            }
            case "pipe": {
              enum4 = 32;
              break;
            }
            case "read-only": {
              enum4 = 33;
              break;
            }
            case "invalid-seek": {
              enum4 = 34;
              break;
            }
            case "text-file-busy": {
              enum4 = 35;
              break;
            }
            case "cross-device": {
              enum4 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val4}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg1 + 8, enum4, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.metadata-hash"][Instruction::Return]', {
        funcName: "[method]descriptor.metadata-hash",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline22.fnName = "wasi:filesystem/types@0.2.3#metadataHash";
    const handleTable0 = [T_FLAG, 0];
    const captureTable0 = /* @__PURE__ */ new Map();
    let captureCnt0 = 0;
    handleTables[0] = handleTable0;
    const _trampoline23 = function(arg0, arg1) {
      var handle1 = arg0;
      var rep2 = handleTable0[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable0.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Error$1.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="filesystem-error-code"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "filesystemErrorCode",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => filesystemErrorCode(rsc0)
      });
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant4 = ret;
      if (variant4 === null || variant4 === void 0) {
        dataView(memory0).setInt8(arg1 + 0, 0, true);
      } else {
        const e = variant4;
        dataView(memory0).setInt8(arg1 + 0, 1, true);
        var val3 = e;
        let enum3;
        switch (val3) {
          case "access": {
            enum3 = 0;
            break;
          }
          case "would-block": {
            enum3 = 1;
            break;
          }
          case "already": {
            enum3 = 2;
            break;
          }
          case "bad-descriptor": {
            enum3 = 3;
            break;
          }
          case "busy": {
            enum3 = 4;
            break;
          }
          case "deadlock": {
            enum3 = 5;
            break;
          }
          case "quota": {
            enum3 = 6;
            break;
          }
          case "exist": {
            enum3 = 7;
            break;
          }
          case "file-too-large": {
            enum3 = 8;
            break;
          }
          case "illegal-byte-sequence": {
            enum3 = 9;
            break;
          }
          case "in-progress": {
            enum3 = 10;
            break;
          }
          case "interrupted": {
            enum3 = 11;
            break;
          }
          case "invalid": {
            enum3 = 12;
            break;
          }
          case "io": {
            enum3 = 13;
            break;
          }
          case "is-directory": {
            enum3 = 14;
            break;
          }
          case "loop": {
            enum3 = 15;
            break;
          }
          case "too-many-links": {
            enum3 = 16;
            break;
          }
          case "message-size": {
            enum3 = 17;
            break;
          }
          case "name-too-long": {
            enum3 = 18;
            break;
          }
          case "no-device": {
            enum3 = 19;
            break;
          }
          case "no-entry": {
            enum3 = 20;
            break;
          }
          case "no-lock": {
            enum3 = 21;
            break;
          }
          case "insufficient-memory": {
            enum3 = 22;
            break;
          }
          case "insufficient-space": {
            enum3 = 23;
            break;
          }
          case "not-directory": {
            enum3 = 24;
            break;
          }
          case "not-empty": {
            enum3 = 25;
            break;
          }
          case "not-recoverable": {
            enum3 = 26;
            break;
          }
          case "unsupported": {
            enum3 = 27;
            break;
          }
          case "no-tty": {
            enum3 = 28;
            break;
          }
          case "no-such-device": {
            enum3 = 29;
            break;
          }
          case "overflow": {
            enum3 = 30;
            break;
          }
          case "not-permitted": {
            enum3 = 31;
            break;
          }
          case "pipe": {
            enum3 = 32;
            break;
          }
          case "read-only": {
            enum3 = 33;
            break;
          }
          case "invalid-seek": {
            enum3 = 34;
            break;
          }
          case "text-file-busy": {
            enum3 = 35;
            break;
          }
          case "cross-device": {
            enum3 = 36;
            break;
          }
          default: {
            if (e instanceof Error) {
              console.error(e);
            }
            throw new TypeError(`"${val3}" is not one of the cases of error-code`);
          }
        }
        dataView(memory0).setInt8(arg1 + 1, enum3, true);
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="filesystem-error-code"][Instruction::Return]', {
        funcName: "filesystem-error-code",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline23.fnName = "wasi:filesystem/types@0.2.3#filesystemErrorCode";
    const _trampoline24 = function(arg0, arg1, arg2, arg3, arg4) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      if ((arg1 & 4294967294) !== 0) {
        throw new TypeError("flags have extraneous bits set");
      }
      var flags3 = {
        symlinkFollow: Boolean(arg1 & 1)
      };
      var ptr4 = arg2;
      var len4 = arg3;
      var result4 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr4, len4));
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.metadata-hash-at"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "metadataHashAt",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.metadataHashAt(flags3, result4)
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant7 = ret;
      switch (variant7.tag) {
        case "ok": {
          const e = variant7.val;
          dataView(memory0).setInt8(arg4 + 0, 0, true);
          var { lower: v5_0, upper: v5_1 } = e;
          dataView(memory0).setBigInt64(arg4 + 8, toUint64(v5_0), true);
          dataView(memory0).setBigInt64(arg4 + 16, toUint64(v5_1), true);
          break;
        }
        case "err": {
          const e = variant7.val;
          dataView(memory0).setInt8(arg4 + 0, 1, true);
          var val6 = e;
          let enum6;
          switch (val6) {
            case "access": {
              enum6 = 0;
              break;
            }
            case "would-block": {
              enum6 = 1;
              break;
            }
            case "already": {
              enum6 = 2;
              break;
            }
            case "bad-descriptor": {
              enum6 = 3;
              break;
            }
            case "busy": {
              enum6 = 4;
              break;
            }
            case "deadlock": {
              enum6 = 5;
              break;
            }
            case "quota": {
              enum6 = 6;
              break;
            }
            case "exist": {
              enum6 = 7;
              break;
            }
            case "file-too-large": {
              enum6 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum6 = 9;
              break;
            }
            case "in-progress": {
              enum6 = 10;
              break;
            }
            case "interrupted": {
              enum6 = 11;
              break;
            }
            case "invalid": {
              enum6 = 12;
              break;
            }
            case "io": {
              enum6 = 13;
              break;
            }
            case "is-directory": {
              enum6 = 14;
              break;
            }
            case "loop": {
              enum6 = 15;
              break;
            }
            case "too-many-links": {
              enum6 = 16;
              break;
            }
            case "message-size": {
              enum6 = 17;
              break;
            }
            case "name-too-long": {
              enum6 = 18;
              break;
            }
            case "no-device": {
              enum6 = 19;
              break;
            }
            case "no-entry": {
              enum6 = 20;
              break;
            }
            case "no-lock": {
              enum6 = 21;
              break;
            }
            case "insufficient-memory": {
              enum6 = 22;
              break;
            }
            case "insufficient-space": {
              enum6 = 23;
              break;
            }
            case "not-directory": {
              enum6 = 24;
              break;
            }
            case "not-empty": {
              enum6 = 25;
              break;
            }
            case "not-recoverable": {
              enum6 = 26;
              break;
            }
            case "unsupported": {
              enum6 = 27;
              break;
            }
            case "no-tty": {
              enum6 = 28;
              break;
            }
            case "no-such-device": {
              enum6 = 29;
              break;
            }
            case "overflow": {
              enum6 = 30;
              break;
            }
            case "not-permitted": {
              enum6 = 31;
              break;
            }
            case "pipe": {
              enum6 = 32;
              break;
            }
            case "read-only": {
              enum6 = 33;
              break;
            }
            case "invalid-seek": {
              enum6 = 34;
              break;
            }
            case "text-file-busy": {
              enum6 = 35;
              break;
            }
            case "cross-device": {
              enum6 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val6}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg4 + 8, enum6, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant7, valueType: typeof variant7 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.metadata-hash-at"][Instruction::Return]', {
        funcName: "[method]descriptor.metadata-hash-at",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline24.fnName = "wasi:filesystem/types@0.2.3#metadataHashAt";
    const _trampoline25 = function(arg0, arg1, arg2, arg3) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      var ptr3 = arg1;
      var len3 = arg2;
      var result3 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr3, len3));
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.create-directory-at"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "createDirectoryAt",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.createDirectoryAt(result3)
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant5 = ret;
      switch (variant5.tag) {
        case "ok": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg3 + 0, 0, true);
          break;
        }
        case "err": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg3 + 0, 1, true);
          var val4 = e;
          let enum4;
          switch (val4) {
            case "access": {
              enum4 = 0;
              break;
            }
            case "would-block": {
              enum4 = 1;
              break;
            }
            case "already": {
              enum4 = 2;
              break;
            }
            case "bad-descriptor": {
              enum4 = 3;
              break;
            }
            case "busy": {
              enum4 = 4;
              break;
            }
            case "deadlock": {
              enum4 = 5;
              break;
            }
            case "quota": {
              enum4 = 6;
              break;
            }
            case "exist": {
              enum4 = 7;
              break;
            }
            case "file-too-large": {
              enum4 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum4 = 9;
              break;
            }
            case "in-progress": {
              enum4 = 10;
              break;
            }
            case "interrupted": {
              enum4 = 11;
              break;
            }
            case "invalid": {
              enum4 = 12;
              break;
            }
            case "io": {
              enum4 = 13;
              break;
            }
            case "is-directory": {
              enum4 = 14;
              break;
            }
            case "loop": {
              enum4 = 15;
              break;
            }
            case "too-many-links": {
              enum4 = 16;
              break;
            }
            case "message-size": {
              enum4 = 17;
              break;
            }
            case "name-too-long": {
              enum4 = 18;
              break;
            }
            case "no-device": {
              enum4 = 19;
              break;
            }
            case "no-entry": {
              enum4 = 20;
              break;
            }
            case "no-lock": {
              enum4 = 21;
              break;
            }
            case "insufficient-memory": {
              enum4 = 22;
              break;
            }
            case "insufficient-space": {
              enum4 = 23;
              break;
            }
            case "not-directory": {
              enum4 = 24;
              break;
            }
            case "not-empty": {
              enum4 = 25;
              break;
            }
            case "not-recoverable": {
              enum4 = 26;
              break;
            }
            case "unsupported": {
              enum4 = 27;
              break;
            }
            case "no-tty": {
              enum4 = 28;
              break;
            }
            case "no-such-device": {
              enum4 = 29;
              break;
            }
            case "overflow": {
              enum4 = 30;
              break;
            }
            case "not-permitted": {
              enum4 = 31;
              break;
            }
            case "pipe": {
              enum4 = 32;
              break;
            }
            case "read-only": {
              enum4 = 33;
              break;
            }
            case "invalid-seek": {
              enum4 = 34;
              break;
            }
            case "text-file-busy": {
              enum4 = 35;
              break;
            }
            case "cross-device": {
              enum4 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val4}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg3 + 1, enum4, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.create-directory-at"][Instruction::Return]', {
        funcName: "[method]descriptor.create-directory-at",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline25.fnName = "wasi:filesystem/types@0.2.3#createDirectoryAt";
    const _trampoline26 = function(arg0, arg1, arg2, arg3) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      var ptr3 = arg1;
      var len3 = arg2;
      var result3 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr3, len3));
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.readlink-at"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "readlinkAt",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.readlinkAt(result3)
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant6 = ret;
      switch (variant6.tag) {
        case "ok": {
          const e = variant6.val;
          dataView(memory0).setInt8(arg3 + 0, 0, true);
          var encodeRes = _utf8AllocateAndEncode(e, realloc0, memory0);
          var ptr4 = encodeRes.ptr;
          var len4 = encodeRes.len;
          dataView(memory0).setUint32(arg3 + 8, len4, true);
          dataView(memory0).setUint32(arg3 + 4, ptr4, true);
          break;
        }
        case "err": {
          const e = variant6.val;
          dataView(memory0).setInt8(arg3 + 0, 1, true);
          var val5 = e;
          let enum5;
          switch (val5) {
            case "access": {
              enum5 = 0;
              break;
            }
            case "would-block": {
              enum5 = 1;
              break;
            }
            case "already": {
              enum5 = 2;
              break;
            }
            case "bad-descriptor": {
              enum5 = 3;
              break;
            }
            case "busy": {
              enum5 = 4;
              break;
            }
            case "deadlock": {
              enum5 = 5;
              break;
            }
            case "quota": {
              enum5 = 6;
              break;
            }
            case "exist": {
              enum5 = 7;
              break;
            }
            case "file-too-large": {
              enum5 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum5 = 9;
              break;
            }
            case "in-progress": {
              enum5 = 10;
              break;
            }
            case "interrupted": {
              enum5 = 11;
              break;
            }
            case "invalid": {
              enum5 = 12;
              break;
            }
            case "io": {
              enum5 = 13;
              break;
            }
            case "is-directory": {
              enum5 = 14;
              break;
            }
            case "loop": {
              enum5 = 15;
              break;
            }
            case "too-many-links": {
              enum5 = 16;
              break;
            }
            case "message-size": {
              enum5 = 17;
              break;
            }
            case "name-too-long": {
              enum5 = 18;
              break;
            }
            case "no-device": {
              enum5 = 19;
              break;
            }
            case "no-entry": {
              enum5 = 20;
              break;
            }
            case "no-lock": {
              enum5 = 21;
              break;
            }
            case "insufficient-memory": {
              enum5 = 22;
              break;
            }
            case "insufficient-space": {
              enum5 = 23;
              break;
            }
            case "not-directory": {
              enum5 = 24;
              break;
            }
            case "not-empty": {
              enum5 = 25;
              break;
            }
            case "not-recoverable": {
              enum5 = 26;
              break;
            }
            case "unsupported": {
              enum5 = 27;
              break;
            }
            case "no-tty": {
              enum5 = 28;
              break;
            }
            case "no-such-device": {
              enum5 = 29;
              break;
            }
            case "overflow": {
              enum5 = 30;
              break;
            }
            case "not-permitted": {
              enum5 = 31;
              break;
            }
            case "pipe": {
              enum5 = 32;
              break;
            }
            case "read-only": {
              enum5 = 33;
              break;
            }
            case "invalid-seek": {
              enum5 = 34;
              break;
            }
            case "text-file-busy": {
              enum5 = 35;
              break;
            }
            case "cross-device": {
              enum5 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val5}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg3 + 4, enum5, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant6, valueType: typeof variant6 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.readlink-at"][Instruction::Return]', {
        funcName: "[method]descriptor.readlink-at",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline26.fnName = "wasi:filesystem/types@0.2.3#readlinkAt";
    const _trampoline27 = function(arg0, arg1, arg2, arg3) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      var ptr3 = arg1;
      var len3 = arg2;
      var result3 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr3, len3));
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.remove-directory-at"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "removeDirectoryAt",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.removeDirectoryAt(result3)
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant5 = ret;
      switch (variant5.tag) {
        case "ok": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg3 + 0, 0, true);
          break;
        }
        case "err": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg3 + 0, 1, true);
          var val4 = e;
          let enum4;
          switch (val4) {
            case "access": {
              enum4 = 0;
              break;
            }
            case "would-block": {
              enum4 = 1;
              break;
            }
            case "already": {
              enum4 = 2;
              break;
            }
            case "bad-descriptor": {
              enum4 = 3;
              break;
            }
            case "busy": {
              enum4 = 4;
              break;
            }
            case "deadlock": {
              enum4 = 5;
              break;
            }
            case "quota": {
              enum4 = 6;
              break;
            }
            case "exist": {
              enum4 = 7;
              break;
            }
            case "file-too-large": {
              enum4 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum4 = 9;
              break;
            }
            case "in-progress": {
              enum4 = 10;
              break;
            }
            case "interrupted": {
              enum4 = 11;
              break;
            }
            case "invalid": {
              enum4 = 12;
              break;
            }
            case "io": {
              enum4 = 13;
              break;
            }
            case "is-directory": {
              enum4 = 14;
              break;
            }
            case "loop": {
              enum4 = 15;
              break;
            }
            case "too-many-links": {
              enum4 = 16;
              break;
            }
            case "message-size": {
              enum4 = 17;
              break;
            }
            case "name-too-long": {
              enum4 = 18;
              break;
            }
            case "no-device": {
              enum4 = 19;
              break;
            }
            case "no-entry": {
              enum4 = 20;
              break;
            }
            case "no-lock": {
              enum4 = 21;
              break;
            }
            case "insufficient-memory": {
              enum4 = 22;
              break;
            }
            case "insufficient-space": {
              enum4 = 23;
              break;
            }
            case "not-directory": {
              enum4 = 24;
              break;
            }
            case "not-empty": {
              enum4 = 25;
              break;
            }
            case "not-recoverable": {
              enum4 = 26;
              break;
            }
            case "unsupported": {
              enum4 = 27;
              break;
            }
            case "no-tty": {
              enum4 = 28;
              break;
            }
            case "no-such-device": {
              enum4 = 29;
              break;
            }
            case "overflow": {
              enum4 = 30;
              break;
            }
            case "not-permitted": {
              enum4 = 31;
              break;
            }
            case "pipe": {
              enum4 = 32;
              break;
            }
            case "read-only": {
              enum4 = 33;
              break;
            }
            case "invalid-seek": {
              enum4 = 34;
              break;
            }
            case "text-file-busy": {
              enum4 = 35;
              break;
            }
            case "cross-device": {
              enum4 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val4}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg3 + 1, enum4, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.remove-directory-at"][Instruction::Return]', {
        funcName: "[method]descriptor.remove-directory-at",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline27.fnName = "wasi:filesystem/types@0.2.3#removeDirectoryAt";
    const _trampoline28 = function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      var ptr3 = arg1;
      var len3 = arg2;
      var result3 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr3, len3));
      var handle5 = arg3;
      var rep6 = handleTable7[(handle5 << 1) + 1] & ~T_FLAG;
      var rsc4 = captureTable7.get(rep6);
      if (!rsc4) {
        rsc4 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc4, symbolRscHandle, { writable: true, value: handle5 });
        Object.defineProperty(rsc4, symbolRscRep, { writable: true, value: rep6 });
      }
      curResourceBorrows.push(rsc4);
      var ptr7 = arg4;
      var len7 = arg5;
      var result7 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr7, len7));
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.rename-at"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "renameAt",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.renameAt(result3, rsc4, result7)
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant9 = ret;
      switch (variant9.tag) {
        case "ok": {
          const e = variant9.val;
          dataView(memory0).setInt8(arg6 + 0, 0, true);
          break;
        }
        case "err": {
          const e = variant9.val;
          dataView(memory0).setInt8(arg6 + 0, 1, true);
          var val8 = e;
          let enum8;
          switch (val8) {
            case "access": {
              enum8 = 0;
              break;
            }
            case "would-block": {
              enum8 = 1;
              break;
            }
            case "already": {
              enum8 = 2;
              break;
            }
            case "bad-descriptor": {
              enum8 = 3;
              break;
            }
            case "busy": {
              enum8 = 4;
              break;
            }
            case "deadlock": {
              enum8 = 5;
              break;
            }
            case "quota": {
              enum8 = 6;
              break;
            }
            case "exist": {
              enum8 = 7;
              break;
            }
            case "file-too-large": {
              enum8 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum8 = 9;
              break;
            }
            case "in-progress": {
              enum8 = 10;
              break;
            }
            case "interrupted": {
              enum8 = 11;
              break;
            }
            case "invalid": {
              enum8 = 12;
              break;
            }
            case "io": {
              enum8 = 13;
              break;
            }
            case "is-directory": {
              enum8 = 14;
              break;
            }
            case "loop": {
              enum8 = 15;
              break;
            }
            case "too-many-links": {
              enum8 = 16;
              break;
            }
            case "message-size": {
              enum8 = 17;
              break;
            }
            case "name-too-long": {
              enum8 = 18;
              break;
            }
            case "no-device": {
              enum8 = 19;
              break;
            }
            case "no-entry": {
              enum8 = 20;
              break;
            }
            case "no-lock": {
              enum8 = 21;
              break;
            }
            case "insufficient-memory": {
              enum8 = 22;
              break;
            }
            case "insufficient-space": {
              enum8 = 23;
              break;
            }
            case "not-directory": {
              enum8 = 24;
              break;
            }
            case "not-empty": {
              enum8 = 25;
              break;
            }
            case "not-recoverable": {
              enum8 = 26;
              break;
            }
            case "unsupported": {
              enum8 = 27;
              break;
            }
            case "no-tty": {
              enum8 = 28;
              break;
            }
            case "no-such-device": {
              enum8 = 29;
              break;
            }
            case "overflow": {
              enum8 = 30;
              break;
            }
            case "not-permitted": {
              enum8 = 31;
              break;
            }
            case "pipe": {
              enum8 = 32;
              break;
            }
            case "read-only": {
              enum8 = 33;
              break;
            }
            case "invalid-seek": {
              enum8 = 34;
              break;
            }
            case "text-file-busy": {
              enum8 = 35;
              break;
            }
            case "cross-device": {
              enum8 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val8}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg6 + 1, enum8, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant9, valueType: typeof variant9 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.rename-at"][Instruction::Return]', {
        funcName: "[method]descriptor.rename-at",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline28.fnName = "wasi:filesystem/types@0.2.3#renameAt";
    const _trampoline29 = function(arg0, arg1, arg2, arg3) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      var ptr3 = arg1;
      var len3 = arg2;
      var result3 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr3, len3));
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.unlink-file-at"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "unlinkFileAt",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.unlinkFileAt(result3)
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant5 = ret;
      switch (variant5.tag) {
        case "ok": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg3 + 0, 0, true);
          break;
        }
        case "err": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg3 + 0, 1, true);
          var val4 = e;
          let enum4;
          switch (val4) {
            case "access": {
              enum4 = 0;
              break;
            }
            case "would-block": {
              enum4 = 1;
              break;
            }
            case "already": {
              enum4 = 2;
              break;
            }
            case "bad-descriptor": {
              enum4 = 3;
              break;
            }
            case "busy": {
              enum4 = 4;
              break;
            }
            case "deadlock": {
              enum4 = 5;
              break;
            }
            case "quota": {
              enum4 = 6;
              break;
            }
            case "exist": {
              enum4 = 7;
              break;
            }
            case "file-too-large": {
              enum4 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum4 = 9;
              break;
            }
            case "in-progress": {
              enum4 = 10;
              break;
            }
            case "interrupted": {
              enum4 = 11;
              break;
            }
            case "invalid": {
              enum4 = 12;
              break;
            }
            case "io": {
              enum4 = 13;
              break;
            }
            case "is-directory": {
              enum4 = 14;
              break;
            }
            case "loop": {
              enum4 = 15;
              break;
            }
            case "too-many-links": {
              enum4 = 16;
              break;
            }
            case "message-size": {
              enum4 = 17;
              break;
            }
            case "name-too-long": {
              enum4 = 18;
              break;
            }
            case "no-device": {
              enum4 = 19;
              break;
            }
            case "no-entry": {
              enum4 = 20;
              break;
            }
            case "no-lock": {
              enum4 = 21;
              break;
            }
            case "insufficient-memory": {
              enum4 = 22;
              break;
            }
            case "insufficient-space": {
              enum4 = 23;
              break;
            }
            case "not-directory": {
              enum4 = 24;
              break;
            }
            case "not-empty": {
              enum4 = 25;
              break;
            }
            case "not-recoverable": {
              enum4 = 26;
              break;
            }
            case "unsupported": {
              enum4 = 27;
              break;
            }
            case "no-tty": {
              enum4 = 28;
              break;
            }
            case "no-such-device": {
              enum4 = 29;
              break;
            }
            case "overflow": {
              enum4 = 30;
              break;
            }
            case "not-permitted": {
              enum4 = 31;
              break;
            }
            case "pipe": {
              enum4 = 32;
              break;
            }
            case "read-only": {
              enum4 = 33;
              break;
            }
            case "invalid-seek": {
              enum4 = 34;
              break;
            }
            case "text-file-busy": {
              enum4 = 35;
              break;
            }
            case "cross-device": {
              enum4 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val4}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg3 + 1, enum4, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.unlink-file-at"][Instruction::Return]', {
        funcName: "[method]descriptor.unlink-file-at",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline29.fnName = "wasi:filesystem/types@0.2.3#unlinkFileAt";
    const _trampoline30 = function(arg0, arg1, arg2) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.read-via-stream"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "readViaStream",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.readViaStream(BigInt.asUintN(64, BigInt(arg1)))
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant5 = ret;
      switch (variant5.tag) {
        case "ok": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg2 + 0, 0, true);
          if (!(e instanceof InputStream2)) {
            throw new TypeError('Resource error: Not a valid "InputStream" resource.');
          }
          var handle3 = e[symbolRscHandle];
          if (!handle3) {
            const rep3 = e[symbolRscRep] || ++captureCnt2;
            captureTable2.set(rep3, e);
            handle3 = rscTableCreateOwn(handleTable2, rep3);
          }
          dataView(memory0).setInt32(arg2 + 4, handle3, true);
          break;
        }
        case "err": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg2 + 0, 1, true);
          var val4 = e;
          let enum4;
          switch (val4) {
            case "access": {
              enum4 = 0;
              break;
            }
            case "would-block": {
              enum4 = 1;
              break;
            }
            case "already": {
              enum4 = 2;
              break;
            }
            case "bad-descriptor": {
              enum4 = 3;
              break;
            }
            case "busy": {
              enum4 = 4;
              break;
            }
            case "deadlock": {
              enum4 = 5;
              break;
            }
            case "quota": {
              enum4 = 6;
              break;
            }
            case "exist": {
              enum4 = 7;
              break;
            }
            case "file-too-large": {
              enum4 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum4 = 9;
              break;
            }
            case "in-progress": {
              enum4 = 10;
              break;
            }
            case "interrupted": {
              enum4 = 11;
              break;
            }
            case "invalid": {
              enum4 = 12;
              break;
            }
            case "io": {
              enum4 = 13;
              break;
            }
            case "is-directory": {
              enum4 = 14;
              break;
            }
            case "loop": {
              enum4 = 15;
              break;
            }
            case "too-many-links": {
              enum4 = 16;
              break;
            }
            case "message-size": {
              enum4 = 17;
              break;
            }
            case "name-too-long": {
              enum4 = 18;
              break;
            }
            case "no-device": {
              enum4 = 19;
              break;
            }
            case "no-entry": {
              enum4 = 20;
              break;
            }
            case "no-lock": {
              enum4 = 21;
              break;
            }
            case "insufficient-memory": {
              enum4 = 22;
              break;
            }
            case "insufficient-space": {
              enum4 = 23;
              break;
            }
            case "not-directory": {
              enum4 = 24;
              break;
            }
            case "not-empty": {
              enum4 = 25;
              break;
            }
            case "not-recoverable": {
              enum4 = 26;
              break;
            }
            case "unsupported": {
              enum4 = 27;
              break;
            }
            case "no-tty": {
              enum4 = 28;
              break;
            }
            case "no-such-device": {
              enum4 = 29;
              break;
            }
            case "overflow": {
              enum4 = 30;
              break;
            }
            case "not-permitted": {
              enum4 = 31;
              break;
            }
            case "pipe": {
              enum4 = 32;
              break;
            }
            case "read-only": {
              enum4 = 33;
              break;
            }
            case "invalid-seek": {
              enum4 = 34;
              break;
            }
            case "text-file-busy": {
              enum4 = 35;
              break;
            }
            case "cross-device": {
              enum4 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val4}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg2 + 4, enum4, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.read-via-stream"][Instruction::Return]', {
        funcName: "[method]descriptor.read-via-stream",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline30.fnName = "wasi:filesystem/types@0.2.3#readViaStream";
    const _trampoline31 = function(arg0, arg1, arg2) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.write-via-stream"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "writeViaStream",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.writeViaStream(BigInt.asUintN(64, BigInt(arg1)))
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant5 = ret;
      switch (variant5.tag) {
        case "ok": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg2 + 0, 0, true);
          if (!(e instanceof OutputStream2)) {
            throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
          }
          var handle3 = e[symbolRscHandle];
          if (!handle3) {
            const rep3 = e[symbolRscRep] || ++captureCnt3;
            captureTable3.set(rep3, e);
            handle3 = rscTableCreateOwn(handleTable3, rep3);
          }
          dataView(memory0).setInt32(arg2 + 4, handle3, true);
          break;
        }
        case "err": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg2 + 0, 1, true);
          var val4 = e;
          let enum4;
          switch (val4) {
            case "access": {
              enum4 = 0;
              break;
            }
            case "would-block": {
              enum4 = 1;
              break;
            }
            case "already": {
              enum4 = 2;
              break;
            }
            case "bad-descriptor": {
              enum4 = 3;
              break;
            }
            case "busy": {
              enum4 = 4;
              break;
            }
            case "deadlock": {
              enum4 = 5;
              break;
            }
            case "quota": {
              enum4 = 6;
              break;
            }
            case "exist": {
              enum4 = 7;
              break;
            }
            case "file-too-large": {
              enum4 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum4 = 9;
              break;
            }
            case "in-progress": {
              enum4 = 10;
              break;
            }
            case "interrupted": {
              enum4 = 11;
              break;
            }
            case "invalid": {
              enum4 = 12;
              break;
            }
            case "io": {
              enum4 = 13;
              break;
            }
            case "is-directory": {
              enum4 = 14;
              break;
            }
            case "loop": {
              enum4 = 15;
              break;
            }
            case "too-many-links": {
              enum4 = 16;
              break;
            }
            case "message-size": {
              enum4 = 17;
              break;
            }
            case "name-too-long": {
              enum4 = 18;
              break;
            }
            case "no-device": {
              enum4 = 19;
              break;
            }
            case "no-entry": {
              enum4 = 20;
              break;
            }
            case "no-lock": {
              enum4 = 21;
              break;
            }
            case "insufficient-memory": {
              enum4 = 22;
              break;
            }
            case "insufficient-space": {
              enum4 = 23;
              break;
            }
            case "not-directory": {
              enum4 = 24;
              break;
            }
            case "not-empty": {
              enum4 = 25;
              break;
            }
            case "not-recoverable": {
              enum4 = 26;
              break;
            }
            case "unsupported": {
              enum4 = 27;
              break;
            }
            case "no-tty": {
              enum4 = 28;
              break;
            }
            case "no-such-device": {
              enum4 = 29;
              break;
            }
            case "overflow": {
              enum4 = 30;
              break;
            }
            case "not-permitted": {
              enum4 = 31;
              break;
            }
            case "pipe": {
              enum4 = 32;
              break;
            }
            case "read-only": {
              enum4 = 33;
              break;
            }
            case "invalid-seek": {
              enum4 = 34;
              break;
            }
            case "text-file-busy": {
              enum4 = 35;
              break;
            }
            case "cross-device": {
              enum4 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val4}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg2 + 4, enum4, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.write-via-stream"][Instruction::Return]', {
        funcName: "[method]descriptor.write-via-stream",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline31.fnName = "wasi:filesystem/types@0.2.3#writeViaStream";
    const _trampoline32 = function(arg0, arg1) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.append-via-stream"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "appendViaStream",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.appendViaStream()
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant5 = ret;
      switch (variant5.tag) {
        case "ok": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 0, true);
          if (!(e instanceof OutputStream2)) {
            throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
          }
          var handle3 = e[symbolRscHandle];
          if (!handle3) {
            const rep3 = e[symbolRscRep] || ++captureCnt3;
            captureTable3.set(rep3, e);
            handle3 = rscTableCreateOwn(handleTable3, rep3);
          }
          dataView(memory0).setInt32(arg1 + 4, handle3, true);
          break;
        }
        case "err": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 1, true);
          var val4 = e;
          let enum4;
          switch (val4) {
            case "access": {
              enum4 = 0;
              break;
            }
            case "would-block": {
              enum4 = 1;
              break;
            }
            case "already": {
              enum4 = 2;
              break;
            }
            case "bad-descriptor": {
              enum4 = 3;
              break;
            }
            case "busy": {
              enum4 = 4;
              break;
            }
            case "deadlock": {
              enum4 = 5;
              break;
            }
            case "quota": {
              enum4 = 6;
              break;
            }
            case "exist": {
              enum4 = 7;
              break;
            }
            case "file-too-large": {
              enum4 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum4 = 9;
              break;
            }
            case "in-progress": {
              enum4 = 10;
              break;
            }
            case "interrupted": {
              enum4 = 11;
              break;
            }
            case "invalid": {
              enum4 = 12;
              break;
            }
            case "io": {
              enum4 = 13;
              break;
            }
            case "is-directory": {
              enum4 = 14;
              break;
            }
            case "loop": {
              enum4 = 15;
              break;
            }
            case "too-many-links": {
              enum4 = 16;
              break;
            }
            case "message-size": {
              enum4 = 17;
              break;
            }
            case "name-too-long": {
              enum4 = 18;
              break;
            }
            case "no-device": {
              enum4 = 19;
              break;
            }
            case "no-entry": {
              enum4 = 20;
              break;
            }
            case "no-lock": {
              enum4 = 21;
              break;
            }
            case "insufficient-memory": {
              enum4 = 22;
              break;
            }
            case "insufficient-space": {
              enum4 = 23;
              break;
            }
            case "not-directory": {
              enum4 = 24;
              break;
            }
            case "not-empty": {
              enum4 = 25;
              break;
            }
            case "not-recoverable": {
              enum4 = 26;
              break;
            }
            case "unsupported": {
              enum4 = 27;
              break;
            }
            case "no-tty": {
              enum4 = 28;
              break;
            }
            case "no-such-device": {
              enum4 = 29;
              break;
            }
            case "overflow": {
              enum4 = 30;
              break;
            }
            case "not-permitted": {
              enum4 = 31;
              break;
            }
            case "pipe": {
              enum4 = 32;
              break;
            }
            case "read-only": {
              enum4 = 33;
              break;
            }
            case "invalid-seek": {
              enum4 = 34;
              break;
            }
            case "text-file-busy": {
              enum4 = 35;
              break;
            }
            case "cross-device": {
              enum4 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val4}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg1 + 4, enum4, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.append-via-stream"][Instruction::Return]', {
        funcName: "[method]descriptor.append-via-stream",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline32.fnName = "wasi:filesystem/types@0.2.3#appendViaStream";
    const handleTable6 = [T_FLAG, 0];
    const captureTable6 = /* @__PURE__ */ new Map();
    let captureCnt6 = 0;
    handleTables[6] = handleTable6;
    const _trampoline33 = function(arg0, arg1) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.read-directory"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "readDirectory",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.readDirectory()
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant5 = ret;
      switch (variant5.tag) {
        case "ok": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 0, true);
          if (!(e instanceof DirectoryEntryStream2)) {
            throw new TypeError('Resource error: Not a valid "DirectoryEntryStream" resource.');
          }
          var handle3 = e[symbolRscHandle];
          if (!handle3) {
            const rep3 = e[symbolRscRep] || ++captureCnt6;
            captureTable6.set(rep3, e);
            handle3 = rscTableCreateOwn(handleTable6, rep3);
          }
          dataView(memory0).setInt32(arg1 + 4, handle3, true);
          break;
        }
        case "err": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 1, true);
          var val4 = e;
          let enum4;
          switch (val4) {
            case "access": {
              enum4 = 0;
              break;
            }
            case "would-block": {
              enum4 = 1;
              break;
            }
            case "already": {
              enum4 = 2;
              break;
            }
            case "bad-descriptor": {
              enum4 = 3;
              break;
            }
            case "busy": {
              enum4 = 4;
              break;
            }
            case "deadlock": {
              enum4 = 5;
              break;
            }
            case "quota": {
              enum4 = 6;
              break;
            }
            case "exist": {
              enum4 = 7;
              break;
            }
            case "file-too-large": {
              enum4 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum4 = 9;
              break;
            }
            case "in-progress": {
              enum4 = 10;
              break;
            }
            case "interrupted": {
              enum4 = 11;
              break;
            }
            case "invalid": {
              enum4 = 12;
              break;
            }
            case "io": {
              enum4 = 13;
              break;
            }
            case "is-directory": {
              enum4 = 14;
              break;
            }
            case "loop": {
              enum4 = 15;
              break;
            }
            case "too-many-links": {
              enum4 = 16;
              break;
            }
            case "message-size": {
              enum4 = 17;
              break;
            }
            case "name-too-long": {
              enum4 = 18;
              break;
            }
            case "no-device": {
              enum4 = 19;
              break;
            }
            case "no-entry": {
              enum4 = 20;
              break;
            }
            case "no-lock": {
              enum4 = 21;
              break;
            }
            case "insufficient-memory": {
              enum4 = 22;
              break;
            }
            case "insufficient-space": {
              enum4 = 23;
              break;
            }
            case "not-directory": {
              enum4 = 24;
              break;
            }
            case "not-empty": {
              enum4 = 25;
              break;
            }
            case "not-recoverable": {
              enum4 = 26;
              break;
            }
            case "unsupported": {
              enum4 = 27;
              break;
            }
            case "no-tty": {
              enum4 = 28;
              break;
            }
            case "no-such-device": {
              enum4 = 29;
              break;
            }
            case "overflow": {
              enum4 = 30;
              break;
            }
            case "not-permitted": {
              enum4 = 31;
              break;
            }
            case "pipe": {
              enum4 = 32;
              break;
            }
            case "read-only": {
              enum4 = 33;
              break;
            }
            case "invalid-seek": {
              enum4 = 34;
              break;
            }
            case "text-file-busy": {
              enum4 = 35;
              break;
            }
            case "cross-device": {
              enum4 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val4}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg1 + 4, enum4, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.read-directory"][Instruction::Return]', {
        funcName: "[method]descriptor.read-directory",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline33.fnName = "wasi:filesystem/types@0.2.3#readDirectory";
    const _trampoline34 = function(arg0, arg1) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.stat"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "stat",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.stat()
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant12 = ret;
      switch (variant12.tag) {
        case "ok": {
          const e = variant12.val;
          dataView(memory0).setInt8(arg1 + 0, 0, true);
          var { type: v3_0, linkCount: v3_1, size: v3_2, dataAccessTimestamp: v3_3, dataModificationTimestamp: v3_4, statusChangeTimestamp: v3_5 } = e;
          var val4 = v3_0;
          let enum4;
          switch (val4) {
            case "unknown": {
              enum4 = 0;
              break;
            }
            case "block-device": {
              enum4 = 1;
              break;
            }
            case "character-device": {
              enum4 = 2;
              break;
            }
            case "directory": {
              enum4 = 3;
              break;
            }
            case "fifo": {
              enum4 = 4;
              break;
            }
            case "symbolic-link": {
              enum4 = 5;
              break;
            }
            case "regular-file": {
              enum4 = 6;
              break;
            }
            case "socket": {
              enum4 = 7;
              break;
            }
            default: {
              if (v3_0 instanceof Error) {
                console.error(v3_0);
              }
              throw new TypeError(`"${val4}" is not one of the cases of descriptor-type`);
            }
          }
          dataView(memory0).setInt8(arg1 + 8, enum4, true);
          dataView(memory0).setBigInt64(arg1 + 16, toUint64(v3_1), true);
          dataView(memory0).setBigInt64(arg1 + 24, toUint64(v3_2), true);
          var variant6 = v3_3;
          if (variant6 === null || variant6 === void 0) {
            dataView(memory0).setInt8(arg1 + 32, 0, true);
          } else {
            const e2 = variant6;
            dataView(memory0).setInt8(arg1 + 32, 1, true);
            var { seconds: v5_0, nanoseconds: v5_1 } = e2;
            dataView(memory0).setBigInt64(arg1 + 40, toUint64(v5_0), true);
            dataView(memory0).setInt32(arg1 + 48, toUint32(v5_1), true);
          }
          var variant8 = v3_4;
          if (variant8 === null || variant8 === void 0) {
            dataView(memory0).setInt8(arg1 + 56, 0, true);
          } else {
            const e2 = variant8;
            dataView(memory0).setInt8(arg1 + 56, 1, true);
            var { seconds: v7_0, nanoseconds: v7_1 } = e2;
            dataView(memory0).setBigInt64(arg1 + 64, toUint64(v7_0), true);
            dataView(memory0).setInt32(arg1 + 72, toUint32(v7_1), true);
          }
          var variant10 = v3_5;
          if (variant10 === null || variant10 === void 0) {
            dataView(memory0).setInt8(arg1 + 80, 0, true);
          } else {
            const e2 = variant10;
            dataView(memory0).setInt8(arg1 + 80, 1, true);
            var { seconds: v9_0, nanoseconds: v9_1 } = e2;
            dataView(memory0).setBigInt64(arg1 + 88, toUint64(v9_0), true);
            dataView(memory0).setInt32(arg1 + 96, toUint32(v9_1), true);
          }
          break;
        }
        case "err": {
          const e = variant12.val;
          dataView(memory0).setInt8(arg1 + 0, 1, true);
          var val11 = e;
          let enum11;
          switch (val11) {
            case "access": {
              enum11 = 0;
              break;
            }
            case "would-block": {
              enum11 = 1;
              break;
            }
            case "already": {
              enum11 = 2;
              break;
            }
            case "bad-descriptor": {
              enum11 = 3;
              break;
            }
            case "busy": {
              enum11 = 4;
              break;
            }
            case "deadlock": {
              enum11 = 5;
              break;
            }
            case "quota": {
              enum11 = 6;
              break;
            }
            case "exist": {
              enum11 = 7;
              break;
            }
            case "file-too-large": {
              enum11 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum11 = 9;
              break;
            }
            case "in-progress": {
              enum11 = 10;
              break;
            }
            case "interrupted": {
              enum11 = 11;
              break;
            }
            case "invalid": {
              enum11 = 12;
              break;
            }
            case "io": {
              enum11 = 13;
              break;
            }
            case "is-directory": {
              enum11 = 14;
              break;
            }
            case "loop": {
              enum11 = 15;
              break;
            }
            case "too-many-links": {
              enum11 = 16;
              break;
            }
            case "message-size": {
              enum11 = 17;
              break;
            }
            case "name-too-long": {
              enum11 = 18;
              break;
            }
            case "no-device": {
              enum11 = 19;
              break;
            }
            case "no-entry": {
              enum11 = 20;
              break;
            }
            case "no-lock": {
              enum11 = 21;
              break;
            }
            case "insufficient-memory": {
              enum11 = 22;
              break;
            }
            case "insufficient-space": {
              enum11 = 23;
              break;
            }
            case "not-directory": {
              enum11 = 24;
              break;
            }
            case "not-empty": {
              enum11 = 25;
              break;
            }
            case "not-recoverable": {
              enum11 = 26;
              break;
            }
            case "unsupported": {
              enum11 = 27;
              break;
            }
            case "no-tty": {
              enum11 = 28;
              break;
            }
            case "no-such-device": {
              enum11 = 29;
              break;
            }
            case "overflow": {
              enum11 = 30;
              break;
            }
            case "not-permitted": {
              enum11 = 31;
              break;
            }
            case "pipe": {
              enum11 = 32;
              break;
            }
            case "read-only": {
              enum11 = 33;
              break;
            }
            case "invalid-seek": {
              enum11 = 34;
              break;
            }
            case "text-file-busy": {
              enum11 = 35;
              break;
            }
            case "cross-device": {
              enum11 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val11}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg1 + 8, enum11, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant12, valueType: typeof variant12 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.stat"][Instruction::Return]', {
        funcName: "[method]descriptor.stat",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline34.fnName = "wasi:filesystem/types@0.2.3#stat";
    const _trampoline35 = function(arg0, arg1, arg2, arg3, arg4) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      if ((arg1 & 4294967294) !== 0) {
        throw new TypeError("flags have extraneous bits set");
      }
      var flags3 = {
        symlinkFollow: Boolean(arg1 & 1)
      };
      var ptr4 = arg2;
      var len4 = arg3;
      var result4 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr4, len4));
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.stat-at"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "statAt",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.statAt(flags3, result4)
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant14 = ret;
      switch (variant14.tag) {
        case "ok": {
          const e = variant14.val;
          dataView(memory0).setInt8(arg4 + 0, 0, true);
          var { type: v5_0, linkCount: v5_1, size: v5_2, dataAccessTimestamp: v5_3, dataModificationTimestamp: v5_4, statusChangeTimestamp: v5_5 } = e;
          var val6 = v5_0;
          let enum6;
          switch (val6) {
            case "unknown": {
              enum6 = 0;
              break;
            }
            case "block-device": {
              enum6 = 1;
              break;
            }
            case "character-device": {
              enum6 = 2;
              break;
            }
            case "directory": {
              enum6 = 3;
              break;
            }
            case "fifo": {
              enum6 = 4;
              break;
            }
            case "symbolic-link": {
              enum6 = 5;
              break;
            }
            case "regular-file": {
              enum6 = 6;
              break;
            }
            case "socket": {
              enum6 = 7;
              break;
            }
            default: {
              if (v5_0 instanceof Error) {
                console.error(v5_0);
              }
              throw new TypeError(`"${val6}" is not one of the cases of descriptor-type`);
            }
          }
          dataView(memory0).setInt8(arg4 + 8, enum6, true);
          dataView(memory0).setBigInt64(arg4 + 16, toUint64(v5_1), true);
          dataView(memory0).setBigInt64(arg4 + 24, toUint64(v5_2), true);
          var variant8 = v5_3;
          if (variant8 === null || variant8 === void 0) {
            dataView(memory0).setInt8(arg4 + 32, 0, true);
          } else {
            const e2 = variant8;
            dataView(memory0).setInt8(arg4 + 32, 1, true);
            var { seconds: v7_0, nanoseconds: v7_1 } = e2;
            dataView(memory0).setBigInt64(arg4 + 40, toUint64(v7_0), true);
            dataView(memory0).setInt32(arg4 + 48, toUint32(v7_1), true);
          }
          var variant10 = v5_4;
          if (variant10 === null || variant10 === void 0) {
            dataView(memory0).setInt8(arg4 + 56, 0, true);
          } else {
            const e2 = variant10;
            dataView(memory0).setInt8(arg4 + 56, 1, true);
            var { seconds: v9_0, nanoseconds: v9_1 } = e2;
            dataView(memory0).setBigInt64(arg4 + 64, toUint64(v9_0), true);
            dataView(memory0).setInt32(arg4 + 72, toUint32(v9_1), true);
          }
          var variant12 = v5_5;
          if (variant12 === null || variant12 === void 0) {
            dataView(memory0).setInt8(arg4 + 80, 0, true);
          } else {
            const e2 = variant12;
            dataView(memory0).setInt8(arg4 + 80, 1, true);
            var { seconds: v11_0, nanoseconds: v11_1 } = e2;
            dataView(memory0).setBigInt64(arg4 + 88, toUint64(v11_0), true);
            dataView(memory0).setInt32(arg4 + 96, toUint32(v11_1), true);
          }
          break;
        }
        case "err": {
          const e = variant14.val;
          dataView(memory0).setInt8(arg4 + 0, 1, true);
          var val13 = e;
          let enum13;
          switch (val13) {
            case "access": {
              enum13 = 0;
              break;
            }
            case "would-block": {
              enum13 = 1;
              break;
            }
            case "already": {
              enum13 = 2;
              break;
            }
            case "bad-descriptor": {
              enum13 = 3;
              break;
            }
            case "busy": {
              enum13 = 4;
              break;
            }
            case "deadlock": {
              enum13 = 5;
              break;
            }
            case "quota": {
              enum13 = 6;
              break;
            }
            case "exist": {
              enum13 = 7;
              break;
            }
            case "file-too-large": {
              enum13 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum13 = 9;
              break;
            }
            case "in-progress": {
              enum13 = 10;
              break;
            }
            case "interrupted": {
              enum13 = 11;
              break;
            }
            case "invalid": {
              enum13 = 12;
              break;
            }
            case "io": {
              enum13 = 13;
              break;
            }
            case "is-directory": {
              enum13 = 14;
              break;
            }
            case "loop": {
              enum13 = 15;
              break;
            }
            case "too-many-links": {
              enum13 = 16;
              break;
            }
            case "message-size": {
              enum13 = 17;
              break;
            }
            case "name-too-long": {
              enum13 = 18;
              break;
            }
            case "no-device": {
              enum13 = 19;
              break;
            }
            case "no-entry": {
              enum13 = 20;
              break;
            }
            case "no-lock": {
              enum13 = 21;
              break;
            }
            case "insufficient-memory": {
              enum13 = 22;
              break;
            }
            case "insufficient-space": {
              enum13 = 23;
              break;
            }
            case "not-directory": {
              enum13 = 24;
              break;
            }
            case "not-empty": {
              enum13 = 25;
              break;
            }
            case "not-recoverable": {
              enum13 = 26;
              break;
            }
            case "unsupported": {
              enum13 = 27;
              break;
            }
            case "no-tty": {
              enum13 = 28;
              break;
            }
            case "no-such-device": {
              enum13 = 29;
              break;
            }
            case "overflow": {
              enum13 = 30;
              break;
            }
            case "not-permitted": {
              enum13 = 31;
              break;
            }
            case "pipe": {
              enum13 = 32;
              break;
            }
            case "read-only": {
              enum13 = 33;
              break;
            }
            case "invalid-seek": {
              enum13 = 34;
              break;
            }
            case "text-file-busy": {
              enum13 = 35;
              break;
            }
            case "cross-device": {
              enum13 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val13}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg4 + 8, enum13, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant14, valueType: typeof variant14 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.stat-at"][Instruction::Return]', {
        funcName: "[method]descriptor.stat-at",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline35.fnName = "wasi:filesystem/types@0.2.3#statAt";
    const _trampoline36 = function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
      var handle1 = arg0;
      var rep2 = handleTable7[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable7.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(Descriptor2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      if ((arg1 & 4294967294) !== 0) {
        throw new TypeError("flags have extraneous bits set");
      }
      var flags3 = {
        symlinkFollow: Boolean(arg1 & 1)
      };
      var ptr4 = arg2;
      var len4 = arg3;
      var result4 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr4, len4));
      if ((arg4 & 4294967280) !== 0) {
        throw new TypeError("flags have extraneous bits set");
      }
      var flags5 = {
        create: Boolean(arg4 & 1),
        directory: Boolean(arg4 & 2),
        exclusive: Boolean(arg4 & 4),
        truncate: Boolean(arg4 & 8)
      };
      if ((arg5 & 4294967232) !== 0) {
        throw new TypeError("flags have extraneous bits set");
      }
      var flags6 = {
        read: Boolean(arg5 & 1),
        write: Boolean(arg5 & 2),
        fileIntegritySync: Boolean(arg5 & 4),
        dataIntegritySync: Boolean(arg5 & 8),
        requestedWriteSync: Boolean(arg5 & 16),
        mutateDirectory: Boolean(arg5 & 32)
      };
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.open-at"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "openAt",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.openAt(flags3, result4, flags5, flags6)
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant9 = ret;
      switch (variant9.tag) {
        case "ok": {
          const e = variant9.val;
          dataView(memory0).setInt8(arg6 + 0, 0, true);
          if (!(e instanceof Descriptor2)) {
            throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
          }
          var handle7 = e[symbolRscHandle];
          if (!handle7) {
            const rep3 = e[symbolRscRep] || ++captureCnt7;
            captureTable7.set(rep3, e);
            handle7 = rscTableCreateOwn(handleTable7, rep3);
          }
          dataView(memory0).setInt32(arg6 + 4, handle7, true);
          break;
        }
        case "err": {
          const e = variant9.val;
          dataView(memory0).setInt8(arg6 + 0, 1, true);
          var val8 = e;
          let enum8;
          switch (val8) {
            case "access": {
              enum8 = 0;
              break;
            }
            case "would-block": {
              enum8 = 1;
              break;
            }
            case "already": {
              enum8 = 2;
              break;
            }
            case "bad-descriptor": {
              enum8 = 3;
              break;
            }
            case "busy": {
              enum8 = 4;
              break;
            }
            case "deadlock": {
              enum8 = 5;
              break;
            }
            case "quota": {
              enum8 = 6;
              break;
            }
            case "exist": {
              enum8 = 7;
              break;
            }
            case "file-too-large": {
              enum8 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum8 = 9;
              break;
            }
            case "in-progress": {
              enum8 = 10;
              break;
            }
            case "interrupted": {
              enum8 = 11;
              break;
            }
            case "invalid": {
              enum8 = 12;
              break;
            }
            case "io": {
              enum8 = 13;
              break;
            }
            case "is-directory": {
              enum8 = 14;
              break;
            }
            case "loop": {
              enum8 = 15;
              break;
            }
            case "too-many-links": {
              enum8 = 16;
              break;
            }
            case "message-size": {
              enum8 = 17;
              break;
            }
            case "name-too-long": {
              enum8 = 18;
              break;
            }
            case "no-device": {
              enum8 = 19;
              break;
            }
            case "no-entry": {
              enum8 = 20;
              break;
            }
            case "no-lock": {
              enum8 = 21;
              break;
            }
            case "insufficient-memory": {
              enum8 = 22;
              break;
            }
            case "insufficient-space": {
              enum8 = 23;
              break;
            }
            case "not-directory": {
              enum8 = 24;
              break;
            }
            case "not-empty": {
              enum8 = 25;
              break;
            }
            case "not-recoverable": {
              enum8 = 26;
              break;
            }
            case "unsupported": {
              enum8 = 27;
              break;
            }
            case "no-tty": {
              enum8 = 28;
              break;
            }
            case "no-such-device": {
              enum8 = 29;
              break;
            }
            case "overflow": {
              enum8 = 30;
              break;
            }
            case "not-permitted": {
              enum8 = 31;
              break;
            }
            case "pipe": {
              enum8 = 32;
              break;
            }
            case "read-only": {
              enum8 = 33;
              break;
            }
            case "invalid-seek": {
              enum8 = 34;
              break;
            }
            case "text-file-busy": {
              enum8 = 35;
              break;
            }
            case "cross-device": {
              enum8 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val8}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg6 + 4, enum8, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant9, valueType: typeof variant9 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.open-at"][Instruction::Return]', {
        funcName: "[method]descriptor.open-at",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline36.fnName = "wasi:filesystem/types@0.2.3#openAt";
    const _trampoline37 = function(arg0, arg1) {
      var handle1 = arg0;
      var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable6.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(DirectoryEntryStream2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]directory-entry-stream.read-directory-entry"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "readDirectoryEntry",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.readDirectoryEntry()
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant8 = ret;
      switch (variant8.tag) {
        case "ok": {
          const e = variant8.val;
          dataView(memory0).setInt8(arg1 + 0, 0, true);
          var variant6 = e;
          if (variant6 === null || variant6 === void 0) {
            dataView(memory0).setInt8(arg1 + 4, 0, true);
          } else {
            const e2 = variant6;
            dataView(memory0).setInt8(arg1 + 4, 1, true);
            var { type: v3_0, name: v3_1 } = e2;
            var val4 = v3_0;
            let enum4;
            switch (val4) {
              case "unknown": {
                enum4 = 0;
                break;
              }
              case "block-device": {
                enum4 = 1;
                break;
              }
              case "character-device": {
                enum4 = 2;
                break;
              }
              case "directory": {
                enum4 = 3;
                break;
              }
              case "fifo": {
                enum4 = 4;
                break;
              }
              case "symbolic-link": {
                enum4 = 5;
                break;
              }
              case "regular-file": {
                enum4 = 6;
                break;
              }
              case "socket": {
                enum4 = 7;
                break;
              }
              default: {
                if (v3_0 instanceof Error) {
                  console.error(v3_0);
                }
                throw new TypeError(`"${val4}" is not one of the cases of descriptor-type`);
              }
            }
            dataView(memory0).setInt8(arg1 + 8, enum4, true);
            var encodeRes = _utf8AllocateAndEncode(v3_1, realloc0, memory0);
            var ptr5 = encodeRes.ptr;
            var len5 = encodeRes.len;
            dataView(memory0).setUint32(arg1 + 16, len5, true);
            dataView(memory0).setUint32(arg1 + 12, ptr5, true);
          }
          break;
        }
        case "err": {
          const e = variant8.val;
          dataView(memory0).setInt8(arg1 + 0, 1, true);
          var val7 = e;
          let enum7;
          switch (val7) {
            case "access": {
              enum7 = 0;
              break;
            }
            case "would-block": {
              enum7 = 1;
              break;
            }
            case "already": {
              enum7 = 2;
              break;
            }
            case "bad-descriptor": {
              enum7 = 3;
              break;
            }
            case "busy": {
              enum7 = 4;
              break;
            }
            case "deadlock": {
              enum7 = 5;
              break;
            }
            case "quota": {
              enum7 = 6;
              break;
            }
            case "exist": {
              enum7 = 7;
              break;
            }
            case "file-too-large": {
              enum7 = 8;
              break;
            }
            case "illegal-byte-sequence": {
              enum7 = 9;
              break;
            }
            case "in-progress": {
              enum7 = 10;
              break;
            }
            case "interrupted": {
              enum7 = 11;
              break;
            }
            case "invalid": {
              enum7 = 12;
              break;
            }
            case "io": {
              enum7 = 13;
              break;
            }
            case "is-directory": {
              enum7 = 14;
              break;
            }
            case "loop": {
              enum7 = 15;
              break;
            }
            case "too-many-links": {
              enum7 = 16;
              break;
            }
            case "message-size": {
              enum7 = 17;
              break;
            }
            case "name-too-long": {
              enum7 = 18;
              break;
            }
            case "no-device": {
              enum7 = 19;
              break;
            }
            case "no-entry": {
              enum7 = 20;
              break;
            }
            case "no-lock": {
              enum7 = 21;
              break;
            }
            case "insufficient-memory": {
              enum7 = 22;
              break;
            }
            case "insufficient-space": {
              enum7 = 23;
              break;
            }
            case "not-directory": {
              enum7 = 24;
              break;
            }
            case "not-empty": {
              enum7 = 25;
              break;
            }
            case "not-recoverable": {
              enum7 = 26;
              break;
            }
            case "unsupported": {
              enum7 = 27;
              break;
            }
            case "no-tty": {
              enum7 = 28;
              break;
            }
            case "no-such-device": {
              enum7 = 29;
              break;
            }
            case "overflow": {
              enum7 = 30;
              break;
            }
            case "not-permitted": {
              enum7 = 31;
              break;
            }
            case "pipe": {
              enum7 = 32;
              break;
            }
            case "read-only": {
              enum7 = 33;
              break;
            }
            case "invalid-seek": {
              enum7 = 34;
              break;
            }
            case "text-file-busy": {
              enum7 = 35;
              break;
            }
            case "cross-device": {
              enum7 = 36;
              break;
            }
            default: {
              if (e instanceof Error) {
                console.error(e);
              }
              throw new TypeError(`"${val7}" is not one of the cases of error-code`);
            }
          }
          dataView(memory0).setInt8(arg1 + 4, enum7, true);
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant8, valueType: typeof variant8 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]directory-entry-stream.read-directory-entry"][Instruction::Return]', {
        funcName: "[method]directory-entry-stream.read-directory-entry",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline37.fnName = "wasi:filesystem/types@0.2.3#readDirectoryEntry";
    const _trampoline38 = function(arg0, arg1, arg2) {
      var handle1 = arg0;
      var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable2.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(InputStream2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.read"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "read",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.read(BigInt.asUintN(64, BigInt(arg1)))
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant6 = ret;
      switch (variant6.tag) {
        case "ok": {
          const e = variant6.val;
          dataView(memory0).setInt8(arg2 + 0, 0, true);
          var val3 = e;
          var len3 = Array.isArray(val3) ? val3.length : val3.byteLength;
          var ptr3 = realloc0(0, 0, 1, len3 * 1);
          let valData3;
          const valLenBytes3 = len3 * 1;
          if (Array.isArray(val3)) {
            let offset = 0;
            const dv3 = new DataView(memory0.buffer);
            for (const v of val3) {
              _requireValidNumericPrimitive.bind(null, "u8")(v);
              dv3.setUint8(ptr3 + offset, v, true);
              offset += 1;
            }
          } else {
            valData3 = new Uint8Array(val3.buffer || val3, val3.byteOffset, valLenBytes3);
            const out3 = new Uint8Array(memory0.buffer, ptr3, valLenBytes3);
            out3.set(valData3);
          }
          dataView(memory0).setUint32(arg2 + 8, len3, true);
          dataView(memory0).setUint32(arg2 + 4, ptr3, true);
          break;
        }
        case "err": {
          const e = variant6.val;
          dataView(memory0).setInt8(arg2 + 0, 1, true);
          var variant5 = e;
          switch (variant5.tag) {
            case "last-operation-failed": {
              const e2 = variant5.val;
              dataView(memory0).setInt8(arg2 + 4, 0, true);
              if (!(e2 instanceof Error$1)) {
                throw new TypeError('Resource error: Not a valid "Error" resource.');
              }
              var handle4 = e2[symbolRscHandle];
              if (!handle4) {
                const rep3 = e2[symbolRscRep] || ++captureCnt0;
                captureTable0.set(rep3, e2);
                handle4 = rscTableCreateOwn(handleTable0, rep3);
              }
              dataView(memory0).setInt32(arg2 + 8, handle4, true);
              break;
            }
            case "closed": {
              dataView(memory0).setInt8(arg2 + 4, 1, true);
              break;
            }
            default: {
              throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
            }
          }
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant6, valueType: typeof variant6 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.read"][Instruction::Return]', {
        funcName: "[method]input-stream.read",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline38.fnName = "wasi:io/streams@0.2.3#read";
    const _trampoline39 = function(arg0, arg1, arg2) {
      var handle1 = arg0;
      var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable2.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(InputStream2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.blocking-read"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "blockingRead",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.blockingRead(BigInt.asUintN(64, BigInt(arg1)))
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant6 = ret;
      switch (variant6.tag) {
        case "ok": {
          const e = variant6.val;
          dataView(memory0).setInt8(arg2 + 0, 0, true);
          var val3 = e;
          var len3 = Array.isArray(val3) ? val3.length : val3.byteLength;
          var ptr3 = realloc0(0, 0, 1, len3 * 1);
          let valData3;
          const valLenBytes3 = len3 * 1;
          if (Array.isArray(val3)) {
            let offset = 0;
            const dv3 = new DataView(memory0.buffer);
            for (const v of val3) {
              _requireValidNumericPrimitive.bind(null, "u8")(v);
              dv3.setUint8(ptr3 + offset, v, true);
              offset += 1;
            }
          } else {
            valData3 = new Uint8Array(val3.buffer || val3, val3.byteOffset, valLenBytes3);
            const out3 = new Uint8Array(memory0.buffer, ptr3, valLenBytes3);
            out3.set(valData3);
          }
          dataView(memory0).setUint32(arg2 + 8, len3, true);
          dataView(memory0).setUint32(arg2 + 4, ptr3, true);
          break;
        }
        case "err": {
          const e = variant6.val;
          dataView(memory0).setInt8(arg2 + 0, 1, true);
          var variant5 = e;
          switch (variant5.tag) {
            case "last-operation-failed": {
              const e2 = variant5.val;
              dataView(memory0).setInt8(arg2 + 4, 0, true);
              if (!(e2 instanceof Error$1)) {
                throw new TypeError('Resource error: Not a valid "Error" resource.');
              }
              var handle4 = e2[symbolRscHandle];
              if (!handle4) {
                const rep3 = e2[symbolRscRep] || ++captureCnt0;
                captureTable0.set(rep3, e2);
                handle4 = rscTableCreateOwn(handleTable0, rep3);
              }
              dataView(memory0).setInt32(arg2 + 8, handle4, true);
              break;
            }
            case "closed": {
              dataView(memory0).setInt8(arg2 + 4, 1, true);
              break;
            }
            default: {
              throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
            }
          }
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant6, valueType: typeof variant6 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.blocking-read"][Instruction::Return]', {
        funcName: "[method]input-stream.blocking-read",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline39.fnName = "wasi:io/streams@0.2.3#blockingRead";
    const _trampoline40 = function(arg0, arg1) {
      var handle1 = arg0;
      var rep2 = handleTable3[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable3.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(OutputStream2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.check-write"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "checkWrite",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.checkWrite()
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant5 = ret;
      switch (variant5.tag) {
        case "ok": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 0, true);
          dataView(memory0).setBigInt64(arg1 + 8, toUint64(e), true);
          break;
        }
        case "err": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 1, true);
          var variant4 = e;
          switch (variant4.tag) {
            case "last-operation-failed": {
              const e2 = variant4.val;
              dataView(memory0).setInt8(arg1 + 8, 0, true);
              if (!(e2 instanceof Error$1)) {
                throw new TypeError('Resource error: Not a valid "Error" resource.');
              }
              var handle3 = e2[symbolRscHandle];
              if (!handle3) {
                const rep3 = e2[symbolRscRep] || ++captureCnt0;
                captureTable0.set(rep3, e2);
                handle3 = rscTableCreateOwn(handleTable0, rep3);
              }
              dataView(memory0).setInt32(arg1 + 12, handle3, true);
              break;
            }
            case "closed": {
              dataView(memory0).setInt8(arg1 + 8, 1, true);
              break;
            }
            default: {
              throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant4.tag)}\` (received \`${variant4}\`) specified for \`StreamError\``);
            }
          }
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.check-write"][Instruction::Return]', {
        funcName: "[method]output-stream.check-write",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline40.fnName = "wasi:io/streams@0.2.3#checkWrite";
    const _trampoline41 = function(arg0, arg1, arg2, arg3) {
      var handle1 = arg0;
      var rep2 = handleTable3[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable3.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(OutputStream2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      var ptr3 = arg1;
      var len3 = arg2;
      var result3 = new Uint8Array(memory0.buffer.slice(ptr3, ptr3 + len3 * 1));
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.write"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "write",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.write(result3)
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant6 = ret;
      switch (variant6.tag) {
        case "ok": {
          const e = variant6.val;
          dataView(memory0).setInt8(arg3 + 0, 0, true);
          break;
        }
        case "err": {
          const e = variant6.val;
          dataView(memory0).setInt8(arg3 + 0, 1, true);
          var variant5 = e;
          switch (variant5.tag) {
            case "last-operation-failed": {
              const e2 = variant5.val;
              dataView(memory0).setInt8(arg3 + 4, 0, true);
              if (!(e2 instanceof Error$1)) {
                throw new TypeError('Resource error: Not a valid "Error" resource.');
              }
              var handle4 = e2[symbolRscHandle];
              if (!handle4) {
                const rep3 = e2[symbolRscRep] || ++captureCnt0;
                captureTable0.set(rep3, e2);
                handle4 = rscTableCreateOwn(handleTable0, rep3);
              }
              dataView(memory0).setInt32(arg3 + 8, handle4, true);
              break;
            }
            case "closed": {
              dataView(memory0).setInt8(arg3 + 4, 1, true);
              break;
            }
            default: {
              throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
            }
          }
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant6, valueType: typeof variant6 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.write"][Instruction::Return]', {
        funcName: "[method]output-stream.write",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline41.fnName = "wasi:io/streams@0.2.3#write";
    const _trampoline42 = function(arg0, arg1, arg2, arg3) {
      var handle1 = arg0;
      var rep2 = handleTable3[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable3.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(OutputStream2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      var ptr3 = arg1;
      var len3 = arg2;
      var result3 = new Uint8Array(memory0.buffer.slice(ptr3, ptr3 + len3 * 1));
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.blocking-write-and-flush"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "blockingWriteAndFlush",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.blockingWriteAndFlush(result3)
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant6 = ret;
      switch (variant6.tag) {
        case "ok": {
          const e = variant6.val;
          dataView(memory0).setInt8(arg3 + 0, 0, true);
          break;
        }
        case "err": {
          const e = variant6.val;
          dataView(memory0).setInt8(arg3 + 0, 1, true);
          var variant5 = e;
          switch (variant5.tag) {
            case "last-operation-failed": {
              const e2 = variant5.val;
              dataView(memory0).setInt8(arg3 + 4, 0, true);
              if (!(e2 instanceof Error$1)) {
                throw new TypeError('Resource error: Not a valid "Error" resource.');
              }
              var handle4 = e2[symbolRscHandle];
              if (!handle4) {
                const rep3 = e2[symbolRscRep] || ++captureCnt0;
                captureTable0.set(rep3, e2);
                handle4 = rscTableCreateOwn(handleTable0, rep3);
              }
              dataView(memory0).setInt32(arg3 + 8, handle4, true);
              break;
            }
            case "closed": {
              dataView(memory0).setInt8(arg3 + 4, 1, true);
              break;
            }
            default: {
              throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
            }
          }
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant6, valueType: typeof variant6 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.blocking-write-and-flush"][Instruction::Return]', {
        funcName: "[method]output-stream.blocking-write-and-flush",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline42.fnName = "wasi:io/streams@0.2.3#blockingWriteAndFlush";
    const _trampoline43 = function(arg0, arg1) {
      var handle1 = arg0;
      var rep2 = handleTable3[(handle1 << 1) + 1] & ~T_FLAG;
      var rsc0 = captureTable3.get(rep2);
      if (!rsc0) {
        rsc0 = Object.create(OutputStream2.prototype);
        Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
        Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
      }
      curResourceBorrows.push(rsc0);
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.blocking-flush"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "blockingFlush",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "result-catch-handler",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret;
      try {
        ret = {
          tag: "ok",
          val: _withGlobalCurrentTaskMeta({
            componentIdx: task.componentIdx(),
            taskID: task.id(),
            fn: () => rsc0.blockingFlush()
          })
        };
      } catch (e) {
        ret = { tag: "err", val: getErrorPayload(e) };
      }
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var variant5 = ret;
      switch (variant5.tag) {
        case "ok": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 0, true);
          break;
        }
        case "err": {
          const e = variant5.val;
          dataView(memory0).setInt8(arg1 + 0, 1, true);
          var variant4 = e;
          switch (variant4.tag) {
            case "last-operation-failed": {
              const e2 = variant4.val;
              dataView(memory0).setInt8(arg1 + 4, 0, true);
              if (!(e2 instanceof Error$1)) {
                throw new TypeError('Resource error: Not a valid "Error" resource.');
              }
              var handle3 = e2[symbolRscHandle];
              if (!handle3) {
                const rep3 = e2[symbolRscRep] || ++captureCnt0;
                captureTable0.set(rep3, e2);
                handle3 = rscTableCreateOwn(handleTable0, rep3);
              }
              dataView(memory0).setInt32(arg1 + 8, handle3, true);
              break;
            }
            case "closed": {
              dataView(memory0).setInt8(arg1 + 4, 1, true);
              break;
            }
            default: {
              throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant4.tag)}\` (received \`${variant4}\`) specified for \`StreamError\``);
            }
          }
          break;
        }
        default: {
          _debugLog("ERROR: invalid value (expected result as object with 'tag' member)", { value: variant5, valueType: typeof variant5 });
          throw new TypeError("invalid variant specified for result");
        }
      }
      _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.blocking-flush"][Instruction::Return]', {
        funcName: "[method]output-stream.blocking-flush",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline43.fnName = "wasi:io/streams@0.2.3#blockingFlush";
    const _trampoline44 = function(arg0, arg1, arg2) {
      var len3 = arg1;
      var base3 = arg0;
      var result3 = [];
      for (let i = 0; i < len3; i++) {
        const base = base3 + i * 4;
        var handle1 = dataView(memory0).getInt32(base + 0, true);
        var rep2 = handleTable1[(handle1 << 1) + 1] & ~T_FLAG;
        var rsc0 = captureTable1.get(rep2);
        if (!rsc0) {
          rsc0 = Object.create(Pollable2.prototype);
          Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
          Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
        }
        curResourceBorrows.push(rsc0);
        result3.push(rsc0);
      }
      _debugLog('[iface="wasi:io/poll@0.2.3", function="poll"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "poll",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => poll(result3)
      });
      for (const rsc of curResourceBorrows) {
        rsc[symbolRscHandle] = void 0;
      }
      curResourceBorrows = [];
      var val4 = ret;
      var len4 = val4.length;
      var ptr4 = realloc0(0, 0, 4, len4 * 4);
      let valData4;
      const valLenBytes4 = len4 * 4;
      if (Array.isArray(val4)) {
        let offset = 0;
        const dv4 = new DataView(memory0.buffer);
        for (const v of val4) {
          _requireValidNumericPrimitive.bind(null, "u32")(v);
          dv4.setUint32(ptr4 + offset, v, true);
          offset += 4;
        }
      } else {
        valData4 = new Uint8Array(val4.buffer || val4, val4.byteOffset, valLenBytes4);
        const out4 = new Uint8Array(memory0.buffer, ptr4, valLenBytes4);
        out4.set(valData4);
      }
      dataView(memory0).setUint32(arg2 + 4, len4, true);
      dataView(memory0).setUint32(arg2 + 0, ptr4, true);
      _debugLog('[iface="wasi:io/poll@0.2.3", function="poll"][Instruction::Return]', {
        funcName: "poll",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline44.fnName = "wasi:io/poll@0.2.3#poll";
    const _trampoline45 = function(arg0) {
      _debugLog('[iface="wasi:filesystem/preopens@0.2.3", function="get-directories"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "getDirectories",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => getDirectories()
      });
      var vec3 = ret;
      var len3 = vec3.length;
      var result3 = realloc0(0, 0, 4, len3 * 12);
      for (let i = 0; i < vec3.length; i++) {
        const e = vec3[i];
        const base = result3 + i * 12;
        var [tuple0_0, tuple0_1] = e;
        if (!(tuple0_0 instanceof Descriptor2)) {
          throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
        }
        var handle1 = tuple0_0[symbolRscHandle];
        if (!handle1) {
          const rep2 = tuple0_0[symbolRscRep] || ++captureCnt7;
          captureTable7.set(rep2, tuple0_0);
          handle1 = rscTableCreateOwn(handleTable7, rep2);
        }
        dataView(memory0).setInt32(base + 0, handle1, true);
        var encodeRes = _utf8AllocateAndEncode(tuple0_1, realloc0, memory0);
        var ptr2 = encodeRes.ptr;
        var len2 = encodeRes.len;
        dataView(memory0).setUint32(base + 8, len2, true);
        dataView(memory0).setUint32(base + 4, ptr2, true);
      }
      dataView(memory0).setUint32(arg0 + 4, len3, true);
      dataView(memory0).setUint32(arg0 + 0, result3, true);
      _debugLog('[iface="wasi:filesystem/preopens@0.2.3", function="get-directories"][Instruction::Return]', {
        funcName: "get-directories",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline45.fnName = "wasi:filesystem/preopens@0.2.3#getDirectories";
    const handleTable4 = [T_FLAG, 0];
    const captureTable4 = /* @__PURE__ */ new Map();
    let captureCnt4 = 0;
    handleTables[4] = handleTable4;
    const _trampoline46 = function(arg0) {
      _debugLog('[iface="wasi:cli/terminal-stdin@0.2.3", function="get-terminal-stdin"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "getTerminalStdin",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => getTerminalStdin()
      });
      var variant1 = ret;
      if (variant1 === null || variant1 === void 0) {
        dataView(memory0).setInt8(arg0 + 0, 0, true);
      } else {
        const e = variant1;
        dataView(memory0).setInt8(arg0 + 0, 1, true);
        if (!(e instanceof TerminalInput2)) {
          throw new TypeError('Resource error: Not a valid "TerminalInput" resource.');
        }
        var handle0 = e[symbolRscHandle];
        if (!handle0) {
          const rep2 = e[symbolRscRep] || ++captureCnt4;
          captureTable4.set(rep2, e);
          handle0 = rscTableCreateOwn(handleTable4, rep2);
        }
        dataView(memory0).setInt32(arg0 + 4, handle0, true);
      }
      _debugLog('[iface="wasi:cli/terminal-stdin@0.2.3", function="get-terminal-stdin"][Instruction::Return]', {
        funcName: "get-terminal-stdin",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline46.fnName = "wasi:cli/terminal-stdin@0.2.3#getTerminalStdin";
    const handleTable5 = [T_FLAG, 0];
    const captureTable5 = /* @__PURE__ */ new Map();
    let captureCnt5 = 0;
    handleTables[5] = handleTable5;
    const _trampoline47 = function(arg0) {
      _debugLog('[iface="wasi:cli/terminal-stdout@0.2.3", function="get-terminal-stdout"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "getTerminalStdout",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => getTerminalStdout()
      });
      var variant1 = ret;
      if (variant1 === null || variant1 === void 0) {
        dataView(memory0).setInt8(arg0 + 0, 0, true);
      } else {
        const e = variant1;
        dataView(memory0).setInt8(arg0 + 0, 1, true);
        if (!(e instanceof TerminalOutput2)) {
          throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
        }
        var handle0 = e[symbolRscHandle];
        if (!handle0) {
          const rep2 = e[symbolRscRep] || ++captureCnt5;
          captureTable5.set(rep2, e);
          handle0 = rscTableCreateOwn(handleTable5, rep2);
        }
        dataView(memory0).setInt32(arg0 + 4, handle0, true);
      }
      _debugLog('[iface="wasi:cli/terminal-stdout@0.2.3", function="get-terminal-stdout"][Instruction::Return]', {
        funcName: "get-terminal-stdout",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline47.fnName = "wasi:cli/terminal-stdout@0.2.3#getTerminalStdout";
    const _trampoline48 = function(arg0) {
      _debugLog('[iface="wasi:cli/terminal-stderr@0.2.3", function="get-terminal-stderr"] [Instruction::CallInterface] (sync, @ enter)');
      let hostProvided = true;
      let parentTask;
      let task;
      let subtask;
      const createTask = () => {
        const results = createNewCurrentTask({
          componentIdx: -1,
          // 0,
          isAsync: false,
          entryFnName: "getTerminalStderr",
          getCallbackFn: () => null,
          callbackFnName: "null",
          errHandling: "none",
          callingWasmExport: false
        });
        task = results[0];
      };
      taskCreation: {
        parentTask = getCurrentTask(0)?.task;
        if (!parentTask) {
          createTask();
          break taskCreation;
        }
        createTask();
        if (hostProvided) {
          subtask = parentTask.getLatestSubtask();
          if (!subtask) {
            throw new Error(`Missing subtask (in parent task [${parentTask.id()}]) for host import, has the import been lowered? (ensure asyncImports are set properly)`);
          }
          task.setParentSubtask(subtask);
        }
      }
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        componentIdx: task.componentIdx(),
        taskID: task.id(),
        fn: () => getTerminalStderr()
      });
      var variant1 = ret;
      if (variant1 === null || variant1 === void 0) {
        dataView(memory0).setInt8(arg0 + 0, 0, true);
      } else {
        const e = variant1;
        dataView(memory0).setInt8(arg0 + 0, 1, true);
        if (!(e instanceof TerminalOutput2)) {
          throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
        }
        var handle0 = e[symbolRscHandle];
        if (!handle0) {
          const rep2 = e[symbolRscRep] || ++captureCnt5;
          captureTable5.set(rep2, e);
          handle0 = rscTableCreateOwn(handleTable5, rep2);
        }
        dataView(memory0).setInt32(arg0 + 4, handle0, true);
      }
      _debugLog('[iface="wasi:cli/terminal-stderr@0.2.3", function="get-terminal-stderr"][Instruction::Return]', {
        funcName: "get-terminal-stderr",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      task.resolve([ret]);
      task.exit();
    };
    _trampoline48.fnName = "wasi:cli/terminal-stderr@0.2.3#getTerminalStderr";
    let exports3;
    let run023Run;
    function run() {
      _debugLog('[iface="wasi:cli/run@0.2.3", function="run"][Instruction::CallWasm] enter', {
        funcName: "run",
        paramCount: 0,
        async: false,
        postReturn: false
      });
      const hostProvided = false;
      const [task, _wasm_call_currentTaskID] = createNewCurrentTask({
        componentIdx: 0,
        isAsync: false,
        isManualAsync: false,
        entryFnName: "run023Run",
        getCallbackFn: () => null,
        callbackFnName: "null",
        errHandling: "throw-result-err",
        callingWasmExport: true
      });
      const started = task.enterSync();
      let ret = _withGlobalCurrentTaskMeta({
        taskID: task.id(),
        componentIdx: task.componentIdx(),
        fn: () => run023Run()
      });
      let variant0;
      switch (ret) {
        case 0: {
          variant0 = {
            tag: "ok",
            val: void 0
          };
          break;
        }
        case 1: {
          variant0 = {
            tag: "err",
            val: void 0
          };
          break;
        }
        default: {
          throw new TypeError("invalid variant discriminant for expected");
        }
      }
      _debugLog('[iface="wasi:cli/run@0.2.3", function="run"][Instruction::Return]', {
        funcName: "run",
        paramCount: 1,
        async: false,
        postReturn: false
      });
      const retCopy = variant0;
      task.resolve([retCopy.val]);
      task.exit();
      if (typeof retCopy === "object" && retCopy.tag === "err") {
        throw new ComponentError(retCopy.val);
      }
      return retCopy.val;
    }
    let trampoline0 = _trampoline0.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 0,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline0.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatU64],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline0
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 0,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline0.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatU64],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline0
      }
    );
    function trampoline1(handle) {
      const handleEntry = rscTableRemove(handleTable6, handle);
      if (handleEntry.own) {
        const rsc = captureTable6.get(handleEntry.rep);
        if (rsc) {
          if (rsc[symbolDispose]) rsc[symbolDispose]();
          captureTable6.delete(handleEntry.rep);
        } else if (DirectoryEntryStream2[symbolCabiDispose]) {
          DirectoryEntryStream2[symbolCabiDispose](handleEntry.rep);
        }
      }
    }
    function trampoline2(handle) {
      const handleEntry = rscTableRemove(handleTable3, handle);
      if (handleEntry.own) {
        const rsc = captureTable3.get(handleEntry.rep);
        if (rsc) {
          if (rsc[symbolDispose]) rsc[symbolDispose]();
          captureTable3.delete(handleEntry.rep);
        } else if (OutputStream2[symbolCabiDispose]) {
          OutputStream2[symbolCabiDispose](handleEntry.rep);
        }
      }
    }
    function trampoline3(handle) {
      const handleEntry = rscTableRemove(handleTable0, handle);
      if (handleEntry.own) {
        const rsc = captureTable0.get(handleEntry.rep);
        if (rsc) {
          if (rsc[symbolDispose]) rsc[symbolDispose]();
          captureTable0.delete(handleEntry.rep);
        } else if (Error$1[symbolCabiDispose]) {
          Error$1[symbolCabiDispose](handleEntry.rep);
        }
      }
    }
    function trampoline4(handle) {
      const handleEntry = rscTableRemove(handleTable2, handle);
      if (handleEntry.own) {
        const rsc = captureTable2.get(handleEntry.rep);
        if (rsc) {
          if (rsc[symbolDispose]) rsc[symbolDispose]();
          captureTable2.delete(handleEntry.rep);
        } else if (InputStream2[symbolCabiDispose]) {
          InputStream2[symbolCabiDispose](handleEntry.rep);
        }
      }
    }
    function trampoline5(handle) {
      const handleEntry = rscTableRemove(handleTable7, handle);
      if (handleEntry.own) {
        const rsc = captureTable7.get(handleEntry.rep);
        if (rsc) {
          if (rsc[symbolDispose]) rsc[symbolDispose]();
          captureTable7.delete(handleEntry.rep);
        } else if (Descriptor2[symbolCabiDispose]) {
          Descriptor2[symbolCabiDispose](handleEntry.rep);
        }
      }
    }
    let trampoline6 = _trampoline6.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 6,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline6.manuallyAsync,
        paramLiftFns: [_liftFlatU64],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline6
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 6,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline6.manuallyAsync,
        paramLiftFns: [_liftFlatU64],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline6
      }
    );
    let trampoline7 = _trampoline7.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 7,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline7.manuallyAsync,
        paramLiftFns: [_liftFlatU64],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline7
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 7,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline7.manuallyAsync,
        paramLiftFns: [_liftFlatU64],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline7
      }
    );
    let trampoline8 = _trampoline8.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 8,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline8.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 3)],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline8
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 8,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline8.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 3)],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline8
      }
    );
    let trampoline9 = _trampoline9.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 9,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline9.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 2)],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline9
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 9,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline9.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 2)],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline9
      }
    );
    function trampoline10(handle) {
      const handleEntry = rscTableRemove(handleTable1, handle);
      if (handleEntry.own) {
        const rsc = captureTable1.get(handleEntry.rep);
        if (rsc) {
          if (rsc[symbolDispose]) rsc[symbolDispose]();
          captureTable1.delete(handleEntry.rep);
        } else if (Pollable2[symbolCabiDispose]) {
          Pollable2[symbolCabiDispose](handleEntry.rep);
        }
      }
    }
    let trampoline11 = _trampoline11.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 11,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline11.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline11
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 11,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline11.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline11
      }
    );
    function trampoline12(handle) {
      const handleEntry = rscTableRemove(handleTable4, handle);
      if (handleEntry.own) {
        const rsc = captureTable4.get(handleEntry.rep);
        if (rsc) {
          if (rsc[symbolDispose]) rsc[symbolDispose]();
          captureTable4.delete(handleEntry.rep);
        } else if (TerminalInput2[symbolCabiDispose]) {
          TerminalInput2[symbolCabiDispose](handleEntry.rep);
        }
      }
    }
    function trampoline13(handle) {
      const handleEntry = rscTableRemove(handleTable5, handle);
      if (handleEntry.own) {
        const rsc = captureTable5.get(handleEntry.rep);
        if (rsc) {
          if (rsc[symbolDispose]) rsc[symbolDispose]();
          captureTable5.delete(handleEntry.rep);
        } else if (TerminalOutput2[symbolCabiDispose]) {
          TerminalOutput2[symbolCabiDispose](handleEntry.rep);
        }
      }
    }
    let trampoline14 = _trampoline14.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 14,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline14.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline14
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 14,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline14.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline14
      }
    );
    let trampoline15 = _trampoline15.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 15,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline15.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline15
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 15,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline15.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatOwn({
          componentIdx: 0,
          lowerFn: () => {
            throw new Error("missing/invalid resource metadata");
          }
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline15
      }
    );
    let trampoline16 = _trampoline16.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 16,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline16.manuallyAsync,
        paramLiftFns: [_liftFlatResult([["ok", null, 0, 0, 0], ["err", null, 0, 0, 0]])],
        resultLowerFns: [],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline16
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 16,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline16.manuallyAsync,
        paramLiftFns: [_liftFlatResult([["ok", null, 0, 0, 0], ["err", null, 0, 0, 0]])],
        resultLowerFns: [],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: null,
        stringEncoding: "utf8",
        getMemoryFn: () => null,
        getReallocFn: () => null,
        importFn: _trampoline16
      }
    );
    let trampoline17 = _trampoline17.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 17,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline17.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatList({
          elemLowerFn: _lowerFlatStringAny,
          elemSize32: 8,
          elemAlign32: 4
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline17
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 17,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline17.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatList({
          elemLowerFn: _lowerFlatStringAny,
          elemSize32: 8,
          elemAlign32: 4
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline17
      }
    );
    let trampoline18 = _trampoline18.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 18,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline18.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatList({
          elemLowerFn: _lowerFlatTuple([[_lowerFlatStringAny, 16, 4], [_lowerFlatStringAny, 16, 4]]),
          elemSize32: 16,
          elemAlign32: 4
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline18
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 18,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline18.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatList({
          elemLowerFn: _lowerFlatTuple([[_lowerFlatStringAny, 16, 4], [_lowerFlatStringAny, 16, 4]]),
          elemSize32: 16,
          elemAlign32: 4
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline18
      }
    );
    let trampoline19 = _trampoline19.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 19,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline19.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]])],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline19
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 19,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline19.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]])],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline19
      }
    );
    let trampoline20 = _trampoline20.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 20,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline20.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatFlags({ names: ["read", "write", "file-integrity-sync", "data-integrity-sync", "requested-write-sync", "mutate-directory"], size32: 1, align32: 1, intSizeBytes: 1 }), 2, 1, 1],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline20
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 20,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline20.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatFlags({ names: ["read", "write", "file-integrity-sync", "data-integrity-sync", "requested-write-sync", "mutate-directory"], size32: 1, align32: 1, intSizeBytes: 1 }), 2, 1, 1],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline20
      }
    );
    let trampoline21 = _trampoline21.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 21,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline21.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatEnum([["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]]), 2, 1, 1],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline21
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 21,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline21.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatEnum([["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]]), 2, 1, 1],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline21
      }
    );
    let trampoline22 = _trampoline22.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 22,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline22.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatRecord([["lower", _lowerFlatU64, 16, 8], ["upper", _lowerFlatU64, 16, 8]]), 24, 8, 8],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 24, 8, 8]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline22
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 22,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline22.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatRecord([["lower", _lowerFlatU64, 16, 8], ["upper", _lowerFlatU64, 16, 8]]), 24, 8, 8],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 24, 8, 8]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline22
      }
    );
    let trampoline23 = _trampoline23.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 23,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline23.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 0)],
        resultLowerFns: [
          _lowerFlatOption([
            ["none", null, 2, 1, 1],
            ["some", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline23
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 23,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline23.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 0)],
        resultLowerFns: [
          _lowerFlatOption([
            ["none", null, 2, 1, 1],
            ["some", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline23
      }
    );
    let trampoline24 = _trampoline24.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 24,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline24.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatFlags({ names: ["symlink-follow"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatRecord([["lower", _lowerFlatU64, 16, 8], ["upper", _lowerFlatU64, 16, 8]]), 24, 8, 8],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 24, 8, 8]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline24
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 24,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline24.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatFlags({ names: ["symlink-follow"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatRecord([["lower", _lowerFlatU64, 16, 8], ["upper", _lowerFlatU64, 16, 8]]), 24, 8, 8],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 24, 8, 8]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline24
      }
    );
    let trampoline25 = _trampoline25.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 25,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline25.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 2, 1, 1],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline25
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 25,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline25.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 2, 1, 1],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline25
      }
    );
    let trampoline26 = _trampoline26.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 26,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline26.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatStringAny, 12, 4, 4],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 12, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline26
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 26,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline26.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatStringAny, 12, 4, 4],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 12, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline26
      }
    );
    let trampoline27 = _trampoline27.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 27,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline27.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 2, 1, 1],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline27
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 27,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline27.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 2, 1, 1],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline27
      }
    );
    let trampoline28 = _trampoline28.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 28,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline28.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatStringAny, _liftFlatBorrow.bind(null, 7), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 2, 1, 1],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline28
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 28,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline28.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatStringAny, _liftFlatBorrow.bind(null, 7), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 2, 1, 1],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline28
      }
    );
    let trampoline29 = _trampoline29.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 29,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline29.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 2, 1, 1],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline29
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 29,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline29.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 2, 1, 1],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 2, 1, 1]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline29
      }
    );
    let trampoline30 = _trampoline30.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 30,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline30.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatU64],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline30
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 30,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline30.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatU64],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline30
      }
    );
    let trampoline31 = _trampoline31.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 31,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline31.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatU64],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline31
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 31,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline31.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatU64],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline31
      }
    );
    let trampoline32 = _trampoline32.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 32,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline32.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline32
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 32,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline32.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline32
      }
    );
    let trampoline33 = _trampoline33.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 33,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline33.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline33
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 33,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline33.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline33
      }
    );
    let trampoline34 = _trampoline34.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 34,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline34.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatRecord([["type", _lowerFlatEnum([["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]]), 96, 8], ["linkCount", _lowerFlatU64, 96, 8], ["size", _lowerFlatU64, 96, 8], [
              "dataAccessTimestamp",
              _lowerFlatOption([
                ["none", null, 24, 8, 8],
                ["some", _lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]]), 24, 8, 8]
              ]),
              96,
              8
            ], [
              "dataModificationTimestamp",
              _lowerFlatOption([
                ["none", null, 24, 8, 8],
                ["some", _lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]]), 24, 8, 8]
              ]),
              96,
              8
            ], [
              "statusChangeTimestamp",
              _lowerFlatOption([
                ["none", null, 24, 8, 8],
                ["some", _lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]]), 24, 8, 8]
              ]),
              96,
              8
            ]]), 104, 8, 8],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 104, 8, 8]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline34
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 34,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline34.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatRecord([["type", _lowerFlatEnum([["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]]), 96, 8], ["linkCount", _lowerFlatU64, 96, 8], ["size", _lowerFlatU64, 96, 8], [
              "dataAccessTimestamp",
              _lowerFlatOption([
                ["none", null, 24, 8, 8],
                ["some", _lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]]), 24, 8, 8]
              ]),
              96,
              8
            ], [
              "dataModificationTimestamp",
              _lowerFlatOption([
                ["none", null, 24, 8, 8],
                ["some", _lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]]), 24, 8, 8]
              ]),
              96,
              8
            ], [
              "statusChangeTimestamp",
              _lowerFlatOption([
                ["none", null, 24, 8, 8],
                ["some", _lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]]), 24, 8, 8]
              ]),
              96,
              8
            ]]), 104, 8, 8],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 104, 8, 8]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline34
      }
    );
    let trampoline35 = _trampoline35.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 35,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline35.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatFlags({ names: ["symlink-follow"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatRecord([["type", _lowerFlatEnum([["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]]), 96, 8], ["linkCount", _lowerFlatU64, 96, 8], ["size", _lowerFlatU64, 96, 8], [
              "dataAccessTimestamp",
              _lowerFlatOption([
                ["none", null, 24, 8, 8],
                ["some", _lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]]), 24, 8, 8]
              ]),
              96,
              8
            ], [
              "dataModificationTimestamp",
              _lowerFlatOption([
                ["none", null, 24, 8, 8],
                ["some", _lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]]), 24, 8, 8]
              ]),
              96,
              8
            ], [
              "statusChangeTimestamp",
              _lowerFlatOption([
                ["none", null, 24, 8, 8],
                ["some", _lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]]), 24, 8, 8]
              ]),
              96,
              8
            ]]), 104, 8, 8],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 104, 8, 8]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline35
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 35,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline35.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatFlags({ names: ["symlink-follow"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatStringAny],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatRecord([["type", _lowerFlatEnum([["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]]), 96, 8], ["linkCount", _lowerFlatU64, 96, 8], ["size", _lowerFlatU64, 96, 8], [
              "dataAccessTimestamp",
              _lowerFlatOption([
                ["none", null, 24, 8, 8],
                ["some", _lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]]), 24, 8, 8]
              ]),
              96,
              8
            ], [
              "dataModificationTimestamp",
              _lowerFlatOption([
                ["none", null, 24, 8, 8],
                ["some", _lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]]), 24, 8, 8]
              ]),
              96,
              8
            ], [
              "statusChangeTimestamp",
              _lowerFlatOption([
                ["none", null, 24, 8, 8],
                ["some", _lowerFlatRecord([["seconds", _lowerFlatU64, 16, 8], ["nanoseconds", _lowerFlatU32, 16, 8]]), 24, 8, 8]
              ]),
              96,
              8
            ]]), 104, 8, 8],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 104, 8, 8]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline35
      }
    );
    let trampoline36 = _trampoline36.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 36,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline36.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatFlags({ names: ["symlink-follow"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatStringAny, _liftFlatFlags({ names: ["create", "directory", "exclusive", "truncate"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatFlags({ names: ["read", "write", "file-integrity-sync", "data-integrity-sync", "requested-write-sync", "mutate-directory"], size32: 1, align32: 1, intSizeBytes: 1 })],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline36
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 36,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline36.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 7), _liftFlatFlags({ names: ["symlink-follow"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatStringAny, _liftFlatFlags({ names: ["create", "directory", "exclusive", "truncate"], size32: 1, align32: 1, intSizeBytes: 1 }), _liftFlatFlags({ names: ["read", "write", "file-integrity-sync", "data-integrity-sync", "requested-write-sync", "mutate-directory"], size32: 1, align32: 1, intSizeBytes: 1 })],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline36
      }
    );
    let trampoline37 = _trampoline37.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 37,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline37.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
        resultLowerFns: [
          _lowerFlatResult([
            [
              "ok",
              _lowerFlatOption([
                ["none", null, 16, 4, 4],
                ["some", _lowerFlatRecord([["type", _lowerFlatEnum([["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]]), 12, 4], ["name", _lowerFlatStringAny, 12, 4]]), 16, 4, 4]
              ]),
              20,
              4,
              4
            ],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 20, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline37
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 37,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline37.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
        resultLowerFns: [
          _lowerFlatResult([
            [
              "ok",
              _lowerFlatOption([
                ["none", null, 16, 4, 4],
                ["some", _lowerFlatRecord([["type", _lowerFlatEnum([["unknown", null, 1, 1, 1], ["block-device", null, 1, 1, 1], ["character-device", null, 1, 1, 1], ["directory", null, 1, 1, 1], ["fifo", null, 1, 1, 1], ["symbolic-link", null, 1, 1, 1], ["regular-file", null, 1, 1, 1], ["socket", null, 1, 1, 1]]), 12, 4], ["name", _lowerFlatStringAny, 12, 4]]), 16, 4, 4]
              ]),
              20,
              4,
              4
            ],
            ["err", _lowerFlatEnum([["access", null, 1, 1, 1], ["would-block", null, 1, 1, 1], ["already", null, 1, 1, 1], ["bad-descriptor", null, 1, 1, 1], ["busy", null, 1, 1, 1], ["deadlock", null, 1, 1, 1], ["quota", null, 1, 1, 1], ["exist", null, 1, 1, 1], ["file-too-large", null, 1, 1, 1], ["illegal-byte-sequence", null, 1, 1, 1], ["in-progress", null, 1, 1, 1], ["interrupted", null, 1, 1, 1], ["invalid", null, 1, 1, 1], ["io", null, 1, 1, 1], ["is-directory", null, 1, 1, 1], ["loop", null, 1, 1, 1], ["too-many-links", null, 1, 1, 1], ["message-size", null, 1, 1, 1], ["name-too-long", null, 1, 1, 1], ["no-device", null, 1, 1, 1], ["no-entry", null, 1, 1, 1], ["no-lock", null, 1, 1, 1], ["insufficient-memory", null, 1, 1, 1], ["insufficient-space", null, 1, 1, 1], ["not-directory", null, 1, 1, 1], ["not-empty", null, 1, 1, 1], ["not-recoverable", null, 1, 1, 1], ["unsupported", null, 1, 1, 1], ["no-tty", null, 1, 1, 1], ["no-such-device", null, 1, 1, 1], ["overflow", null, 1, 1, 1], ["not-permitted", null, 1, 1, 1], ["pipe", null, 1, 1, 1], ["read-only", null, 1, 1, 1], ["invalid-seek", null, 1, 1, 1], ["text-file-busy", null, 1, 1, 1], ["cross-device", null, 1, 1, 1]]), 20, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline37
      }
    );
    let trampoline38 = _trampoline38.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 38,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline38.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 2), _liftFlatU64],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatList({
              elemLowerFn: _lowerFlatU8,
              elemSize32: 1,
              elemAlign32: 1
            }), 12, 4, 4],
            ["err", _lowerFlatVariant([["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4], ["closed", null, 8, 4, 4]]), 12, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline38
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 38,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline38.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 2), _liftFlatU64],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatList({
              elemLowerFn: _lowerFlatU8,
              elemSize32: 1,
              elemAlign32: 1
            }), 12, 4, 4],
            ["err", _lowerFlatVariant([["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4], ["closed", null, 8, 4, 4]]), 12, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline38
      }
    );
    let trampoline39 = _trampoline39.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 39,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline39.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 2), _liftFlatU64],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatList({
              elemLowerFn: _lowerFlatU8,
              elemSize32: 1,
              elemAlign32: 1
            }), 12, 4, 4],
            ["err", _lowerFlatVariant([["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4], ["closed", null, 8, 4, 4]]), 12, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline39
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 39,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline39.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 2), _liftFlatU64],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatList({
              elemLowerFn: _lowerFlatU8,
              elemSize32: 1,
              elemAlign32: 1
            }), 12, 4, 4],
            ["err", _lowerFlatVariant([["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4], ["closed", null, 8, 4, 4]]), 12, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline39
      }
    );
    let trampoline40 = _trampoline40.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 40,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline40.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 3)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatU64, 16, 8, 8],
            ["err", _lowerFlatVariant([["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4], ["closed", null, 8, 4, 4]]), 16, 8, 8]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline40
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 40,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline40.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 3)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", _lowerFlatU64, 16, 8, 8],
            ["err", _lowerFlatVariant([["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4], ["closed", null, 8, 4, 4]]), 16, 8, 8]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline40
      }
    );
    let trampoline41 = _trampoline41.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 41,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline41.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 3), _liftFlatList({
          elemLiftFn: _liftFlatU8,
          elemAlign32: 1,
          elemSize32: 1
        })],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 12, 4, 4],
            ["err", _lowerFlatVariant([["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4], ["closed", null, 8, 4, 4]]), 12, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline41
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 41,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline41.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 3), _liftFlatList({
          elemLiftFn: _liftFlatU8,
          elemAlign32: 1,
          elemSize32: 1
        })],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 12, 4, 4],
            ["err", _lowerFlatVariant([["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4], ["closed", null, 8, 4, 4]]), 12, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline41
      }
    );
    let trampoline42 = _trampoline42.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 42,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline42.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 3), _liftFlatList({
          elemLiftFn: _liftFlatU8,
          elemAlign32: 1,
          elemSize32: 1
        })],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 12, 4, 4],
            ["err", _lowerFlatVariant([["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4], ["closed", null, 8, 4, 4]]), 12, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline42
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 42,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline42.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 3), _liftFlatList({
          elemLiftFn: _liftFlatU8,
          elemAlign32: 1,
          elemSize32: 1
        })],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 12, 4, 4],
            ["err", _lowerFlatVariant([["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4], ["closed", null, 8, 4, 4]]), 12, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline42
      }
    );
    let trampoline43 = _trampoline43.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 43,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline43.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 3)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 12, 4, 4],
            ["err", _lowerFlatVariant([["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4], ["closed", null, 8, 4, 4]]), 12, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline43
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 43,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline43.manuallyAsync,
        paramLiftFns: [_liftFlatBorrow.bind(null, 3)],
        resultLowerFns: [
          _lowerFlatResult([
            ["ok", null, 12, 4, 4],
            ["err", _lowerFlatVariant([["last-operation-failed", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4], ["closed", null, 8, 4, 4]]), 12, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline43
      }
    );
    let trampoline44 = _trampoline44.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 44,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline44.manuallyAsync,
        paramLiftFns: [_liftFlatList({
          elemLiftFn: _liftFlatBorrow.bind(null, 1),
          elemAlign32: 4,
          elemSize32: 4
        })],
        resultLowerFns: [_lowerFlatList({
          elemLowerFn: _lowerFlatU32,
          elemSize32: 4,
          elemAlign32: 4
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline44
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 44,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline44.manuallyAsync,
        paramLiftFns: [_liftFlatList({
          elemLiftFn: _liftFlatBorrow.bind(null, 1),
          elemAlign32: 4,
          elemSize32: 4
        })],
        resultLowerFns: [_lowerFlatList({
          elemLowerFn: _lowerFlatU32,
          elemSize32: 4,
          elemAlign32: 4
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline44
      }
    );
    let trampoline45 = _trampoline45.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 45,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline45.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatList({
          elemLowerFn: _lowerFlatTuple([[_lowerFlatOwn({
            componentIdx: 0,
            lowerFn: () => {
              throw new Error("missing/invalid resource metadata");
            }
          }), 12, 4], [_lowerFlatStringAny, 12, 4]]),
          elemSize32: 12,
          elemAlign32: 4
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline45
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 45,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline45.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [_lowerFlatList({
          elemLowerFn: _lowerFlatTuple([[_lowerFlatOwn({
            componentIdx: 0,
            lowerFn: () => {
              throw new Error("missing/invalid resource metadata");
            }
          }), 12, 4], [_lowerFlatStringAny, 12, 4]]),
          elemSize32: 12,
          elemAlign32: 4
        })],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => realloc0,
        importFn: _trampoline45
      }
    );
    let trampoline46 = _trampoline46.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 46,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline46.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [
          _lowerFlatOption([
            ["none", null, 8, 4, 4],
            ["some", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline46
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 46,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline46.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [
          _lowerFlatOption([
            ["none", null, 8, 4, 4],
            ["some", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline46
      }
    );
    let trampoline47 = _trampoline47.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 47,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline47.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [
          _lowerFlatOption([
            ["none", null, 8, 4, 4],
            ["some", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline47
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 47,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline47.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [
          _lowerFlatOption([
            ["none", null, 8, 4, 4],
            ["some", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline47
      }
    );
    let trampoline48 = _trampoline48.manuallyAsync ? new WebAssembly.Suspending(_lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 48,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline48.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [
          _lowerFlatOption([
            ["none", null, 8, 4, 4],
            ["some", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline48
      }
    )) : _lowerImportBackwardsCompat.bind(
      null,
      {
        trampolineIdx: 48,
        componentIdx: 0,
        isAsync: false,
        isManualAsync: _trampoline48.manuallyAsync,
        paramLiftFns: [],
        resultLowerFns: [
          _lowerFlatOption([
            ["none", null, 8, 4, 4],
            ["some", _lowerFlatOwn({
              componentIdx: 0,
              lowerFn: () => {
                throw new Error("missing/invalid resource metadata");
              }
            }), 8, 4, 4]
          ])
        ],
        funcTypeIsAsync: false,
        getCallbackFn: () => null,
        getPostReturnFn: () => null,
        isCancellable: false,
        memoryIdx: 0,
        stringEncoding: "utf8",
        getMemoryFn: () => memory0,
        getReallocFn: () => null,
        importFn: _trampoline48
      }
    );
    Promise.all([module0, module1, module2, module3]).catch(() => {
    });
    ({ exports: exports0 } = yield instantiateCore(yield module2));
    ({ exports: exports1 } = yield instantiateCore(yield module0, {
      wasi_snapshot_preview1: {
        args_get: exports0["0"],
        args_sizes_get: exports0["1"],
        clock_time_get: exports0["4"],
        environ_get: exports0["2"],
        environ_sizes_get: exports0["3"],
        fd_close: exports0["5"],
        fd_fdstat_get: exports0["6"],
        fd_fdstat_set_flags: exports0["7"],
        fd_filestat_get: exports0["8"],
        fd_prestat_dir_name: exports0["10"],
        fd_prestat_get: exports0["9"],
        fd_read: exports0["11"],
        fd_readdir: exports0["12"],
        fd_renumber: exports0["13"],
        fd_seek: exports0["14"],
        fd_write: exports0["15"],
        path_create_directory: exports0["16"],
        path_filestat_get: exports0["17"],
        path_open: exports0["18"],
        path_readlink: exports0["19"],
        path_remove_directory: exports0["20"],
        path_rename: exports0["21"],
        path_unlink_file: exports0["22"],
        poll_oneoff: exports0["23"],
        proc_exit: exports0["24"],
        sched_yield: exports0["25"]
      }
    }));
    ({ exports: exports2 } = yield instantiateCore(yield module1, {
      __main_module__: {
        _start: exports1._start
      },
      env: {
        memory: exports1.memory
      },
      "wasi:cli/environment@0.2.3": {
        "get-arguments": exports0["26"],
        "get-environment": exports0["27"]
      },
      "wasi:cli/exit@0.2.3": {
        exit: trampoline16
      },
      "wasi:cli/stderr@0.2.3": {
        "get-stderr": trampoline11
      },
      "wasi:cli/stdin@0.2.3": {
        "get-stdin": trampoline14
      },
      "wasi:cli/stdout@0.2.3": {
        "get-stdout": trampoline15
      },
      "wasi:cli/terminal-input@0.2.3": {
        "[resource-drop]terminal-input": trampoline12
      },
      "wasi:cli/terminal-output@0.2.3": {
        "[resource-drop]terminal-output": trampoline13
      },
      "wasi:cli/terminal-stderr@0.2.3": {
        "get-terminal-stderr": exports0["57"]
      },
      "wasi:cli/terminal-stdin@0.2.3": {
        "get-terminal-stdin": exports0["55"]
      },
      "wasi:cli/terminal-stdout@0.2.3": {
        "get-terminal-stdout": exports0["56"]
      },
      "wasi:clocks/monotonic-clock@0.2.3": {
        now: trampoline0,
        "subscribe-duration": trampoline6,
        "subscribe-instant": trampoline7
      },
      "wasi:clocks/wall-clock@0.2.3": {
        now: exports0["28"]
      },
      "wasi:filesystem/preopens@0.2.3": {
        "get-directories": exports0["54"]
      },
      "wasi:filesystem/types@0.2.3": {
        "[method]descriptor.append-via-stream": exports0["41"],
        "[method]descriptor.create-directory-at": exports0["34"],
        "[method]descriptor.get-flags": exports0["29"],
        "[method]descriptor.get-type": exports0["30"],
        "[method]descriptor.metadata-hash": exports0["31"],
        "[method]descriptor.metadata-hash-at": exports0["33"],
        "[method]descriptor.open-at": exports0["45"],
        "[method]descriptor.read-directory": exports0["42"],
        "[method]descriptor.read-via-stream": exports0["39"],
        "[method]descriptor.readlink-at": exports0["35"],
        "[method]descriptor.remove-directory-at": exports0["36"],
        "[method]descriptor.rename-at": exports0["37"],
        "[method]descriptor.stat": exports0["43"],
        "[method]descriptor.stat-at": exports0["44"],
        "[method]descriptor.unlink-file-at": exports0["38"],
        "[method]descriptor.write-via-stream": exports0["40"],
        "[method]directory-entry-stream.read-directory-entry": exports0["46"],
        "[resource-drop]descriptor": trampoline5,
        "[resource-drop]directory-entry-stream": trampoline1,
        "filesystem-error-code": exports0["32"]
      },
      "wasi:io/error@0.2.3": {
        "[resource-drop]error": trampoline3
      },
      "wasi:io/poll@0.2.3": {
        "[resource-drop]pollable": trampoline10,
        poll: exports0["53"]
      },
      "wasi:io/streams@0.2.3": {
        "[method]input-stream.blocking-read": exports0["48"],
        "[method]input-stream.read": exports0["47"],
        "[method]input-stream.subscribe": trampoline9,
        "[method]output-stream.blocking-flush": exports0["52"],
        "[method]output-stream.blocking-write-and-flush": exports0["51"],
        "[method]output-stream.check-write": exports0["49"],
        "[method]output-stream.subscribe": trampoline8,
        "[method]output-stream.write": exports0["50"],
        "[resource-drop]input-stream": trampoline4,
        "[resource-drop]output-stream": trampoline2
      }
    }));
    memory0 = exports1.memory;
    realloc0 = exports2.cabi_import_realloc;
    try {
      realloc0Async = WebAssembly.promising(exports2.cabi_import_realloc);
    } catch (err) {
      realloc0Async = exports2.cabi_import_realloc;
    }
    ({ exports: exports3 } = yield instantiateCore(yield module3, {
      "": {
        $imports: exports0.$imports,
        "0": exports2.args_get,
        "1": exports2.args_sizes_get,
        "10": exports2.fd_prestat_dir_name,
        "11": exports2.fd_read,
        "12": exports2.fd_readdir,
        "13": exports2.fd_renumber,
        "14": exports2.fd_seek,
        "15": exports2.fd_write,
        "16": exports2.path_create_directory,
        "17": exports2.path_filestat_get,
        "18": exports2.path_open,
        "19": exports2.path_readlink,
        "2": exports2.environ_get,
        "20": exports2.path_remove_directory,
        "21": exports2.path_rename,
        "22": exports2.path_unlink_file,
        "23": exports2.poll_oneoff,
        "24": exports2.proc_exit,
        "25": exports2.sched_yield,
        "26": trampoline17,
        "27": trampoline18,
        "28": trampoline19,
        "29": trampoline20,
        "3": exports2.environ_sizes_get,
        "30": trampoline21,
        "31": trampoline22,
        "32": trampoline23,
        "33": trampoline24,
        "34": trampoline25,
        "35": trampoline26,
        "36": trampoline27,
        "37": trampoline28,
        "38": trampoline29,
        "39": trampoline30,
        "4": exports2.clock_time_get,
        "40": trampoline31,
        "41": trampoline32,
        "42": trampoline33,
        "43": trampoline34,
        "44": trampoline35,
        "45": trampoline36,
        "46": trampoline37,
        "47": trampoline38,
        "48": trampoline39,
        "49": trampoline40,
        "5": exports2.fd_close,
        "50": trampoline41,
        "51": trampoline42,
        "52": trampoline43,
        "53": trampoline44,
        "54": trampoline45,
        "55": trampoline46,
        "56": trampoline47,
        "57": trampoline48,
        "6": exports2.fd_fdstat_get,
        "7": exports2.fd_fdstat_set_flags,
        "8": exports2.fd_filestat_get,
        "9": exports2.fd_prestat_get
      }
    }));
    run023Run = exports2["wasi:cli/run@0.2.3#run"];
    const run023 = {
      run
    };
    return { run: run023, "wasi:cli/run@0.2.3": run023 };
  })();
  let promise, resolve, reject;
  function runNext(value) {
    try {
      let done;
      do {
        ({ value, done } = gen.next(value));
      } while (!(value instanceof Promise) && !done);
      if (done) {
        if (resolve) return resolve(value);
        else return value;
      }
      if (!promise) promise = new Promise((_resolve, _reject) => (resolve = _resolve, reject = _reject));
      value.then((nextVal) => done ? resolve() : runNext(nextVal), reject);
    } catch (e) {
      if (reject) reject(e);
      else throw e;
    }
  }
  const maybeSyncReturn = runNext(null);
  return promise || maybeSyncReturn;
}

// lib/api.js
var yosys = new Application(yosys_resources_exports, instantiate, "yowasp-yosys");
var runYosys = yosys.run.bind(yosys);
var commands = { "yosys": runYosys };
var version = "0.68.1207";
export {
  Exit,
  commands,
  runYosys,
  version
};
