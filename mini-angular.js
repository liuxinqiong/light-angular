/**
 * Provider
 * 注册组件（directives, services 和 controllers）
 * 解决各个组件之间的依赖关系
 * 初始化所有组件
 */
var Provider = {
	_providers: {},
	directive: function (name, fn) {
		this._register(name + Provider.DIRECTIVES_SUFFIX, fn)
	},
	controller: function (name, fn) {
		/**
		 * 因为Ctrl可能会有多个调用，这些调用只有执行函数是一致的，但是执行函数的执行结果根据不同的scope环境是不一样的。
		 * 换句话说对于controller来说 执行函数才是单列的，执行结果是差异的。如果我们不包装一层，就会导致第一次的执行结果会直接缓存，
		 * 这样下次再使用MainCtrl的时候得到的值就是上一次的。
		 * 带来的问题就是我们需要get到执行函数后，再次调用invoke来获取结果。
		 */
		this._register(name + Provider.CONTROLLERS_SUFFIX, function () {
			return fn;
		})
		// this._register(name + Provider.CONTROLLERS_SUFFIX, fn)
	},
	service: function (name, fn) {
		this._register(name, fn);
	},
	_register: function (name, factory) {
		this._providers[name] = factory;
	},
	get: function (name, locals) {
		// 如果缓存了就直接返回，其实就是个单列模式，只会调用注册的工厂函数一次，以后直接调用缓存的生成好的对象
		if (this._cache[name]) {
			return this._cache[name];
		}
		// 如果不在缓存里，就从私有属性_providers里面拿到它的工厂函数，并且调用invoke去执行工厂函数实例化它。
		var provider = this._providers[name];
		if (!provider || typeof provider !== 'function') {
			return null;
		}
		return (this._cache[name] = this.invoke(provider, locals));
	},
	annotate: function (fn) {
		var res = fn.toString()
			// 去除注释
			.replace(/((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg, '')
			.match(/\((.*?)\)/);
		if (res && res[1]) {
			return res[1].split(',').map(function (d) {
				return d.trim();
			});
		}
		return [];
	},
	invoke: function (fn, locals) {
		// 判断如果没有locals对象就赋值一个空的值。局部依赖
		// 全局依赖是我们使用factory，service，filter等等注册的组件。他们可以被所有应用里的其他组件依赖使用。
		// 但是$scope呢？对于每一个controller（具有相同执行函数的controller）我们希望拥有不同的scope，$scope对象不像$http,$resource，它不是全局的依赖对象，而是跟$delegate对象一样是局部依赖，针对当前的组件。
		locals = locals || {};
		var deps = this.annotate(fn).map(function (s) {
			return locals[s] || this.get(s, locals);
		}, this);
		return fn.apply(null, deps);
	},
	// $rootScope默认就会被缓存，，因为我们需要一个单独的全局的并且唯一的超级scope。一旦整个应用启动了，他就会被实例化。
	_cache: { $rootScope: new Scope() }
}

Provider.DIRECTIVES_SUFFIX = 'Directive';
Provider.CONTROLLERS_SUFFIX = 'Controller';

/**
 * 为了实现脏检测的功能，于是scope可能是整个实现里面最复杂的部分了。
 * 在angularjs里面我们称为$digest循环。笼统的讲双向绑定的最主要原理，就是在$digest循环里面执行监控表达式。
 * 一旦这个循环开始调用，就会执行所有监控的表达式并且检测最后的执行结果是不是跟当前的执行结果不同，如果angularjs发现他们不同，它就会执行这个表达式对应的回调函数。
 * 一个监控者就是一个对象像这样{ expr, fn, last }。expr是对应的监控表达试，fn是对应的回调函数会在值变化后执行，last是上一次的表达式的执行结果。
 */
function Scope(parent, id) {
	this.$$watchers = [];
	this.$$children = [];
	this.$parent = parent;
	this.$id = id || 0;
}

// 跟踪最后一个scope，并且为下一个scope对象提供一个唯一的标识。
Scope.counter = 0;

Scope.prototype.$new = function () {
	Scope.counter += 1;
	var obj = new Scope(this, Scope.counter);
	// 很关键，不然都是平级的，无法访问父scope属性和方法
	// 设置原型链，把当前的scope对象作为新scope的原型，这样新的scope对象可以访问到父scope的属性方法
	Object.setPrototypeOf(obj, this);
	this.$$children.push(obj);
	return obj;
}

Scope.prototype.$destroy = function () {
	var pc = this.$parent.$$children;
	pc.splice(pc.indexOf(this), 1);
};

Scope.prototype.$watch = function (exp, fn) {
	this.$$watchers.push({
		exp: exp,
		fn: fn,
		last: Utils.clone(this.$eval(exp)) // 防止引用，从而影响判断
	});
}

Scope.prototype.$digest = function () {
	var dirty, watcher, current, i;
	// 基本上我们一直循环运行检测一直到没有脏数据
	do {
		// 默认情况下就是没有脏数据的。
		dirty = false;
		for (i = 0; i < this.$$watchers.length; i += 1) {
			watcher = this.$$watchers[i];
			current = this.$eval(watcher.exp);
			// 一旦我们发现当前表达式的执行结果跟上一次的结果不一样我们就认为有了脏数据，一旦我们发现一个脏数据我们就要重新执行一次所有的监控表达式。
			// 因为我们可能会有一些内部表达式依赖，所以一个表达式的结果可能会影响到另外一个的结果。这就是为什么我们需要一遍一遍的运行脏检测一直到所有的表达式都没有变化也就是稳定了。
			if (!Utils.equals(watcher.last, current)) {
				// 一旦我们发现数据改变了，我们就立即执行对应的回调并且更新对应的last值，并且标识当前有脏数据，这样就会再次调用脏检测。
				watcher.last = Utils.clone(current);
				dirty = true;
				watcher.fn(current);
			}
		}
	} while (dirty);
	// 继续递归调用子scope对象的脏数据检测
	for (i = 0; i < this.$$children.length; i += 1) {
		this.$$children[i].$digest();
	}
}

Scope.prototype.$eval = function (exp) {
	var val;
	if (typeof exp === 'function') {
		val = exp.call(this);
	} else {
		try {
			with (this) {
				val = eval(exp);
			}
		} catch (e) {
			val = undefined;
		}
	}
	return val;
}

/**
 * DOMCompiler
 * 遍历dom树的所有节点
 * 找到注册的属性类型的directives指令
 * 调用对应的directive对应的link逻辑
 * 管理scope
 */
var DOMCompiler = {
	// 启动整个项目
	bootstrap: function () {
		this.compile(document.children[0],
			Provider.get('$rootScope'));
	},
	/**
	 * 执行所有依附在当前html节点上的directives的代码，并且递归执行子元素的组件逻辑。
	 * 我们需要一个scope对象关联当前的html节点，这样才能实现双向绑定。
	 * 因为每个directive可能都会生成一个不同的scope，所以我们需要在递归调用的时候传入当前的scope对象。
	 */
	compile: function (el, scope) {
		var dirs = this._getElDirectives(el);
		var dir;
		var scopeCreated;
		dirs.forEach(function (d) {
			dir = Provider.get(d.name + Provider.DIRECTIVES_SUFFIX);
			// dir.scope代表当前 directive是否需要生成新的scope
			// 这边的情况是只要有一个指令需要单独的scope，其他的directive也会变成具有新的scope对象，这边是不是不太好
			if (dir.scope && !scopeCreated) {
				scope = scope.$new();
				scopeCreated = true;
			}
			dir.link(el, scope, d.value);
		})
		// 递归 nodelist - array
		Array.prototype.slice.call(el.children).forEach(function (c) {
			this.compile(c, scope);
		}, this);
	},
	_getElDirectives: function (el) {
		var attrs = el.attributes;
		var result = [];
		for (var i = 0; i < attrs.length; i += 1) {
			if (Provider.get(attrs[i].name + Provider.DIRECTIVES_SUFFIX)) {
				result.push({
					name: attrs[i].name,
					value: attrs[i].value
				})
			}
		}
		return result;
	}
}

// 实现几个指令
Provider.directive('ngl-bind', function () {
	return {
		scope: false,
		link: function (el, scope, exp) {
			el.innerHTML = scope.$eval(exp);
			scope.$watch(exp, function (val) {
				el.innerHTML = val;
			});
		}
	}
})

Provider.directive('ngl-model', function () {
	return {
		link: function (el, scope, exp) {
			el.onkeyup = function () {
				scope[exp] = el.value;
				scope.$digest();
			};
			scope.$watch(exp, function (val) {
				el.value = val;
			});
		}
	};
});

Provider.directive('ngl-controller', function () {
	return {
		scope: true,// 每个controller生成一个新的scope对象
		link: function (el, scope, exp) {
			var ctrl = Provider.get(exp + Provider.CONTROLLERS_SUFFIX);
			Provider.invoke(ctrl, { $scope: scope });
		}
	};
});

Provider.directive('ngl-click', function () {
	return {
		scope: false,
		link: function (el, scope, exp) {
			el.onclick = function () {
				scope.$eval(exp);
				scope.$digest();
			};
		}
	};
});