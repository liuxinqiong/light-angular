var Utils = {
    //参数数组或对象均可
    equals: function (o1, o2) {
        if (o1 === o2) return true;
        if (o1 === null || o2 === null) return false;
        if (o1 !== o1 && o2 !== o2) return true; // NaN === NaN
        var t1 = typeof o1,
            t2 = typeof o2,
            length, key, keySet;
        if (t1 == t2 && t1 == 'object') {
            if (this._isArray(o1)) {
                if (!this._isArray(o2)) return false;
                if ((length = o1.length) == o2.length) {
                    for (key = 0; key < length; key++) {
                        if (!this.equals(o1[key], o2[key])) return false;
                    }
                    return true;
                }
            } else if (this._isDate(o1)) {
                if (!this._isDate(o2)) return false;
                return this.equals(o1.getTime(), o2.getTime());
            } else if (this._isRegExp(o1)) {
                if (!this._isRegExp(o2)) return false;
                return o1.toString() == o2.toString();
            } else {
                if (this._isScope(o1) || this._isScope(o2) || this._isWindow(o1) || this._isWindow(o2) ||
                    this._isArray(o2) || this._isDate(o2) || this._isRegExp(o2)) return false;
                keySet = this._createMap();
                //对象属性的比较
                for (key in o1) {
                    if (key.charAt(0) === '$' || this._isFunction(o1[key])) continue;
                    if (!this.equals(o1[key], o2[key])) return false;
                    //用来存储对象一有哪些属性，有可能存在对象1的属性值和对象二都相等，但是对象二多余的属性
                    keySet[key] = true;
                }
                for (key in o2) {
                    if (!(key in keySet) &&
                        key.charAt(0) !== '$' &&
                        this._isDefined(o2[key]) && !this._isFunction(o2[key])) return false;
                }
                return true;
            }
        }
        return false;
    },
    _createMap: function () {
        //E5中提出的一种新的对象创建方式
        //第一个参数是要继承的原型，如果不是一个子函数，可以传一个null
        //第二个参数是对象的属性描述符，这个参数是可选的。
        return Object.create(null);
    },
    _isArray: Array.isArray,
    _isDate: function (value) {
        return toString.call(value) === '[object Date]';
    },
    _isRegExp: function (value) {
        return toString.call(value) === '[object RegExp]';
    },
    _isScope: function (obj) {
        return obj && obj.$evalAsync && obj.$watch;
    },
    _isWindow: function (obj) {
        return obj && obj.window === obj;
    },
    _isFunction: function (value) {
        return typeof value === 'function';
    },
    _isDefined: function (value) {
        return typeof value !== 'undefined';
    },
    clone: function (obj) {
        if (typeof obj !== 'object') return obj;
        var newObj = obj instanceof Array ? [] : {};
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                newObj[key] = typeof obj[key] === 'object' ? this.clone(obj[key]) : obj[key];
            }
        }
        return newObj;
    },
}