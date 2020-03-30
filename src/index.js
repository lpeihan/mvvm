const compileUtil = {
  getVal(vm, expr) {
    return expr.split('.').reduce((data, current) => {
      return data[current];
    }, vm.$data);
  },
  setVal(vm, expr, value) {
    expr.split('.').reduce((data, current, index, arr) => {
      if (arr.length - 1 === index) {
        return data[current] = value;
      }
      return data[current];
    }, vm.$data);
  },
  text(node, expr, vm) {
    const fn = this.updater.textUpdater;

    const content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      new Watcher(vm, args[1], (newVal) => {
        fn(node, this.getContentValue(vm, expr));
      });

      return this.getVal(vm, args[1]);
    });

    fn(node, content);
  },
  html(node, expr, vm) {
    const fn = this.updater.htmlUpdater;
    new Watcher(vm, expr, (newVal) => {
      fn(node, newVal);
    });

    const value = this.getVal(vm, expr);
    fn(node, value);
  },
  getContentValue(vm, expr) {
    // 遍历表达式  将内容重新替换成一个完整的内容 返还回去
    return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      return this.getVal(vm, args[1]);
    });
  },
  on(node, expr, vm, eventName) {
    node.addEventListener(eventName, (e) => {
      vm[expr].call(vm, e);
    });
  },
  model(node, expr, vm) {
    const fn = this.updater.modelUpdater;

    new Watcher(vm, expr, (newVal) => {
      fn(node, newVal);
    });

    node.addEventListener('input', (e) => {
      const value = e.target.value;
      this.setVal(vm, expr, value);
    });

    const value = this.getVal(vm, expr);
    fn(node, value);
  },
  updater: {
    modelUpdater(node, value) {
      node.value = value;
    },
    htmlUpdater(node, value) {
      node.innerHTML = value;
    },
    textUpdater(node, value) {
      node.textContent = value;
    }
  }
};

class Compiler {
  constructor(el, vm) {
    this.vm = vm;
    this.el = this.isElementNode(el) ? el : document.querySelector(el);

    const fragment = this.nodeToFragment(this.el);

    this.compile(fragment);

    this.el.appendChild(fragment);
  }

  isDirective(attrName) {
    return attrName.startsWith('v-');
  }

  compileElement(node) {
    const attributes = node.attributes;

    [...attributes].forEach(attr => {
      const { name, value: expr } = attr;

      if (this.isDirective(name)) {
        const [, directive] = name.split('-');
        const [directiveName, eventName] = directive.split(':');

        compileUtil[directiveName](node, expr, this.vm, eventName);
      }
    });
  }

  compileText(node) {
    const content = node.textContent;

    if (/\{\{(.+?)\}\}/.test(content)) {
      compileUtil.text(node, content, this.vm);
    }
  }

  compile(node) {
    const nodes = node.childNodes;

    [...nodes].forEach(child => {
      if (this.isElementNode(child)) {
        this.compileElement(child);
        this.compile(child);
      } else {
        this.compileText(child);
      }
    });
  }

  isElementNode(node) {
    return node.nodeType === 1;
  }

  // 把节点移动到文档碎片
  nodeToFragment(node) {
    const fragment = document.createDocumentFragment();

    let child = node.firstChild;

    while (child) {
      fragment.appendChild(child);

      child = node.firstChild;
    }

    return fragment;
  }
}

class Dep {
  constructor() {
    this.subs = [];
  }

  // 订阅
  addSub(watcher) {
    this.subs.push(watcher);
  }

  // 发布
  notify() {
    this.subs.forEach(watcher => {
      watcher.update();
    });
  }
}

class Watcher {
  constructor(vm, expr, cb) {
    this.vm = vm;
    this.expr = expr;
    this.cb = cb;
    this.oldValue = this.get();
  }

  get() {
    Dep.target = this;
    const value = compileUtil.getVal(this.vm, this.expr);
    Dep.target = null;
    return value;
  }

  update() {
    const newVal = compileUtil.getVal(this.vm, this.expr);
    if (newVal !== this.oldValue) {
      this.cb(newVal);
    }
  }
}

class Observer {
  constructor(data) {
    this.observer(data);
  }

  observer(data) {
    if (data && typeof data === 'object') {
      for (const key in data) {
        this.defineReactive(data, key, data[key]);
      }
    }
  }

  defineReactive(obj, key, value) {
    this.observer(value);
    const dep = new Dep();
    Object.defineProperty(obj, key, {
      get() {
        Dep.target && dep.addSub(Dep.target);
        return value;
      },
      set: (newVal) => {
        if (newVal !== value) {
          this.observer(newVal);
          value = newVal;
          dep.notify();
        }
      }
    });
  }
}

class Vue {
  constructor(options) {
    this.$el = options.el;
    this.$data = options.data;
    const computed = options.computed;
    const methods = options.methods;

    if (this.$el) {
      new Observer(this.$data);

      for (const key in computed) { //
        Object.defineProperty(this.$data, key, {
          get: () => {
            return computed[key].call(this);
          }
        });
      }

      for (const key in methods) {
        Object.defineProperty(this, key, {
          get() {
            return methods[key];
          }
        });
      }

      this.proxy(this.$data);
      new Compiler(this.$el, this);
    }
  }

  proxy(data) {
    for (const key in data) {
      Object.defineProperty(this, key, {
        get() {
          return data[key];
        },
        set(newVal) {
          data[key] = newVal;
        }
      });
    }
  }
}

console.log(Vue);
