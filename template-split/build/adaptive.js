(function () {/**
 * @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                name = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("almond", function(){});

/* Zepto 1.1.6 - zepto event ajax form fx selector stack data - zeptojs.com/license */

var Zepto = (function() {
  var undefined, key, $, classList, emptyArray = [], slice = emptyArray.slice, filter = emptyArray.filter,
    document = window.document,
    elementDisplay = {}, classCache = {},
    cssNumber = { 'column-count': 1, 'columns': 1, 'font-weight': 1, 'line-height': 1,'opacity': 1, 'z-index': 1, 'zoom': 1 },
    fragmentRE = /^\s*<(\w+|!)[^>]*>/,
    singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
    tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
    rootNodeRE = /^(?:body|html)$/i,
    capitalRE = /([A-Z])/g,

    // special attributes that should be get/set via method calls
    methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

    adjacencyOperators = [ 'after', 'prepend', 'before', 'append' ],
    table = document.createElement('table'),
    tableRow = document.createElement('tr'),
    containers = {
      'tr': document.createElement('tbody'),
      'tbody': table, 'thead': table, 'tfoot': table,
      'td': tableRow, 'th': tableRow,
      '*': document.createElement('div')
    },
    readyRE = /complete|loaded|interactive/,
    simpleSelectorRE = /^[\w-]*$/,
    class2type = {},
    toString = class2type.toString,
    zepto = {},
    camelize, uniq,
    tempParent = document.createElement('div'),
    propMap = {
      'tabindex': 'tabIndex',
      'readonly': 'readOnly',
      'for': 'htmlFor',
      'class': 'className',
      'maxlength': 'maxLength',
      'cellspacing': 'cellSpacing',
      'cellpadding': 'cellPadding',
      'rowspan': 'rowSpan',
      'colspan': 'colSpan',
      'usemap': 'useMap',
      'frameborder': 'frameBorder',
      'contenteditable': 'contentEditable'
    },
    isArray = Array.isArray ||
      function(object){ return object instanceof Array }

  zepto.matches = function(element, selector) {
    if (!selector || !element || element.nodeType !== 1) return false
    var matchesSelector = element.webkitMatchesSelector || element.mozMatchesSelector ||
                          element.oMatchesSelector || element.matchesSelector
    if (matchesSelector) return matchesSelector.call(element, selector)
    // fall back to performing a selector:
    var match, parent = element.parentNode, temp = !parent
    if (temp) (parent = tempParent).appendChild(element)
    match = ~zepto.qsa(parent, selector).indexOf(element)
    temp && tempParent.removeChild(element)
    return match
  }

  function type(obj) {
    return obj == null ? String(obj) :
      class2type[toString.call(obj)] || "object"
  }

  function isFunction(value) { return type(value) == "function" }
  function isWindow(obj)     { return obj != null && obj == obj.window }
  function isDocument(obj)   { return obj != null && obj.nodeType == obj.DOCUMENT_NODE }
  function isObject(obj)     { return type(obj) == "object" }
  function isPlainObject(obj) {
    return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype
  }
  function likeArray(obj) { return typeof obj.length == 'number' }

  function compact(array) { return filter.call(array, function(item){ return item != null }) }
  function flatten(array) { return array.length > 0 ? $.fn.concat.apply([], array) : array }
  camelize = function(str){ return str.replace(/-+(.)?/g, function(match, chr){ return chr ? chr.toUpperCase() : '' }) }
  function dasherize(str) {
    return str.replace(/::/g, '/')
           .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
           .replace(/([a-z\d])([A-Z])/g, '$1_$2')
           .replace(/_/g, '-')
           .toLowerCase()
  }
  uniq = function(array){ return filter.call(array, function(item, idx){ return array.indexOf(item) == idx }) }

  function classRE(name) {
    return name in classCache ?
      classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
  }

  function maybeAddPx(name, value) {
    return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
  }

  function defaultDisplay(nodeName) {
    var element, display
    if (!elementDisplay[nodeName]) {
      element = document.createElement(nodeName)
      document.body.appendChild(element)
      display = getComputedStyle(element, '').getPropertyValue("display")
      element.parentNode.removeChild(element)
      display == "none" && (display = "block")
      elementDisplay[nodeName] = display
    }
    return elementDisplay[nodeName]
  }

  function children(element) {
    return 'children' in element ?
      slice.call(element.children) :
      $.map(element.childNodes, function(node){ if (node.nodeType == 1) return node })
  }

  // `$.zepto.fragment` takes a html string and an optional tag name
  // to generate DOM nodes nodes from the given html string.
  // The generated DOM nodes are returned as an array.
  // This function can be overriden in plugins for example to make
  // it compatible with browsers that don't support the DOM fully.
  zepto.fragment = function(html, name, properties) {
    var dom, nodes, container

    // A special case optimization for a single tag
    if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1))

    if (!dom) {
      if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")
      if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
      if (!(name in containers)) name = '*'

      container = containers[name]
      container.innerHTML = '' + html
      dom = $.each(slice.call(container.childNodes), function(){
        container.removeChild(this)
      })
    }

    if (isPlainObject(properties)) {
      nodes = $(dom)
      $.each(properties, function(key, value) {
        if (methodAttributes.indexOf(key) > -1) nodes[key](value)
        else nodes.attr(key, value)
      })
    }

    return dom
  }

  // `$.zepto.Z` swaps out the prototype of the given `dom` array
  // of nodes with `$.fn` and thus supplying all the Zepto functions
  // to the array. Note that `__proto__` is not supported on Internet
  // Explorer. This method can be overriden in plugins.
  zepto.Z = function(dom, selector) {
    dom = dom || []
    dom.__proto__ = $.fn
    dom.selector = selector || ''
    return dom
  }

  // `$.zepto.isZ` should return `true` if the given object is a Zepto
  // collection. This method can be overriden in plugins.
  zepto.isZ = function(object) {
    return object instanceof zepto.Z
  }

  // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
  // takes a CSS selector and an optional context (and handles various
  // special cases).
  // This method can be overriden in plugins.
  zepto.init = function(selector, context) {
    var dom
    // If nothing given, return an empty Zepto collection
    if (!selector) return zepto.Z()
    // Optimize for string selectors
    else if (typeof selector == 'string') {
      selector = selector.trim()
      // If it's a html fragment, create nodes from it
      // Note: In both Chrome 21 and Firefox 15, DOM error 12
      // is thrown if the fragment doesn't begin with <
      if (selector[0] == '<' && fragmentRE.test(selector))
        dom = zepto.fragment(selector, RegExp.$1, context), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      else if (context !== undefined) return $(context).find(selector)
      // If it's a CSS selector, use it to select nodes.
      else dom = zepto.qsa(document, selector)
    }
    // If a function is given, call it when the DOM is ready
    else if (isFunction(selector)) return $(document).ready(selector)
    // If a Zepto collection is given, just return it
    else if (zepto.isZ(selector)) return selector
    else {
      // normalize array if an array of nodes is given
      if (isArray(selector)) dom = compact(selector)
      // Wrap DOM nodes.
      else if (isObject(selector))
        dom = [selector], selector = null
      // If it's a html fragment, create nodes from it
      else if (fragmentRE.test(selector))
        dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      else if (context !== undefined) return $(context).find(selector)
      // And last but no least, if it's a CSS selector, use it to select nodes.
      else dom = zepto.qsa(document, selector)
    }
    // create a new Zepto collection from the nodes found
    return zepto.Z(dom, selector)
  }

  // `$` will be the base `Zepto` object. When calling this
  // function just call `$.zepto.init, which makes the implementation
  // details of selecting nodes and creating Zepto collections
  // patchable in plugins.
  $ = function(selector, context){
    return zepto.init(selector, context)
  }

  function extend(target, source, deep) {
    for (key in source)
      if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
        if (isPlainObject(source[key]) && !isPlainObject(target[key]))
          target[key] = {}
        if (isArray(source[key]) && !isArray(target[key]))
          target[key] = []
        extend(target[key], source[key], deep)
      }
      else if (source[key] !== undefined) target[key] = source[key]
  }

  // Copy all but undefined properties from one or more
  // objects to the `target` object.
  $.extend = function(target){
    var deep, args = slice.call(arguments, 1)
    if (typeof target == 'boolean') {
      deep = target
      target = args.shift()
    }
    args.forEach(function(arg){ extend(target, arg, deep) })
    return target
  }

  // `$.zepto.qsa` is Zepto's CSS selector implementation which
  // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
  // This method can be overriden in plugins.
  zepto.qsa = function(element, selector){
    var found,
        maybeID = selector[0] == '#',
        maybeClass = !maybeID && selector[0] == '.',
        nameOnly = maybeID || maybeClass ? selector.slice(1) : selector, // Ensure that a 1 char tag name still gets checked
        isSimple = simpleSelectorRE.test(nameOnly)
    return (isDocument(element) && isSimple && maybeID) ?
      ( (found = element.getElementById(nameOnly)) ? [found] : [] ) :
      (element.nodeType !== 1 && element.nodeType !== 9) ? [] :
      slice.call(
        isSimple && !maybeID ?
          maybeClass ? element.getElementsByClassName(nameOnly) : // If it's simple, it could be a class
          element.getElementsByTagName(selector) : // Or a tag
          element.querySelectorAll(selector) // Or it's not simple, and we need to query all
      )
  }

  function filtered(nodes, selector) {
    return selector == null ? $(nodes) : $(nodes).filter(selector)
  }

  $.contains = document.documentElement.contains ?
    function(parent, node) {
      return parent !== node && parent.contains(node)
    } :
    function(parent, node) {
      while (node && (node = node.parentNode))
        if (node === parent) return true
      return false
    }

  function funcArg(context, arg, idx, payload) {
    return isFunction(arg) ? arg.call(context, idx, payload) : arg
  }

  function setAttribute(node, name, value) {
    value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
  }

  // access className property while respecting SVGAnimatedString
  function className(node, value){
    var klass = node.className || '',
        svg   = klass && klass.baseVal !== undefined

    if (value === undefined) return svg ? klass.baseVal : klass
    svg ? (klass.baseVal = value) : (node.className = value)
  }

  // "true"  => true
  // "false" => false
  // "null"  => null
  // "42"    => 42
  // "42.5"  => 42.5
  // "08"    => "08"
  // JSON    => parse if valid
  // String  => self
  function deserializeValue(value) {
    try {
      return value ?
        value == "true" ||
        ( value == "false" ? false :
          value == "null" ? null :
          +value + "" == value ? +value :
          /^[\[\{]/.test(value) ? $.parseJSON(value) :
          value )
        : value
    } catch(e) {
      return value
    }
  }

  $.type = type
  $.isFunction = isFunction
  $.isWindow = isWindow
  $.isArray = isArray
  $.isPlainObject = isPlainObject

  $.isEmptyObject = function(obj) {
    var name
    for (name in obj) return false
    return true
  }

  $.inArray = function(elem, array, i){
    return emptyArray.indexOf.call(array, elem, i)
  }

  $.camelCase = camelize
  $.trim = function(str) {
    return str == null ? "" : String.prototype.trim.call(str)
  }

  // plugin compatibility
  $.uuid = 0
  $.support = { }
  $.expr = { }

  $.map = function(elements, callback){
    var value, values = [], i, key
    if (likeArray(elements))
      for (i = 0; i < elements.length; i++) {
        value = callback(elements[i], i)
        if (value != null) values.push(value)
      }
    else
      for (key in elements) {
        value = callback(elements[key], key)
        if (value != null) values.push(value)
      }
    return flatten(values)
  }

  $.each = function(elements, callback){
    var i, key
    if (likeArray(elements)) {
      for (i = 0; i < elements.length; i++)
        if (callback.call(elements[i], i, elements[i]) === false) return elements
    } else {
      for (key in elements)
        if (callback.call(elements[key], key, elements[key]) === false) return elements
    }

    return elements
  }

  $.grep = function(elements, callback){
    return filter.call(elements, callback)
  }

  if (window.JSON) $.parseJSON = JSON.parse

  // Populate the class2type map
  $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
    class2type[ "[object " + name + "]" ] = name.toLowerCase()
  })

  // Define methods that will be available on all
  // Zepto collections
  $.fn = {
    // Because a collection acts like an array
    // copy over these useful array functions.
    forEach: emptyArray.forEach,
    reduce: emptyArray.reduce,
    push: emptyArray.push,
    sort: emptyArray.sort,
    indexOf: emptyArray.indexOf,
    concat: emptyArray.concat,

    // `map` and `slice` in the jQuery API work differently
    // from their array counterparts
    map: function(fn){
      return $($.map(this, function(el, i){ return fn.call(el, i, el) }))
    },
    slice: function(){
      return $(slice.apply(this, arguments))
    },

    ready: function(callback){
      // need to check if document.body exists for IE as that browser reports
      // document ready when it hasn't yet created the body element
      if (readyRE.test(document.readyState) && document.body) callback($)
      else document.addEventListener('DOMContentLoaded', function(){ callback($) }, false)
      return this
    },
    get: function(idx){
      return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
    },
    toArray: function(){ return this.get() },
    size: function(){
      return this.length
    },
    remove: function(){
      return this.each(function(){
        if (this.parentNode != null)
          this.parentNode.removeChild(this)
      })
    },
    each: function(callback){
      emptyArray.every.call(this, function(el, idx){
        return callback.call(el, idx, el) !== false
      })
      return this
    },
    filter: function(selector){
      if (isFunction(selector)) return this.not(this.not(selector))
      return $(filter.call(this, function(element){
        return zepto.matches(element, selector)
      }))
    },
    add: function(selector,context){
      return $(uniq(this.concat($(selector,context))))
    },
    is: function(selector){
      return this.length > 0 && zepto.matches(this[0], selector)
    },
    not: function(selector){
      var nodes=[]
      if (isFunction(selector) && selector.call !== undefined)
        this.each(function(idx){
          if (!selector.call(this,idx)) nodes.push(this)
        })
      else {
        var excludes = typeof selector == 'string' ? this.filter(selector) :
          (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
        this.forEach(function(el){
          if (excludes.indexOf(el) < 0) nodes.push(el)
        })
      }
      return $(nodes)
    },
    has: function(selector){
      return this.filter(function(){
        return isObject(selector) ?
          $.contains(this, selector) :
          $(this).find(selector).size()
      })
    },
    eq: function(idx){
      return idx === -1 ? this.slice(idx) : this.slice(idx, + idx + 1)
    },
    first: function(){
      var el = this[0]
      return el && !isObject(el) ? el : $(el)
    },
    last: function(){
      var el = this[this.length - 1]
      return el && !isObject(el) ? el : $(el)
    },
    find: function(selector){
      var result, $this = this
      if (!selector) result = $()
      else if (typeof selector == 'object')
        result = $(selector).filter(function(){
          var node = this
          return emptyArray.some.call($this, function(parent){
            return $.contains(parent, node)
          })
        })
      else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
      else result = this.map(function(){ return zepto.qsa(this, selector) })
      return result
    },
    closest: function(selector, context){
      var node = this[0], collection = false
      if (typeof selector == 'object') collection = $(selector)
      while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
        node = node !== context && !isDocument(node) && node.parentNode
      return $(node)
    },
    parents: function(selector){
      var ancestors = [], nodes = this
      while (nodes.length > 0)
        nodes = $.map(nodes, function(node){
          if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
            ancestors.push(node)
            return node
          }
        })
      return filtered(ancestors, selector)
    },
    parent: function(selector){
      return filtered(uniq(this.pluck('parentNode')), selector)
    },
    children: function(selector){
      return filtered(this.map(function(){ return children(this) }), selector)
    },
    contents: function() {
      return this.map(function() { return slice.call(this.childNodes) })
    },
    siblings: function(selector){
      return filtered(this.map(function(i, el){
        return filter.call(children(el.parentNode), function(child){ return child!==el })
      }), selector)
    },
    empty: function(){
      return this.each(function(){ this.innerHTML = '' })
    },
    // `pluck` is borrowed from Prototype.js
    pluck: function(property){
      return $.map(this, function(el){ return el[property] })
    },
    show: function(){
      return this.each(function(){
        this.style.display == "none" && (this.style.display = '')
        if (getComputedStyle(this, '').getPropertyValue("display") == "none")
          this.style.display = defaultDisplay(this.nodeName)
      })
    },
    replaceWith: function(newContent){
      return this.before(newContent).remove()
    },
    wrap: function(structure){
      var func = isFunction(structure)
      if (this[0] && !func)
        var dom   = $(structure).get(0),
            clone = dom.parentNode || this.length > 1

      return this.each(function(index){
        $(this).wrapAll(
          func ? structure.call(this, index) :
            clone ? dom.cloneNode(true) : dom
        )
      })
    },
    wrapAll: function(structure){
      if (this[0]) {
        $(this[0]).before(structure = $(structure))
        var children
        // drill down to the inmost element
        while ((children = structure.children()).length) structure = children.first()
        $(structure).append(this)
      }
      return this
    },
    wrapInner: function(structure){
      var func = isFunction(structure)
      return this.each(function(index){
        var self = $(this), contents = self.contents(),
            dom  = func ? structure.call(this, index) : structure
        contents.length ? contents.wrapAll(dom) : self.append(dom)
      })
    },
    unwrap: function(){
      this.parent().each(function(){
        $(this).replaceWith($(this).children())
      })
      return this
    },
    clone: function(){
      return this.map(function(){ return this.cloneNode(true) })
    },
    hide: function(){
      return this.css("display", "none")
    },
    toggle: function(setting){
      return this.each(function(){
        var el = $(this)
        ;(setting === undefined ? el.css("display") == "none" : setting) ? el.show() : el.hide()
      })
    },
    prev: function(selector){ return $(this.pluck('previousElementSibling')).filter(selector || '*') },
    next: function(selector){ return $(this.pluck('nextElementSibling')).filter(selector || '*') },
    html: function(html){
      return 0 in arguments ?
        this.each(function(idx){
          var originHtml = this.innerHTML
          $(this).empty().append( funcArg(this, html, idx, originHtml) )
        }) :
        (0 in this ? this[0].innerHTML : null)
    },
    text: function(text){
      return 0 in arguments ?
        this.each(function(idx){
          var newText = funcArg(this, text, idx, this.textContent)
          this.textContent = newText == null ? '' : ''+newText
        }) :
        (0 in this ? this[0].textContent : null)
    },
    attr: function(name, value){
      var result
      return (typeof name == 'string' && !(1 in arguments)) ?
        (!this.length || this[0].nodeType !== 1 ? undefined :
          (!(result = this[0].getAttribute(name)) && name in this[0]) ? this[0][name] : result
        ) :
        this.each(function(idx){
          if (this.nodeType !== 1) return
          if (isObject(name)) for (key in name) setAttribute(this, key, name[key])
          else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
        })
    },
    removeAttr: function(name){
      return this.each(function(){ this.nodeType === 1 && name.split(' ').forEach(function(attribute){
        setAttribute(this, attribute)
      }, this)})
    },
    prop: function(name, value){
      name = propMap[name] || name
      return (1 in arguments) ?
        this.each(function(idx){
          this[name] = funcArg(this, value, idx, this[name])
        }) :
        (this[0] && this[0][name])
    },
    data: function(name, value){
      var attrName = 'data-' + name.replace(capitalRE, '-$1').toLowerCase()

      var data = (1 in arguments) ?
        this.attr(attrName, value) :
        this.attr(attrName)

      return data !== null ? deserializeValue(data) : undefined
    },
    val: function(value){
      return 0 in arguments ?
        this.each(function(idx){
          this.value = funcArg(this, value, idx, this.value)
        }) :
        (this[0] && (this[0].multiple ?
           $(this[0]).find('option').filter(function(){ return this.selected }).pluck('value') :
           this[0].value)
        )
    },
    offset: function(coordinates){
      if (coordinates) return this.each(function(index){
        var $this = $(this),
            coords = funcArg(this, coordinates, index, $this.offset()),
            parentOffset = $this.offsetParent().offset(),
            props = {
              top:  coords.top  - parentOffset.top,
              left: coords.left - parentOffset.left
            }

        if ($this.css('position') == 'static') props['position'] = 'relative'
        $this.css(props)
      })
      if (!this.length) return null
      var obj = this[0].getBoundingClientRect()
      return {
        left: obj.left + window.pageXOffset,
        top: obj.top + window.pageYOffset,
        width: Math.round(obj.width),
        height: Math.round(obj.height)
      }
    },
    css: function(property, value){
      if (arguments.length < 2) {
        var computedStyle, element = this[0]
        if(!element) return
        computedStyle = getComputedStyle(element, '')
        if (typeof property == 'string')
          return element.style[camelize(property)] || computedStyle.getPropertyValue(property)
        else if (isArray(property)) {
          var props = {}
          $.each(property, function(_, prop){
            props[prop] = (element.style[camelize(prop)] || computedStyle.getPropertyValue(prop))
          })
          return props
        }
      }

      var css = ''
      if (type(property) == 'string') {
        if (!value && value !== 0)
          this.each(function(){ this.style.removeProperty(dasherize(property)) })
        else
          css = dasherize(property) + ":" + maybeAddPx(property, value)
      } else {
        for (key in property)
          if (!property[key] && property[key] !== 0)
            this.each(function(){ this.style.removeProperty(dasherize(key)) })
          else
            css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
      }

      return this.each(function(){ this.style.cssText += ';' + css })
    },
    index: function(element){
      return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
    },
    hasClass: function(name){
      if (!name) return false
      return emptyArray.some.call(this, function(el){
        return this.test(className(el))
      }, classRE(name))
    },
    addClass: function(name){
      if (!name) return this
      return this.each(function(idx){
        if (!('className' in this)) return
        classList = []
        var cls = className(this), newName = funcArg(this, name, idx, cls)
        newName.split(/\s+/g).forEach(function(klass){
          if (!$(this).hasClass(klass)) classList.push(klass)
        }, this)
        classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
      })
    },
    removeClass: function(name){
      return this.each(function(idx){
        if (!('className' in this)) return
        if (name === undefined) return className(this, '')
        classList = className(this)
        funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass){
          classList = classList.replace(classRE(klass), " ")
        })
        className(this, classList.trim())
      })
    },
    toggleClass: function(name, when){
      if (!name) return this
      return this.each(function(idx){
        var $this = $(this), names = funcArg(this, name, idx, className(this))
        names.split(/\s+/g).forEach(function(klass){
          (when === undefined ? !$this.hasClass(klass) : when) ?
            $this.addClass(klass) : $this.removeClass(klass)
        })
      })
    },
    scrollTop: function(value){
      if (!this.length) return
      var hasScrollTop = 'scrollTop' in this[0]
      if (value === undefined) return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset
      return this.each(hasScrollTop ?
        function(){ this.scrollTop = value } :
        function(){ this.scrollTo(this.scrollX, value) })
    },
    scrollLeft: function(value){
      if (!this.length) return
      var hasScrollLeft = 'scrollLeft' in this[0]
      if (value === undefined) return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset
      return this.each(hasScrollLeft ?
        function(){ this.scrollLeft = value } :
        function(){ this.scrollTo(value, this.scrollY) })
    },
    position: function() {
      if (!this.length) return

      var elem = this[0],
        // Get *real* offsetParent
        offsetParent = this.offsetParent(),
        // Get correct offsets
        offset       = this.offset(),
        parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset()

      // Subtract element margins
      // note: when an element has margin: auto the offsetLeft and marginLeft
      // are the same in Safari causing offset.left to incorrectly be 0
      offset.top  -= parseFloat( $(elem).css('margin-top') ) || 0
      offset.left -= parseFloat( $(elem).css('margin-left') ) || 0

      // Add offsetParent borders
      parentOffset.top  += parseFloat( $(offsetParent[0]).css('border-top-width') ) || 0
      parentOffset.left += parseFloat( $(offsetParent[0]).css('border-left-width') ) || 0

      // Subtract the two offsets
      return {
        top:  offset.top  - parentOffset.top,
        left: offset.left - parentOffset.left
      }
    },
    offsetParent: function() {
      return this.map(function(){
        var parent = this.offsetParent || document.body
        while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
          parent = parent.offsetParent
        return parent
      })
    }
  }

  // for now
  $.fn.detach = $.fn.remove

  // Generate the `width` and `height` functions
  ;['width', 'height'].forEach(function(dimension){
    var dimensionProperty =
      dimension.replace(/./, function(m){ return m[0].toUpperCase() })

    $.fn[dimension] = function(value){
      var offset, el = this[0]
      if (value === undefined) return isWindow(el) ? el['inner' + dimensionProperty] :
        isDocument(el) ? el.documentElement['scroll' + dimensionProperty] :
        (offset = this.offset()) && offset[dimension]
      else return this.each(function(idx){
        el = $(this)
        el.css(dimension, funcArg(this, value, idx, el[dimension]()))
      })
    }
  })

  function traverseNode(node, fun) {
    fun(node)
    for (var i = 0, len = node.childNodes.length; i < len; i++)
      traverseNode(node.childNodes[i], fun)
  }

  // Generate the `after`, `prepend`, `before`, `append`,
  // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
  adjacencyOperators.forEach(function(operator, operatorIndex) {
    var inside = operatorIndex % 2 //=> prepend, append

    $.fn[operator] = function(){
      // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
      var argType, nodes = $.map(arguments, function(arg) {
            argType = type(arg)
            return argType == "object" || argType == "array" || arg == null ?
              arg : zepto.fragment(arg)
          }),
          parent, copyByClone = this.length > 1
      if (nodes.length < 1) return this

      return this.each(function(_, target){
        parent = inside ? target : target.parentNode

        // convert all methods to a "before" operation
        target = operatorIndex == 0 ? target.nextSibling :
                 operatorIndex == 1 ? target.firstChild :
                 operatorIndex == 2 ? target :
                 null

        var parentInDocument = $.contains(document.documentElement, parent)

        nodes.forEach(function(node){
          if (copyByClone) node = node.cloneNode(true)
          else if (!parent) return $(node).remove()

          parent.insertBefore(node, target)
          if (parentInDocument) traverseNode(node, function(el){
            if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
               (!el.type || el.type === 'text/javascript') && !el.src)
              window['eval'].call(window, el.innerHTML)
          })
        })
      })
    }

    // after    => insertAfter
    // prepend  => prependTo
    // before   => insertBefore
    // append   => appendTo
    $.fn[inside ? operator+'To' : 'insert'+(operatorIndex ? 'Before' : 'After')] = function(html){
      $(html)[operator](this)
      return this
    }
  })

  zepto.Z.prototype = $.fn

  // Export internal API functions in the `$.zepto` namespace
  zepto.uniq = uniq
  zepto.deserializeValue = deserializeValue
  $.zepto = zepto

  return $
})()

window.Zepto = Zepto
window.$ === undefined && (window.$ = Zepto)

;(function($){
  var _zid = 1, undefined,
      slice = Array.prototype.slice,
      isFunction = $.isFunction,
      isString = function(obj){ return typeof obj == 'string' },
      handlers = {},
      specialEvents={},
      focusinSupported = 'onfocusin' in window,
      focus = { focus: 'focusin', blur: 'focusout' },
      hover = { mouseenter: 'mouseover', mouseleave: 'mouseout' }

  specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

  function zid(element) {
    return element._zid || (element._zid = _zid++)
  }
  function findHandlers(element, event, fn, selector) {
    event = parse(event)
    if (event.ns) var matcher = matcherFor(event.ns)
    return (handlers[zid(element)] || []).filter(function(handler) {
      return handler
        && (!event.e  || handler.e == event.e)
        && (!event.ns || matcher.test(handler.ns))
        && (!fn       || zid(handler.fn) === zid(fn))
        && (!selector || handler.sel == selector)
    })
  }
  function parse(event) {
    var parts = ('' + event).split('.')
    return {e: parts[0], ns: parts.slice(1).sort().join(' ')}
  }
  function matcherFor(ns) {
    return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
  }

  function eventCapture(handler, captureSetting) {
    return handler.del &&
      (!focusinSupported && (handler.e in focus)) ||
      !!captureSetting
  }

  function realEvent(type) {
    return hover[type] || (focusinSupported && focus[type]) || type
  }

  function add(element, events, fn, data, selector, delegator, capture){
    var id = zid(element), set = (handlers[id] || (handlers[id] = []))
    events.split(/\s/).forEach(function(event){
      if (event == 'ready') return $(document).ready(fn)
      var handler   = parse(event)
      handler.fn    = fn
      handler.sel   = selector
      // emulate mouseenter, mouseleave
      if (handler.e in hover) fn = function(e){
        var related = e.relatedTarget
        if (!related || (related !== this && !$.contains(this, related)))
          return handler.fn.apply(this, arguments)
      }
      handler.del   = delegator
      var callback  = delegator || fn
      handler.proxy = function(e){
        e = compatible(e)
        if (e.isImmediatePropagationStopped()) return
        e.data = data
        var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
        if (result === false) e.preventDefault(), e.stopPropagation()
        return result
      }
      handler.i = set.length
      set.push(handler)
      if ('addEventListener' in element)
        element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
    })
  }
  function remove(element, events, fn, selector, capture){
    var id = zid(element)
    ;(events || '').split(/\s/).forEach(function(event){
      findHandlers(element, event, fn, selector).forEach(function(handler){
        delete handlers[id][handler.i]
      if ('removeEventListener' in element)
        element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
      })
    })
  }

  $.event = { add: add, remove: remove }

  $.proxy = function(fn, context) {
    var args = (2 in arguments) && slice.call(arguments, 2)
    if (isFunction(fn)) {
      var proxyFn = function(){ return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments) }
      proxyFn._zid = zid(fn)
      return proxyFn
    } else if (isString(context)) {
      if (args) {
        args.unshift(fn[context], fn)
        return $.proxy.apply(null, args)
      } else {
        return $.proxy(fn[context], fn)
      }
    } else {
      throw new TypeError("expected function")
    }
  }

  $.fn.bind = function(event, data, callback){
    return this.on(event, data, callback)
  }
  $.fn.unbind = function(event, callback){
    return this.off(event, callback)
  }
  $.fn.one = function(event, selector, data, callback){
    return this.on(event, selector, data, callback, 1)
  }

  var returnTrue = function(){return true},
      returnFalse = function(){return false},
      ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$)/,
      eventMethods = {
        preventDefault: 'isDefaultPrevented',
        stopImmediatePropagation: 'isImmediatePropagationStopped',
        stopPropagation: 'isPropagationStopped'
      }

  function compatible(event, source) {
    if (source || !event.isDefaultPrevented) {
      source || (source = event)

      $.each(eventMethods, function(name, predicate) {
        var sourceMethod = source[name]
        event[name] = function(){
          this[predicate] = returnTrue
          return sourceMethod && sourceMethod.apply(source, arguments)
        }
        event[predicate] = returnFalse
      })

      if (source.defaultPrevented !== undefined ? source.defaultPrevented :
          'returnValue' in source ? source.returnValue === false :
          source.getPreventDefault && source.getPreventDefault())
        event.isDefaultPrevented = returnTrue
    }
    return event
  }

  function createProxy(event) {
    var key, proxy = { originalEvent: event }
    for (key in event)
      if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

    return compatible(proxy, event)
  }

  $.fn.delegate = function(selector, event, callback){
    return this.on(event, selector, callback)
  }
  $.fn.undelegate = function(selector, event, callback){
    return this.off(event, selector, callback)
  }

  $.fn.live = function(event, callback){
    $(document.body).delegate(this.selector, event, callback)
    return this
  }
  $.fn.die = function(event, callback){
    $(document.body).undelegate(this.selector, event, callback)
    return this
  }

  $.fn.on = function(event, selector, data, callback, one){
    var autoRemove, delegator, $this = this
    if (event && !isString(event)) {
      $.each(event, function(type, fn){
        $this.on(type, selector, data, fn, one)
      })
      return $this
    }

    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = data, data = selector, selector = undefined
    if (isFunction(data) || data === false)
      callback = data, data = undefined

    if (callback === false) callback = returnFalse

    return $this.each(function(_, element){
      if (one) autoRemove = function(e){
        remove(element, e.type, callback)
        return callback.apply(this, arguments)
      }

      if (selector) delegator = function(e){
        var evt, match = $(e.target).closest(selector, element).get(0)
        if (match && match !== element) {
          evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
          return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
        }
      }

      add(element, event, callback, data, selector, delegator || autoRemove)
    })
  }
  $.fn.off = function(event, selector, callback){
    var $this = this
    if (event && !isString(event)) {
      $.each(event, function(type, fn){
        $this.off(type, selector, fn)
      })
      return $this
    }

    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = selector, selector = undefined

    if (callback === false) callback = returnFalse

    return $this.each(function(){
      remove(this, event, callback, selector)
    })
  }

  $.fn.trigger = function(event, args){
    event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
    event._args = args
    return this.each(function(){
      // handle focus(), blur() by calling them directly
      if (event.type in focus && typeof this[event.type] == "function") this[event.type]()
      // items in the collection might not be DOM elements
      else if ('dispatchEvent' in this) this.dispatchEvent(event)
      else $(this).triggerHandler(event, args)
    })
  }

  // triggers event handlers on current element just as if an event occurred,
  // doesn't trigger an actual event, doesn't bubble
  $.fn.triggerHandler = function(event, args){
    var e, result
    this.each(function(i, element){
      e = createProxy(isString(event) ? $.Event(event) : event)
      e._args = args
      e.target = element
      $.each(findHandlers(element, event.type || event), function(i, handler){
        result = handler.proxy(e)
        if (e.isImmediatePropagationStopped()) return false
      })
    })
    return result
  }

  // shortcut methods for `.bind(event, fn)` for each event type
  ;('focusin focusout focus blur load resize scroll unload click dblclick '+
  'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave '+
  'change select keydown keypress keyup error').split(' ').forEach(function(event) {
    $.fn[event] = function(callback) {
      return (0 in arguments) ?
        this.bind(event, callback) :
        this.trigger(event)
    }
  })

  $.Event = function(type, props) {
    if (!isString(type)) props = type, type = props.type
    var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true
    if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
    event.initEvent(type, bubbles, true)
    return compatible(event)
  }

})(Zepto)

;(function($){
  var jsonpID = 0,
      document = window.document,
      key,
      name,
      rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      scriptTypeRE = /^(?:text|application)\/javascript/i,
      xmlTypeRE = /^(?:text|application)\/xml/i,
      jsonType = 'application/json',
      htmlType = 'text/html',
      blankRE = /^\s*$/,
      originAnchor = document.createElement('a')

  originAnchor.href = window.location.href

  // trigger a custom event and return false if it was cancelled
  function triggerAndReturn(context, eventName, data) {
    var event = $.Event(eventName)
    $(context).trigger(event, data)
    return !event.isDefaultPrevented()
  }

  // trigger an Ajax "global" event
  function triggerGlobal(settings, context, eventName, data) {
    if (settings.global) return triggerAndReturn(context || document, eventName, data)
  }

  // Number of active Ajax requests
  $.active = 0

  function ajaxStart(settings) {
    if (settings.global && $.active++ === 0) triggerGlobal(settings, null, 'ajaxStart')
  }
  function ajaxStop(settings) {
    if (settings.global && !(--$.active)) triggerGlobal(settings, null, 'ajaxStop')
  }

  // triggers an extra global event "ajaxBeforeSend" that's like "ajaxSend" but cancelable
  function ajaxBeforeSend(xhr, settings) {
    var context = settings.context
    if (settings.beforeSend.call(context, xhr, settings) === false ||
        triggerGlobal(settings, context, 'ajaxBeforeSend', [xhr, settings]) === false)
      return false

    triggerGlobal(settings, context, 'ajaxSend', [xhr, settings])
  }
  function ajaxSuccess(data, xhr, settings, deferred) {
    var context = settings.context, status = 'success'
    settings.success.call(context, data, status, xhr)
    if (deferred) deferred.resolveWith(context, [data, status, xhr])
    triggerGlobal(settings, context, 'ajaxSuccess', [xhr, settings, data])
    ajaxComplete(status, xhr, settings)
  }
  // type: "timeout", "error", "abort", "parsererror"
  function ajaxError(error, type, xhr, settings, deferred) {
    var context = settings.context
    settings.error.call(context, xhr, type, error)
    if (deferred) deferred.rejectWith(context, [xhr, type, error])
    triggerGlobal(settings, context, 'ajaxError', [xhr, settings, error || type])
    ajaxComplete(type, xhr, settings)
  }
  // status: "success", "notmodified", "error", "timeout", "abort", "parsererror"
  function ajaxComplete(status, xhr, settings) {
    var context = settings.context
    settings.complete.call(context, xhr, status)
    triggerGlobal(settings, context, 'ajaxComplete', [xhr, settings])
    ajaxStop(settings)
  }

  // Empty function, used as default callback
  function empty() {}

  $.ajaxJSONP = function(options, deferred){
    if (!('type' in options)) return $.ajax(options)

    var _callbackName = options.jsonpCallback,
      callbackName = ($.isFunction(_callbackName) ?
        _callbackName() : _callbackName) || ('jsonp' + (++jsonpID)),
      script = document.createElement('script'),
      originalCallback = window[callbackName],
      responseData,
      abort = function(errorType) {
        $(script).triggerHandler('error', errorType || 'abort')
      },
      xhr = { abort: abort }, abortTimeout

    if (deferred) deferred.promise(xhr)

    $(script).on('load error', function(e, errorType){
      clearTimeout(abortTimeout)
      $(script).off().remove()

      if (e.type == 'error' || !responseData) {
        ajaxError(null, errorType || 'error', xhr, options, deferred)
      } else {
        ajaxSuccess(responseData[0], xhr, options, deferred)
      }

      window[callbackName] = originalCallback
      if (responseData && $.isFunction(originalCallback))
        originalCallback(responseData[0])

      originalCallback = responseData = undefined
    })

    if (ajaxBeforeSend(xhr, options) === false) {
      abort('abort')
      return xhr
    }

    window[callbackName] = function(){
      responseData = arguments
    }

    script.src = options.url.replace(/\?(.+)=\?/, '?$1=' + callbackName)
    document.head.appendChild(script)

    if (options.timeout > 0) abortTimeout = setTimeout(function(){
      abort('timeout')
    }, options.timeout)

    return xhr
  }

  $.ajaxSettings = {
    // Default type of request
    type: 'GET',
    // Callback that is executed before request
    beforeSend: empty,
    // Callback that is executed if the request succeeds
    success: empty,
    // Callback that is executed the the server drops error
    error: empty,
    // Callback that is executed on request complete (both: error and success)
    complete: empty,
    // The context for the callbacks
    context: null,
    // Whether to trigger "global" Ajax events
    global: true,
    // Transport
    xhr: function () {
      return new window.XMLHttpRequest()
    },
    // MIME types mapping
    // IIS returns Javascript as "application/x-javascript"
    accepts: {
      script: 'text/javascript, application/javascript, application/x-javascript',
      json:   jsonType,
      xml:    'application/xml, text/xml',
      html:   htmlType,
      text:   'text/plain'
    },
    // Whether the request is to another domain
    crossDomain: false,
    // Default timeout
    timeout: 0,
    // Whether data should be serialized to string
    processData: true,
    // Whether the browser should be allowed to cache GET responses
    cache: true
  }

  function mimeToDataType(mime) {
    if (mime) mime = mime.split(';', 2)[0]
    return mime && ( mime == htmlType ? 'html' :
      mime == jsonType ? 'json' :
      scriptTypeRE.test(mime) ? 'script' :
      xmlTypeRE.test(mime) && 'xml' ) || 'text'
  }

  function appendQuery(url, query) {
    if (query == '') return url
    return (url + '&' + query).replace(/[&?]{1,2}/, '?')
  }

  // serialize payload and append it to the URL for GET requests
  function serializeData(options) {
    if (options.processData && options.data && $.type(options.data) != "string")
      options.data = $.param(options.data, options.traditional)
    if (options.data && (!options.type || options.type.toUpperCase() == 'GET'))
      options.url = appendQuery(options.url, options.data), options.data = undefined
  }

  $.ajax = function(options){
    var settings = $.extend({}, options || {}),
        deferred = $.Deferred && $.Deferred(),
        urlAnchor
    for (key in $.ajaxSettings) if (settings[key] === undefined) settings[key] = $.ajaxSettings[key]

    ajaxStart(settings)

    if (!settings.crossDomain) {
      urlAnchor = document.createElement('a')
      urlAnchor.href = settings.url
      urlAnchor.href = urlAnchor.href
      settings.crossDomain = (originAnchor.protocol + '//' + originAnchor.host) !== (urlAnchor.protocol + '//' + urlAnchor.host)
    }

    if (!settings.url) settings.url = window.location.toString()
    serializeData(settings)

    var dataType = settings.dataType, hasPlaceholder = /\?.+=\?/.test(settings.url)
    if (hasPlaceholder) dataType = 'jsonp'

    if (settings.cache === false || (
         (!options || options.cache !== true) &&
         ('script' == dataType || 'jsonp' == dataType)
        ))
      settings.url = appendQuery(settings.url, '_=' + Date.now())

    if ('jsonp' == dataType) {
      if (!hasPlaceholder)
        settings.url = appendQuery(settings.url,
          settings.jsonp ? (settings.jsonp + '=?') : settings.jsonp === false ? '' : 'callback=?')
      return $.ajaxJSONP(settings, deferred)
    }

    var mime = settings.accepts[dataType],
        headers = { },
        setHeader = function(name, value) { headers[name.toLowerCase()] = [name, value] },
        protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol,
        xhr = settings.xhr(),
        nativeSetHeader = xhr.setRequestHeader,
        abortTimeout

    if (deferred) deferred.promise(xhr)

    if (!settings.crossDomain) setHeader('X-Requested-With', 'XMLHttpRequest')
    setHeader('Accept', mime || '*/*')
    if (mime = settings.mimeType || mime) {
      if (mime.indexOf(',') > -1) mime = mime.split(',', 2)[0]
      xhr.overrideMimeType && xhr.overrideMimeType(mime)
    }
    if (settings.contentType || (settings.contentType !== false && settings.data && settings.type.toUpperCase() != 'GET'))
      setHeader('Content-Type', settings.contentType || 'application/x-www-form-urlencoded')

    if (settings.headers) for (name in settings.headers) setHeader(name, settings.headers[name])
    xhr.setRequestHeader = setHeader

    xhr.onreadystatechange = function(){
      if (xhr.readyState == 4) {
        xhr.onreadystatechange = empty
        clearTimeout(abortTimeout)
        var result, error = false
        if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status == 0 && protocol == 'file:')) {
          dataType = dataType || mimeToDataType(settings.mimeType || xhr.getResponseHeader('content-type'))
          result = xhr.responseText

          try {
            // http://perfectionkills.com/global-eval-what-are-the-options/
            if (dataType == 'script')    (1,eval)(result)
            else if (dataType == 'xml')  result = xhr.responseXML
            else if (dataType == 'json') result = blankRE.test(result) ? null : $.parseJSON(result)
          } catch (e) { error = e }

          if (error) ajaxError(error, 'parsererror', xhr, settings, deferred)
          else ajaxSuccess(result, xhr, settings, deferred)
        } else {
          ajaxError(xhr.statusText || null, xhr.status ? 'error' : 'abort', xhr, settings, deferred)
        }
      }
    }

    if (ajaxBeforeSend(xhr, settings) === false) {
      xhr.abort()
      ajaxError(null, 'abort', xhr, settings, deferred)
      return xhr
    }

    if (settings.xhrFields) for (name in settings.xhrFields) xhr[name] = settings.xhrFields[name]

    var async = 'async' in settings ? settings.async : true
    xhr.open(settings.type, settings.url, async, settings.username, settings.password)

    for (name in headers) nativeSetHeader.apply(xhr, headers[name])

    if (settings.timeout > 0) abortTimeout = setTimeout(function(){
        xhr.onreadystatechange = empty
        xhr.abort()
        ajaxError(null, 'timeout', xhr, settings, deferred)
      }, settings.timeout)

    // avoid sending empty string (#319)
    xhr.send(settings.data ? settings.data : null)
    return xhr
  }

  // handle optional data/success arguments
  function parseArguments(url, data, success, dataType) {
    if ($.isFunction(data)) dataType = success, success = data, data = undefined
    if (!$.isFunction(success)) dataType = success, success = undefined
    return {
      url: url
    , data: data
    , success: success
    , dataType: dataType
    }
  }

  $.get = function(/* url, data, success, dataType */){
    return $.ajax(parseArguments.apply(null, arguments))
  }

  $.post = function(/* url, data, success, dataType */){
    var options = parseArguments.apply(null, arguments)
    options.type = 'POST'
    return $.ajax(options)
  }

  $.getJSON = function(/* url, data, success */){
    var options = parseArguments.apply(null, arguments)
    options.dataType = 'json'
    return $.ajax(options)
  }

  $.fn.load = function(url, data, success){
    if (!this.length) return this
    var self = this, parts = url.split(/\s/), selector,
        options = parseArguments(url, data, success),
        callback = options.success
    if (parts.length > 1) options.url = parts[0], selector = parts[1]
    options.success = function(response){
      self.html(selector ?
        $('<div>').html(response.replace(rscript, "")).find(selector)
        : response)
      callback && callback.apply(self, arguments)
    }
    $.ajax(options)
    return this
  }

  var escape = encodeURIComponent

  function serialize(params, obj, traditional, scope){
    var type, array = $.isArray(obj), hash = $.isPlainObject(obj)
    $.each(obj, function(key, value) {
      type = $.type(value)
      if (scope) key = traditional ? scope :
        scope + '[' + (hash || type == 'object' || type == 'array' ? key : '') + ']'
      // handle data in serializeArray() format
      if (!scope && array) params.add(value.name, value.value)
      // recurse into nested objects
      else if (type == "array" || (!traditional && type == "object"))
        serialize(params, value, traditional, key)
      else params.add(key, value)
    })
  }

  $.param = function(obj, traditional){
    var params = []
    params.add = function(key, value) {
      if ($.isFunction(value)) value = value()
      if (value == null) value = ""
      this.push(escape(key) + '=' + escape(value))
    }
    serialize(params, obj, traditional)
    return params.join('&').replace(/%20/g, '+')
  }
})(Zepto)

;(function($){
  $.fn.serializeArray = function() {
    var name, type, result = [],
      add = function(value) {
        if (value.forEach) return value.forEach(add)
        result.push({ name: name, value: value })
      }
    if (this[0]) $.each(this[0].elements, function(_, field){
      type = field.type, name = field.name
      if (name && field.nodeName.toLowerCase() != 'fieldset' &&
        !field.disabled && type != 'submit' && type != 'reset' && type != 'button' && type != 'file' &&
        ((type != 'radio' && type != 'checkbox') || field.checked))
          add($(field).val())
    })
    return result
  }

  $.fn.serialize = function(){
    var result = []
    this.serializeArray().forEach(function(elm){
      result.push(encodeURIComponent(elm.name) + '=' + encodeURIComponent(elm.value))
    })
    return result.join('&')
  }

  $.fn.submit = function(callback) {
    if (0 in arguments) this.bind('submit', callback)
    else if (this.length) {
      var event = $.Event('submit')
      this.eq(0).trigger(event)
      if (!event.isDefaultPrevented()) this.get(0).submit()
    }
    return this
  }

})(Zepto)

;(function($, undefined){
  var prefix = '', eventPrefix, endEventName, endAnimationName,
    vendors = { Webkit: 'webkit', Moz: '', O: 'o' },
    document = window.document, testEl = document.createElement('div'),
    supportedTransforms = /^((translate|rotate|scale)(X|Y|Z|3d)?|matrix(3d)?|perspective|skew(X|Y)?)$/i,
    transform,
    transitionProperty, transitionDuration, transitionTiming, transitionDelay,
    animationName, animationDuration, animationTiming, animationDelay,
    cssReset = {}

  function dasherize(str) { return str.replace(/([a-z])([A-Z])/, '$1-$2').toLowerCase() }
  function normalizeEvent(name) { return eventPrefix ? eventPrefix + name : name.toLowerCase() }

  $.each(vendors, function(vendor, event){
    if (testEl.style[vendor + 'TransitionProperty'] !== undefined) {
      prefix = '-' + vendor.toLowerCase() + '-'
      eventPrefix = event
      return false
    }
  })

  transform = prefix + 'transform'
  cssReset[transitionProperty = prefix + 'transition-property'] =
  cssReset[transitionDuration = prefix + 'transition-duration'] =
  cssReset[transitionDelay    = prefix + 'transition-delay'] =
  cssReset[transitionTiming   = prefix + 'transition-timing-function'] =
  cssReset[animationName      = prefix + 'animation-name'] =
  cssReset[animationDuration  = prefix + 'animation-duration'] =
  cssReset[animationDelay     = prefix + 'animation-delay'] =
  cssReset[animationTiming    = prefix + 'animation-timing-function'] = ''

  $.fx = {
    off: (eventPrefix === undefined && testEl.style.transitionProperty === undefined),
    speeds: { _default: 400, fast: 200, slow: 600 },
    cssPrefix: prefix,
    transitionEnd: normalizeEvent('TransitionEnd'),
    animationEnd: normalizeEvent('AnimationEnd')
  }

  $.fn.animate = function(properties, duration, ease, callback, delay){
    if ($.isFunction(duration))
      callback = duration, ease = undefined, duration = undefined
    if ($.isFunction(ease))
      callback = ease, ease = undefined
    if ($.isPlainObject(duration))
      ease = duration.easing, callback = duration.complete, delay = duration.delay, duration = duration.duration
    if (duration) duration = (typeof duration == 'number' ? duration :
                    ($.fx.speeds[duration] || $.fx.speeds._default)) / 1000
    if (delay) delay = parseFloat(delay) / 1000
    return this.anim(properties, duration, ease, callback, delay)
  }

  $.fn.anim = function(properties, duration, ease, callback, delay){
    var key, cssValues = {}, cssProperties, transforms = '',
        that = this, wrappedCallback, endEvent = $.fx.transitionEnd,
        fired = false

    if (duration === undefined) duration = $.fx.speeds._default / 1000
    if (delay === undefined) delay = 0
    if ($.fx.off) duration = 0

    if (typeof properties == 'string') {
      // keyframe animation
      cssValues[animationName] = properties
      cssValues[animationDuration] = duration + 's'
      cssValues[animationDelay] = delay + 's'
      cssValues[animationTiming] = (ease || 'linear')
      endEvent = $.fx.animationEnd
    } else {
      cssProperties = []
      // CSS transitions
      for (key in properties)
        if (supportedTransforms.test(key)) transforms += key + '(' + properties[key] + ') '
        else cssValues[key] = properties[key], cssProperties.push(dasherize(key))

      if (transforms) cssValues[transform] = transforms, cssProperties.push(transform)
      if (duration > 0 && typeof properties === 'object') {
        cssValues[transitionProperty] = cssProperties.join(', ')
        cssValues[transitionDuration] = duration + 's'
        cssValues[transitionDelay] = delay + 's'
        cssValues[transitionTiming] = (ease || 'linear')
      }
    }

    wrappedCallback = function(event){
      if (typeof event !== 'undefined') {
        if (event.target !== event.currentTarget) return // makes sure the event didn't bubble from "below"
        $(event.target).unbind(endEvent, wrappedCallback)
      } else
        $(this).unbind(endEvent, wrappedCallback) // triggered by setTimeout

      fired = true
      $(this).css(cssReset)
      callback && callback.call(this)
    }
    if (duration > 0){
      this.bind(endEvent, wrappedCallback)
      // transitionEnd is not always firing on older Android phones
      // so make sure it gets fired
      setTimeout(function(){
        if (fired) return
        wrappedCallback.call(that)
      }, ((duration + delay) * 1000) + 25)
    }

    // trigger page reflow so new elements can animate
    this.size() && this.get(0).clientLeft

    this.css(cssValues)

    if (duration <= 0) setTimeout(function() {
      that.each(function(){ wrappedCallback.call(this) })
    }, 0)

    return this
  }

  testEl = null
})(Zepto)

;(function($){
  var zepto = $.zepto, oldQsa = zepto.qsa, oldMatches = zepto.matches

  function visible(elem){
    elem = $(elem)
    return !!(elem.width() || elem.height()) && elem.css("display") !== "none"
  }

  // Implements a subset from:
  // http://api.jquery.com/category/selectors/jquery-selector-extensions/
  //
  // Each filter function receives the current index, all nodes in the
  // considered set, and a value if there were parentheses. The value
  // of `this` is the node currently being considered. The function returns the
  // resulting node(s), null, or undefined.
  //
  // Complex selectors are not supported:
  //   li:has(label:contains("foo")) + li:has(label:contains("bar"))
  //   ul.inner:first > li
  var filters = $.expr[':'] = {
    visible:  function(){ if (visible(this)) return this },
    hidden:   function(){ if (!visible(this)) return this },
    selected: function(){ if (this.selected) return this },
    checked:  function(){ if (this.checked) return this },
    parent:   function(){ return this.parentNode },
    first:    function(idx){ if (idx === 0) return this },
    last:     function(idx, nodes){ if (idx === nodes.length - 1) return this },
    eq:       function(idx, _, value){ if (idx === value) return this },
    contains: function(idx, _, text){ if ($(this).text().indexOf(text) > -1) return this },
    has:      function(idx, _, sel){ if (zepto.qsa(this, sel).length) return this }
  }

  var filterRe = new RegExp('(.*):(\\w+)(?:\\(([^)]+)\\))?$\\s*'),
      childRe  = /^\s*>/,
      classTag = 'Zepto' + (+new Date())

  function process(sel, fn) {
    // quote the hash in `a[href^=#]` expression
    sel = sel.replace(/=#\]/g, '="#"]')
    var filter, arg, match = filterRe.exec(sel)
    if (match && match[2] in filters) {
      filter = filters[match[2]], arg = match[3]
      sel = match[1]
      if (arg) {
        var num = Number(arg)
        if (isNaN(num)) arg = arg.replace(/^["']|["']$/g, '')
        else arg = num
      }
    }
    return fn(sel, filter, arg)
  }

  zepto.qsa = function(node, selector) {
    return process(selector, function(sel, filter, arg){
      try {
        var taggedParent
        if (!sel && filter) sel = '*'
        else if (childRe.test(sel))
          // support "> *" child queries by tagging the parent node with a
          // unique class and prepending that classname onto the selector
          taggedParent = $(node).addClass(classTag), sel = '.'+classTag+' '+sel

        var nodes = oldQsa(node, sel)
      } catch(e) {
        console.error('error performing selector: %o', selector)
        throw e
      } finally {
        if (taggedParent) taggedParent.removeClass(classTag)
      }
      return !filter ? nodes :
        zepto.uniq($.map(nodes, function(n, i){ return filter.call(n, i, nodes, arg) }))
    })
  }

  zepto.matches = function(node, selector){
    return process(selector, function(sel, filter, arg){
      return (!sel || oldMatches(node, sel)) &&
        (!filter || filter.call(node, null, arg) === node)
    })
  }
})(Zepto)

;(function($){
  $.fn.end = function(){
    return this.prevObject || $()
  }

  $.fn.andSelf = function(){
    return this.add(this.prevObject || $())
  }

  'filter,add,not,eq,first,last,find,closest,parents,parent,children,siblings'.split(',').forEach(function(property){
    var fn = $.fn[property]
    $.fn[property] = function(){
      var ret = fn.apply(this, arguments)
      ret.prevObject = this
      return ret
    }
  })
})(Zepto)

;(function($){
  var data = {}, dataAttr = $.fn.data, camelize = $.camelCase,
    exp = $.expando = 'Zepto' + (+new Date()), emptyArray = []

  // Get value from node:
  // 1. first try key as given,
  // 2. then try camelized key,
  // 3. fall back to reading "data-*" attribute.
  function getData(node, name) {
    var id = node[exp], store = id && data[id]
    if (name === undefined) return store || setData(node)
    else {
      if (store) {
        if (name in store) return store[name]
        var camelName = camelize(name)
        if (camelName in store) return store[camelName]
      }
      return dataAttr.call($(node), name)
    }
  }

  // Store value under camelized key on node
  function setData(node, name, value) {
    var id = node[exp] || (node[exp] = ++$.uuid),
      store = data[id] || (data[id] = attributeData(node))
    if (name !== undefined) store[camelize(name)] = value
    return store
  }

  // Read all "data-*" attributes from a node
  function attributeData(node) {
    var store = {}
    $.each(node.attributes || emptyArray, function(i, attr){
      if (attr.name.indexOf('data-') == 0)
        store[camelize(attr.name.replace('data-', ''))] =
          $.zepto.deserializeValue(attr.value)
    })
    return store
  }

  $.fn.data = function(name, value) {
    return value === undefined ?
      // set multiple values via object
      $.isPlainObject(name) ?
        this.each(function(i, node){
          $.each(name, function(key, value){ setData(node, key, value) })
        }) :
        // get value from first element
        (0 in this ? getData(this[0], name) : undefined) :
      // set value on all elements
      this.each(function(){ setData(this, name, value) })
  }

  $.fn.removeData = function(names) {
    if (typeof names == 'string') names = names.split(/\s+/)
    return this.each(function(){
      var id = this[exp], store = id && data[id]
      if (store) $.each(names || store, function(key){
        delete store[names ? camelize(this) : key]
      })
    })
  }

  // Generate extended `remove` and `empty` functions
  ;['remove', 'empty'].forEach(function(methodName){
    var origFn = $.fn[methodName]
    $.fn[methodName] = function() {
      var elements = this.find('*')
      if (methodName === 'remove') elements = elements.add(this)
      elements.removeData()
      return origFn.call(this)
    }
  })
})(Zepto)
;
define("baseSelectorLibrary", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.$;
    };
}(this)));

/**
 * A selector library which is extended from a base selector library,
 * but with a constructer that calls the selector engine on the doc
 * defined in the closure, and a few additional methods for
 * getting/setting that document.
 */
define('$',['baseSelectorLibrary'], function($) {
    var doc = document;

    var SelectorLibrary = function(selector, context, rootQuery) {
        if ($.fn.init) {
            return new $.fn.init(selector, context || doc, rootQuery);
        }
        return $.zepto.init.call(this, selector, context || doc, rootQuery);
    };

    /**
     *  Binds the passed document to the selector engine.
     *  All queries are done against that document, not the current document.
     */
    SelectorLibrary.attachDocument = function(document) {
        doc = document;
    };

    SelectorLibrary.getDocument = function() {
        return doc;
    };

    $.extend(SelectorLibrary, $);

    return SelectorLibrary;
});

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define('mobifyjs/utils',[], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.Utils = factory();
    }
}(this, function () {

// ##
// # Utility methods
// ##

var Utils = {};

Utils.extend = function(target){
    [].slice.call(arguments, 1).forEach(function(source) {
        for (var key in source)
            if (source[key] !== undefined)
                target[key] = source[key];
    });
    return target;
};

Utils.keys = function(obj) {
    var result = [];
    for (var key in obj) {
        if (obj.hasOwnProperty(key))
            result.push(key);
    }
    return result;
};

Utils.values = function(obj) {
    var result = [];
    for (var key in obj) {
      if (obj.hasOwnProperty(key))
          result.push(obj[key]);
    }
    return result;
};

Utils.clone = function(obj) {
    var target = {};
    for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
          target[i] = obj[i];
        }
    }
    return target;
};

// Some url helpers
/**
 * Takes a url, relative or absolute, and absolutizes it relative to the current 
 * document's location/base, with the assistance of an a element.
 */
var _absolutifyAnchor = document.createElement("a");
Utils.absolutify = function(url) {
    _absolutifyAnchor.href = url;
    return _absolutifyAnchor.href;
};

/**
 * Takes an absolute url, returns true if it is an http/s url, false otherwise 
 * (e.g. mailto:, gopher://, data:, etc.)
 */
var _httpUrlRE = /^https?/;
Utils.httpUrl = function(url) {
    return _httpUrlRE.test(url);
};

/**
 * outerHTML polyfill - https://gist.github.com/889005
 */
Utils.outerHTML = function(el){
    if (el.outerHTML) {
        return el.outerHTML;
    }
    else {
        var div = document.createElement('div');
        div.appendChild(el.cloneNode(true));
        var contents = div.innerHTML;
        div = null;
        return contents;
    }
};

/**
 * Return a string for the doctype of the current document.
 */
Utils.getDoctype = function(doc) {
    doc = doc || document;
    var doctypeEl = doc.doctype || [].filter.call(doc.childNodes, function(el) {
            return el.nodeType == Node.DOCUMENT_TYPE_NODE
        })[0];

    if (!doctypeEl) return '';

    return '<!DOCTYPE HTML'
        + (doctypeEl.publicId ? ' PUBLIC "' + doctypeEl.publicId + '"' : '')
        + (doctypeEl.systemId ? ' "' + doctypeEl.systemId + '"' : '')
        + '>';
};

/**
 * Returns an object that represents the parsed content attribute of the
 * viewport meta tag. Returns false if no viewport meta tag is present.
 */
Utils.getMetaViewportProperties = function(doc) {
    // Regex to split comma-delimited viewport meta tag properties
    var SPLIT_PROPERTIES_REGEX = /,\s?/;

    doc = doc || document;
    var parsedProperties = {}

    // Get the viewport meta tag
    var viewport = doc.querySelectorAll('meta[name="viewport"]');
    if (viewport.length == 0) {
        return false;
    }

    // Split its properties
    var content = viewport[0].getAttribute('content');
    if (content == null) {
        return false;
    }
    var properties = content.split(SPLIT_PROPERTIES_REGEX);

    // Parse the properties into an object
    for (var i = 0; i < properties.length; i++) {
        var property = properties[i].split('=')

        if (property.length >= 2) {
            var key = property[0];
            var value = property[1];
            parsedProperties[key] = value;
        }
    }

    return parsedProperties;
}

Utils.removeBySelector = function(selector, doc) {
    doc = doc || document;

    var els = doc.querySelectorAll(selector);
    return Utils.removeElements(els, doc);
};

Utils.removeElements = function(elements, doc) {
    doc = doc || document;

    for (var i=0,ii=elements.length; i<ii; i++) {
        var el = elements[i];
        el.parentNode.removeChild(el);
    }
    return elements;
};

// localStorage detection as seen in such great libraries as Modernizr
// https://github.com/Modernizr/Modernizr/blob/master/feature-detects/storage/localstorage.js
// Exposing on Jazzcat for use in qunit tests
var cachedLocalStorageSupport;
Utils.supportsLocalStorage = function() {
    if (cachedLocalStorageSupport !== undefined) {
        return cachedLocalStorageSupport;
    }
    var mod = 'modernizr';
    try {
        localStorage.setItem(mod, mod);
        localStorage.removeItem(mod);
        cachedLocalStorageSupport = true;
    } catch(e) {
        cachedLocalStorageSupport = false
    }
    return cachedLocalStorageSupport;
};

// matchMedia polyfill generator
// (allows you to specify which document to run polyfill on)
Utils.matchMedia = function(doc) {
    "use strict";

    var bool,
        docElem = doc.documentElement,
        refNode = docElem.firstElementChild || docElem.firstChild,
        // fakeBody required for <FF4 when executed in <head>
        fakeBody = doc.createElement("body"),
        div = doc.createElement("div");

    div.id = "mq-test-1";
    div.style.cssText = "position:absolute;top:-100em";
    fakeBody.style.background = "none";
    fakeBody.appendChild(div);

    return function(q){
        div.innerHTML = "&shy;<style media=\"" + q + "\"> #mq-test-1 { width: 42px; }</style>";

        docElem.insertBefore(fakeBody, refNode);
        bool = div.offsetWidth === 42;
        docElem.removeChild(fakeBody);

        return {
           matches: bool,
           media: q
        };
    };
};

// readyState: loading --> interactive --> complete
//                      |               |
//                      |               |
//                      v               v
// Event:        DOMContentLoaded    onload
//
// iOS 4.3 and some Android 2.X.X have a non-typical "loaded" readyState,
// which is an acceptable readyState to start capturing on, because
// the data is fully loaded from the server at that state.
// For some IE (IE10 on Lumia 920 for example), interactive is not 
// indicative of the DOM being ready, therefore "complete" is the only acceptable
// readyState for IE10
// Credit to https://github.com/jquery/jquery/commit/0f553ed0ca0c50c5f66377e9f2c6314f822e8f25
// for the IE10 fix
Utils.domIsReady = function(doc) {
    var doc = doc || document;
    return doc.attachEvent ? doc.readyState === "complete" : doc.readyState !== "loading";
};

Utils.getPhysicalScreenSize = function(devicePixelRatio) {

    function multiplyByPixelRatio(sizes) {
        var dpr = devicePixelRatio || window.devicePixelRatio || 1;

        sizes.width = Math.round(sizes.width * dpr);
        sizes.height = Math.round(sizes.height * dpr);

        return sizes;
    }

    var iOS = navigator.userAgent.match(/ip(hone|od|ad)/i);
    var androidVersion = (navigator.userAgent.match(/android (\d)/i) || {})[1];

    var sizes = {
        width: window.outerWidth
      , height: window.outerHeight
    };

    // Old Android and BB10 use physical pixels in outerWidth/Height, which is what we need
    // New Android (4.0 and above) use CSS pixels, requiring devicePixelRatio multiplication
    // iOS lies about outerWidth/Height when zooming, but does expose CSS pixels in screen.width/height

    if (!iOS) {
        if (androidVersion > 3) return multiplyByPixelRatio(sizes);
        return sizes;
    }

    var isLandscape = window.orientation % 180;
    if (isLandscape) {
        sizes.height = screen.width;
        sizes.width = screen.height;
    } else {
        sizes.width = screen.width;
        sizes.height = screen.height;
    }

    return multiplyByPixelRatio(sizes);
};

Utils.waitForReady = function(doc, callback) {
    // Waits for `doc` to be ready, and then fires callback, passing
    // `doc`.

    // We may be in "loading" state by the time we get here, meaning we are
    // not ready to capture. Next step after "loading" is "interactive",
    // which is a valid state to start capturing on (except IE), and thus when ready
    // state changes once, we know we are good to start capturing.
    // Cannot rely on using DOMContentLoaded because this event prematurely fires
    // for some IE10s.
    var ready = false;
    
    var onReady = function() {
        if (!ready) {
            ready = true;
            iid && clearInterval(iid);
            callback(doc);
        }
    }

    // Backup with polling incase readystatechange doesn't fire
    // (happens with some Android 2.3 browsers)
    var iid = setInterval(function(){
        if (Utils.domIsReady(doc)) {
            onReady();
        }
    }, 100);

    doc.addEventListener("readystatechange", onReady, false);
};

return Utils;

}));

define('buildConfig',[], function() {
    return {
        buildDate: 1428602192541,
        cacheHashManifest: {"css/stylesheet.css":"dc254043","css/stylesheet.css.map":"912b61a3","js/ui.js":"cc625f4e","js/ui.js.map":"85ea2e1a","bower_components/deckard/dist/deckard.min.js":"8b1854e7"}
    }
});
define('adaptivejs/utils',[
    'mobifyjs/utils',
    'buildConfig',
], function(Utils, buildConfig) {

    var AdaptiveUtils = {};
    Utils.extend(AdaptiveUtils, Utils);

    /**
     *  Pulled from Lodash, because we only use these few functions.
     */
    AdaptiveUtils.isFunction = function(value) {
        return typeof value === 'function';
    };

    // fallback for older versions of Chrome and Safari
    if (AdaptiveUtils.isFunction(/x/)) {
        AdaptiveUtils.isFunction = function(value) {
            return typeof value === 'function' && Object.prototype.toString.call(value) === '[object Function]';
        };
    }

    AdaptiveUtils.isObject = function(value) {
        // check if the value is the ECMAScript language type of Object
        // http://es5.github.io/#x8
        // and avoid a V8 bug
        // https://code.google.com/p/v8/issues/detail?id=2291
        var type = typeof value;
        return value && (type === 'function' || type === 'object') || false;
    };

    AdaptiveUtils.isRegExp = function(value) {
        var type = typeof value;

        return value && (type === 'function' || type === 'object') &&
            Object.prototype.toString.call(value) === '[object RegExp]' || false;
    };

    /**
     *  Creates a script string that will load a.js
     */
    AdaptiveUtils.getAjs = function(name, template) {
        var qs = template ? 'm=1&t=' + template : 't=miss';

        return '<script src="//a.mobify.com/' + name + '/a.js#' + qs + '" async></script>';
    };

    /**
     * Determines if the supplied node is a Node type, or a Node type of
     * the node's window. On some browsers Nodes created within an iframe
     * are not instances of the root/parent document's Node class.
     */
    var isNode = function(node) {
        return (node instanceof Node) ||
               (node && node.ownerDocument && node.ownerDocument.defaultView &&
                (node instanceof node.ownerDocument.defaultView.Node));
    };

    /**
     *  Returns true if obj is a Zepto/jQuery object or a DOM node
     */
    AdaptiveUtils.isDOMLike = function(obj) {
        if (window.Zepto && Zepto.zepto.isZ(obj)) {
            return true;
        } else if (window.jQuery && obj instanceof jQuery.fn.constructor) {
            return true;
        } else if (isNode(obj)) {
            return true;
        }

        return obj instanceof HTMLElement;
    };

    /**
     *  Returns the url of the adaptive.js build file and caches it
     */
    var cachedBuildScript;
    AdaptiveUtils.getAdaptiveBuildScript = function() {
        try {
            // Get the first script on the page
            // If it's the build script, cache it and return it
            if (cachedBuildScript) {
                return cachedBuildScript;
            }
            var firstScript = document.getElementsByTagName('script')[0];
            if (/(mobify|adaptive)(\.min)?\.js/.test(firstScript.getAttribute('src'))) {
                cachedBuildScript = cachedBuildScript || firstScript;
                return cachedBuildScript;
            }
            return undefined;
        } catch (e) {
            console.error('Couldn\'t determine adaptivejs build file used. The mobify-tag may be placed incorrectly.');
        }
    };

    /**
     *  Grabs the location of the build so we can reference assets
     *  with absolute urls
     */
    AdaptiveUtils.getBuildOrigin = function() {
        var buildOrigin = '//localhost:8080/';
        var adaptiveBuildScript = this.getAdaptiveBuildScript();

        if (adaptiveBuildScript) {
            try {
                var adaptiveBuildSrc = adaptiveBuildScript.getAttribute('src');
                buildOrigin = adaptiveBuildSrc.replace(/\/[^\/]*$/, '/');
            } catch (e) {
                console.error('Couldn\'t determine adaptivejs build file used. The mobify-tag may be placed incorrectly.');
            }
        }
        return buildOrigin;
    };

    /**
     *  Returns the full url for the provided asset path
     *  including a cache breaker.
     *  basePath and cacheBreaker arguments are optional
     */
    AdaptiveUtils.getAssetUrl = function(path, baseUrl, cacheBreaker) {
        var hash = buildConfig.cacheHashManifest[path];

        // If path isn't found in the hashManifest, cache break with build date
        if (cacheBreaker === undefined) {
            cacheBreaker = hash ? hash : buildConfig.buildDate;
        }

        return (baseUrl || this.getBuildOrigin()) + path + '?' + cacheBreaker;
    };

    /**
     *  If the mobify-path cookie is present, then we are in debug mode
     */
    AdaptiveUtils.isDebug = function(cookie) {
        cookie = cookie || document.cookie;

        var match = /mobify-path=([^&;]*)/.exec(cookie);

        return !!match;
    };

    return AdaptiveUtils;

});

define('adaptivejs/logger',[
    'adaptivejs/utils'
], function(Utils) {

    var Logger = {};
    var TIMING_POINTS = Logger.TIMING_POINTS = 'adaptiveTimingPoints';

    /**
     *  Lets guard our calls to set item for two possible failure
     *  scenarios
     *    1) The device does not supportLocalStorage
     *    2) Local storage is full
     */
    var setItem = function(item, value) {
        if (!Utils.supportsLocalStorage()) {
            return;
        }
        try {
            return localStorage.setItem(item, value);
        } catch (e) {
            return;
        }
    };

    /**
     *  Setup the logger and initialize the start time
     *  Takes a debug argument and a start time,
     *  both of which are optional.
     */
    Logger.init = function(options) {
        options = options || {};
        this.points = {};
        var debug = options.debug !== undefined ? options.debug : false;
        var start = options.start || +new Date();

        // Make sure we aren't using any old logging points
        this.clearData();

        // Persist the debugger
        this.setDebugger(debug);

        // Tracks depth of recursion for output indentation
        Logger.stackDepth = 1;

        // Add the first timing point
        this.addTimingPoint('Start', {value: start});
    };

    /**
     *  Formats a name and data point into a nice logger entry
     */
    Logger.formatDataPoint = function(name, point) {
        var points = this.points || this.getJSONFromLocalStorage(TIMING_POINTS);
        var start = points.Start || 0;
        var diff = point - start;
        return name + ': ' + diff + 'ms';
    };

    /**
     *  Increase value of stack depth tracker
     */
    Logger.increaseStack = function() {
        this.stackDepth += 1;
    };

    /**
     *  Decrease value of stack depth tracker
     */
    Logger.decreaseStack = function() {
        this.stackDepth -= 1;
    };

    /**
     *  Remove logging data from local storage
     */
    Logger.clearData = function() {
        localStorage.removeItem(TIMING_POINTS);
    };

    /**
     *  Resets the debugger if you need to do it at a later state
     */
    Logger.setDebugger = function(debug) {
        this.debugMode = debug;
        setItem('debug', debug);
    };

    /**
     *  Uses the console to log the give message if debugMode is true
     *  Takes an optional logLevel argument to log errors or warnings
     */
    Logger.log = function(message, logLevel) {
        if (!this.debugMode) {
            return;
        }

        logLevel = logLevel || 'log';
        try {
            console[logLevel](message);
        } catch (e) {
            console.log(message);
        }
    };

    /**
     *  Adds a data point to timing point group.
     *
     *  `key` is required.
     *  `options.value` is optional
     *   (if not given, the current timestamp will be added)
     *  `options.namespace` is optional
     *   (if not given, will log key to top level points object)
     */
    Logger.addTimingPoint = function(key, options) {
        if (!this.debugMode) {
            return;
        }

        options = options || {};

        // Indent key based on it's stack depth
        // SJ TODO: There is an issue where stackDepth can be undefined when
        // using the Logger post-document.write. This needs to be addressed!
        key = new Array(this.stackDepth || 1).join('\t') + key;

        // In non-Webkit based browsers, the `points` object will get blown away due
        // to our use of `document.open`, thus if `points` is undefined, we will get
        // the logging information from localStorage.
        var points = this.points || this.getJSONFromLocalStorage(TIMING_POINTS) || {};
        var value = options.value || +new Date();
        var namespace = options.namespace;

        if (namespace) {
            points[namespace] = points[namespace] || {};
            points[namespace][key] = value;
        } else {
            points[key] = value;
        }
        this.saveJSONToLocalStorage(TIMING_POINTS, points);
    };

    /**
     * Deprecated function. Kept around for backwards compatibility.
     */
    Logger.addPoint = function(localStorageKey, key, options) {
        Logger.addTimingPoint(key, options);
    };

    /**
     *  Stringifies a JSON object then saves it to local storage
     */
    Logger.saveJSONToLocalStorage = function(name, collection) {
        setItem(name, JSON.stringify(collection));
    };

    /**
     *  Retrieves a JSON string from local storage and parses it into an object
     */
    Logger.getJSONFromLocalStorage = function(name) {
        if (!Utils.supportsLocalStorage()) {
            return;
        }
        try {
            var jsonData = localStorage.getItem(name);
            if (jsonData === null) {
                return null;
            }
            return JSON.parse(jsonData);
        } catch (e) {
            console.error('Error getting data from local storage:\n' + e);
            return;
        }
    };

    /**
     *  Formats a logGroup if supported
     */
    Logger.logGroup = function(group, name) {
        if (!this.debugMode) {
            return;
        }
        console.groupCollapsed ? console.groupCollapsed(name) : console.group(name);

        for (var key in group) {
            if (group.hasOwnProperty(key)) {
                // If the value is a string, parse it to JSON
                if (Object.prototype.toString.call(group[key]) === '[object Object]') {
                    this.logGroup(group[key], key);
                }
                else {
                    console.log(Logger.formatDataPoint(key, group[key]));
                }
            }
        }
        console.groupEnd();
    };

    /**
     *  Logs the content in a collapsed group
     */
    Logger.logCollapsed = function(groupName, content) {
        if (!this.debugMode) {
            return;
        }
        console.groupCollapsed ? console.groupCollapsed(groupName) : console.group(groupName);

        console.log(content);
        console.groupEnd();
    };

    /**
     *  Adds the DOMContentLoaded event to the data points object
     *  Name is optional
     */
    Logger.addDOMContentListener = function() {
        var self = this;
        document.addEventListener('DOMContentLoaded', function() {
            self.addTimingPoint('DOMContentLoaded');
        }, false);
    };

    /**
     *  Adds both document and window listeners as some browsers prefer one over
     *  the other. This is the same way jQuery handles this. Adds the point on
     *  which is fired first.
     */
    Logger.addOnLoadListener = function(callback) {
        var self = this;

        var addPageLoadPointCallback = function() {
            if (!this.pageLoaded) {
                this.pageLoaded = +new Date();
                self.addTimingPoint('Page Load', +new Date());
                callback && callback();
            }
        };

        document.addEventListener('load', addPageLoadPointCallback, false);
        window.addEventListener('load', addPageLoadPointCallback, false);
    };

    Logger.logTimingPoints = function() {
        var points = this.points || this.getJSONFromLocalStorage(TIMING_POINTS);
        this.logGroup(points, 'Timing Points');
    };

    return Logger;
});

define('adaptivejs/router',[
    'adaptivejs/logger',
    'adaptivejs/utils'
], function(Logger, Utils) {

    var Router = function() {
        this.routes = [];
    };

    /**
     * Ignore constant, which allows users to give semantic meaning to
     * opt out of a route.
     *
     * Example:
     *
     * router.add(function() {
     *      return window.location.href === 'http://yourdomain.com/dont-match-this'; // true if route should not be matched
     * }, Router.Ignore);
     * @type {boolean}
     */
    Router.Ignore = false;

    /**
     *  Creates a route from a function and view pair. Stores
     *  the result to be processed later on.
     *  Returns this to allow for chaining of calls to `router.add`
     */
    Router.prototype.add = function(func, view) {
        if (!Utils.isFunction(func)) {
            console.error('AdaptiveJS Router - Error - First argument to add must be a function');
        }

        if (Utils.isObject(view) && !view.hasOwnProperty('template')) {
            console.error('AdaptiveJS Router - Error - Second argument to add must be a View');
        }

        this.routes.push({func: func, view: view});

        return this;
    };

    // adds: function(routes) {
    //     // Map routes supplied and pass them in to add
    //     // TODO: Implement
    // },

    /**
     *  Evaluate a given route but make sure we don't bomb
     *  out if we hit an error.
     */
    Router.prototype.evalRoute = function(route) {
        var result;

        try {
            result = route.func(this.doc);
        } catch (e) {
            console.warn('Router error:', e.stack);
        }

        return result;
    };

    /**
     *  Grab all of the routes currently contained in the router
     */
    Router.prototype.getRoutes = function() {
        return this.routes;
    };

    /**
     *  Given a document, lets run through our routes and see
     *  which one matches.
     *  Returns the view of the matched route.
     */
    Router.prototype.resolve = function(document) {
        var result;
        var self = this;

        this.doc = document;

        for (var i = 0, l = this.routes.length; i < l; i++) {
            var route = this.routes[i];
            if (self.evalRoute(route)){
                result = route;
                break;
            }
        }

        Logger.addTimingPoint('Routes resolved');

        return result ? result.view : result;
    };

    /**
     *  Creates a function which checks to see if the given selector
     *  is found within the document
     */
    Router.selectorMatch = function(selector) {
        var self = this;
        return function(capturedDoc) {
            var result = capturedDoc.querySelectorAll(selector);

            return result.length ? result : false;
        };
    };

    /**
     * Actually just the identity function.
     * This is deprecated, mostly because it doesn't do anything :)
     */
    Router.jsMatch = function(func) {
        console.warn('The Router.jsMatch function is deprecated. Please use an anonymous function instead.');
        return func;
    };

    /**
     *  URLMatching functionality
     *  http://www.mobify.com/mobifyjs/docs/matching-to-urls/
     */
    Router.urlMatch = function(url) {
        if (!Utils.isRegExp(url)) {
            url = new RegExp(url);
        }

        return function() {
            return url.test(document.URL);
        };
    };

    return Router;
});

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define('resizeImages',['mobifyjs/utils'], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require('../mobifyjs-utils/utils.js'));
    } else {
        // Browser globals (root is window)
        root.ResizeImages = factory(root.Utils);
    }
}(this, function (Utils) {

var ResizeImages = window.ResizeImages = {};

var localStorageWebpKey = 'Mobify-Webp-Support-v2';

function persistWebpSupport(supported) {
    if (Utils.supportsLocalStorage()) {
        var webpSupport = {
            supported: supported,
            date: Date.now()
        };
        localStorage.setItem(localStorageWebpKey, JSON.stringify(webpSupport));
    }
}

/**
 * Synchronous WEBP detection using regular expressions
 * Credit to Ilya Grigorik for WEBP regex matching
 * https://github.com/igrigorik/webp-detect/blob/master/pagespeed.cc
 * Modified to exclude Android native browser on Android 4
 */
ResizeImages.userAgentWebpDetect = function(userAgent){
    var supportedRe = /(Android\s|Chrome\/|Opera9.8*Version\/..\.|Opera..\.)/i;
    var unsupportedVersionsRe = new RegExp('(Android\\s(0|1|2|3|(4(?!.*Chrome)))\\.)|(Chrome\\/[0-8]\\.)' +
                                '|(Chrome\\/9\\.0\\.)|(Chrome\\/1[4-6]\\.)|(Android\\sChrome\\/1.\\.)' +
                                '|(Android\\sChrome\\/20\\.)|(Chrome\\/(1.|20|21|22)\\.)' +
                                '|(Opera.*(Version/|Opera\\s)(10|11)\\.)', 'i');

    // Return false if browser is not supported
    if (!supportedRe.test(userAgent)) {
        return false;
    }

    // Return false if a specific browser version is not supported
    if (unsupportedVersionsRe.test(userAgent)) {
        return false;
    }
    return true;
};

/**
 * Asychronous WEB detection using a data uri.
 * Credit to Modernizer:
 * https://github.com/Modernizr/Modernizr/blob/fb76d75fbf97f715e666b55b8aa04e43ef809f5e/feature-detects/img-webp.js
 */
ResizeImages.dataUriWebpDetect = function(callback) {
    var image = new Image();
    image.onload = function() {
        var support = (image.width === 1) ? true : false;
        persistWebpSupport(support);
        if (callback) callback(support);
        };
    // this webp generated with Mobify image resizer from 
    // http://upload.wikimedia.org/wikipedia/commons/c/ca/1x1.png passed 
    // through the Mobify Image resizer: 
    // http://ir0.mobify.com/webp/http://upload.wikimedia.org/wikipedia/commons/c/ca/1x1.png
    image.src = 'data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQABgBwlpAADcAD+/gbQAA==';
};

/**
 * Detect WEBP support sync and async. Do our best to determine support
 * with regex, and use data-uri method for future proofing.
 * (note: async test will not complete before first run of `resize`,
 * since onload of detector image won't fire until document is complete)
 * Also caches results for WEBP support in localStorage.
 */
ResizeImages.supportsWebp = function(callback) {

    // Return early if we have persisted WEBP support
    if (Utils.supportsLocalStorage()) {
        
        // Check if WEBP support has already been detected
        var webpSupport;
        var storedSupport = localStorage.getItem(localStorageWebpKey);

        // Only JSON.parse if storedSupport is not null, or else things
        // will break on Android 2.3
        storedSupport && (webpSupport = JSON.parse(storedSupport));
        
        // Grab previously cached support value in localStorage.
        if (webpSupport && (Date.now() - webpSupport.date < 604800000)) {
            return webpSupport.supported;
        }
    }

    // Run async WEBP detection for future proofing
    // This test may not finish running before the first call of `resize`
    ResizeImages.dataUriWebpDetect(callback);

    // Run regex based synchronous WEBP detection
    var support = ResizeImages.userAgentWebpDetect(navigator.userAgent);

    persistWebpSupport(support);

    return support;

};

/**
 * Returns a URL suitable for use with the 'ir' service.
 */
ResizeImages.getImageURL = function(url, options) {
    var opts = options;
    if (!opts) {
        opts = ResizeImages.processOptions();
    }
    var bits = [opts.proto + opts.host];

    if (opts.projectName) {
        var projectId = "project-" + opts.projectName;
        bits.push(projectId);
    }

    if (opts.cacheBreaker) {
        bits.push('cb' + opts.cacheBreaker);
    }

    if (opts.cacheHours) {
        bits.push('c' + opts.cacheHours);
    }

    if (opts.format) {
        bits.push(opts.format + (opts.quality || ''));
    } else if (opts.quality) {
        bits.push('q' + opts.quality);
    }

    if (opts.maxWidth) {
        bits.push(opts.maxWidth);

        if (opts.maxHeight) {
            bits.push(opts.maxHeight);
        }
    }

    bits.push(url);
    return bits.join('/');
};

/**
 * Replaces src attr of passed element with value of running `getImageUrl` on it
 * Allows overriding of img.getAttribute(x-src) with srcVal
 */

ResizeImages._rewriteSrcAttribute = function(element, opts, srcVal){
    srcVal = element.getAttribute(opts.sourceAttribute) || srcVal;
    if (srcVal) {
        var url = Utils.absolutify(srcVal);
        if (Utils.httpUrl(url)) {
            if (opts.onerror) {
                element.setAttribute('onerror', opts.onerror);
            }
            element.setAttribute(opts.targetAttribute, ResizeImages.getImageURL(url, opts));
            element.setAttribute('data-orig-src', srcVal);
            // if using resize when not capturing, remove the sourceAttribute
            // as long as it's not "src", which is the target attribute used
            // when not capturing.
            if (!capturing && opts.sourceAttribute != opts.targetAttribute) {
                element.removeAttribute(opts.sourceAttribute);
            }
        }
    }
};

/**
 * Modifies src of `<source />` children of a `<picture>` element to use image 
 * resizer
 */
ResizeImages._resizeSourceElement = function(element, opts, rootSrc) {
    // Grab optional width override
    var width = element.getAttribute('data-width');
    var localOpts = opts;
    if (width) {
        localOpts = Utils.clone(opts);
        localOpts.maxWidth = width;
    }
    // pass along rootSrc if defined on `picture` element
    ResizeImages._rewriteSrcAttribute(element, localOpts, rootSrc);
};

/**
 * Takes a picture element and calls _resizeSourceElement on its `<source />` 
 * children
 */
ResizeImages._crawlPictureElement = function(el, opts) {
    var sources = el.getElementsByTagName('source');
    // If source elements are erased from the dom, leave the
    // picture element alone.
    if (sources.length === 0 || el.hasAttribute('mobify-optimized')) {
        return;
    }
    el.setAttribute('mobify-optimized', '');

    // Grab optional `data-src` attribute on `picture`.
    // Used for preventing writing the same src multiple times for
    // different `source` elements.
    var rootSrc = el.getAttribute('data-src');

    // resize the sources
    for(var i =  0, len = sources.length; i < len; i++) {
        ResizeImages._resizeSourceElement(sources[i], opts, rootSrc);
    }
};

/**
 * Searches a list of target dimensions for the smallest one that is greater than 
 * the passed value and return it, or return the greatst value if none are 
 * greater.
 *
 * Popular device resolutions: 
 * iPhone 3Gs - 320x480
 * iPhone 4 - 640x960
 * iPhone 5 - 650x1156
 * 
 * Galaxy SIII/Nexus 4/Nexus 7 - 720x1280
 * Galaxy SIV/Nexus 5 - 1080x1920
 * 
 * iPad (non-retina) - 1024x768
 * iPad (retina) - 2048x1536
 *
 * A larger list of target dimensions would include 720px, 800px, 1024px, 1280px 
 * and 1920px but they have been omitted due tot heir proximity to other, larger 
 * values
 */
var targetDims = [320, 640, 768, 1080, 1536, 2048, 4000];
ResizeImages._getBinnedDimension = function(dim) {
    var resultDim = 0;

    for (var i = 0, len = targetDims.length; i < len; i++) {
        resultDim = targetDims[i];
        if (resultDim >= dim) {
            break;
        }
    }
    return resultDim;
};

/**
 * Returns a boolean that indicates whether images should be resized.
 * Looks for the viewport meta tag and parses it to determine whether the
 * website is responsive (the viewport is set to the device's width). This
 * ensures that images that are part of a larger viewport are not scaled.
 */
ResizeImages._shouldResize = function(document) {
    var metaViewport = Utils.getMetaViewportProperties(document);
    if (!metaViewport) {
        return false;
    }

    // It's complicated, but what we want to know is whether the viewport
    // matches the 'ideal viewport'. If either `initial-scale` is 1 or `width`
    // is device-width or both, then the viewport will match the 'ideal
    // viewport'. There are a few other special circumstances under which the
    // viewport could be ideal, but we can't test for them.
    //
    // See: http://www.quirksmode.org/mobile/metaviewport/

    // Ideal viewport when width=device-width
    if (!metaViewport['initial-scale'] && metaViewport['width']) {
        return metaViewport['width'] == 'device-width';
    }

    // Ideal viewport when initial-scale=1
    if (!metaViewport['width'] && metaViewport['initial-scale']) {
        return metaViewport['initial-scale'] == '1';
    }

    // Ideal viewport when width=device-width and the intial-scale is 1 or more
    // (in that case it's just zoomed)
    if (metaViewport['width'] && metaViewport['initial-scale']) {
        initialScale = parseInt(metaViewport['initial-scale'], 10);
        return initialScale >= 1 && metaViewport['width'] == 'device-width';
    }

    return false;
};

/**
 * Processes options passed to `resize()`. Takes an options object that 
 * potentially has height and width set in css pixels, returns an object where 
 * they are expressed in device pixels, and other default options are set.
 */
ResizeImages.processOptions = function(options) {
    var opts = Utils.clone(ResizeImages.defaults);
    if (options) {
        Utils.extend(opts, options);
    }

    // A null value for `resize` triggers the auto detect functionality. This
    // uses the document to determine whether images should be resized and sets
    // it as the new default.
    if (opts.resize === null && options.document) {
        var resize = ResizeImages._shouldResize(options.document);
        ResizeImages.defaults.resize = opts.resize = resize;
    }

    if (!opts.format && opts.webp) {
        opts.format = "webp";
    }

    // Without `resize` images are served through IR without changing their dimensions
    if (!opts.resize) {
        opts.maxWidth = opts.maxHeight = opts.devicePixelRatio = null;
    }
    else {
        var dpr = opts.devicePixelRatio || window.devicePixelRatio;

        var screenSize = Utils.getPhysicalScreenSize(dpr);

        // If maxHeight/maxWidth are not specified, use screen dimensions
        // in device pixels
        var width = opts.maxWidth || ResizeImages._getBinnedDimension(screenSize.width);
        var height = opts.maxHeight || undefined;

        // Otherwise, compute device pixels
        if (dpr && opts.maxWidth) {
            width = width * dpr;
            if (opts.maxHeight) {
                height = height * dpr;
            }
        }

        // round up in case of non-integer device pixel ratios
        opts.maxWidth = Math.ceil(width);
        if (opts.maxHeight && height) {
            opts.maxHeight = Math.ceil(height);
        }
    }

    return opts;
};

/**
 * Searches the collection for image elements and modifies them to use
 * the Image Resize service. Pass `options` to modify how the images are 
 * resized.
 */
ResizeImages.resize = function(elements, options) {
    // Return early if elements is empty
    if (!elements.length) {
        return;
    }

    // Supplement `options` with the document from the first element
    if (options && !options.document) {
        options.document = elements[0].ownerDocument;
    }
    var opts = ResizeImages.processOptions(options);

    for(var i=0; i < elements.length; i++) {
        var element = elements[i];

        // For an `img`, simply modify the src attribute
        if (element.nodeName === 'IMG' && !element.hasAttribute('mobify-optimized')) {
            element.setAttribute('mobify-optimized', '');
            ResizeImages._rewriteSrcAttribute(element, opts);
        }
        // For a `picture`, (potentially) nuke src on `img`, and
        // pass all `source` elements into modifyImages recursively
        else if (element.nodeName === 'PICTURE') {
            ResizeImages._crawlPictureElement(element, opts);
        }
    }

    return elements;
};

ResizeImages.restoreOriginalSrc = function(event) {
    var origSrc;
    event.target.removeAttribute('onerror'); // remove ourselves
    origSrc = event.target.getAttribute('data-orig-src');
    if (origSrc) {
        event.target.setAttribute('src', origSrc);
    }
};

var capturing = window.Mobify && window.Mobify.capturing || false;

ResizeImages.defaults = {
    cacheHours: 8,
    proto: '//',
    host: 'ir0.mobify.com',
    projectName: "oss-" + location.hostname.replace(/[^\w]/g, '-'),
    sourceAttribute: "x-src",
    targetAttribute: (capturing ? "x-src" : "src"),
    webp: ResizeImages.supportsWebp(),
    resize: true,
    onerror: 'ResizeImages.restoreOriginalSrc(event);'
};

ResizeImages.profiles = {
    SHORT_CACHE: {
        cacheHours: 2
    },
    LONG_CACHE: {
        cacheHours: 168
    }
};

return ResizeImages;
}));

define('text',{});
define('json',{load: function(id){throw new Error("Dynamic load not allowed: " + id);}});

define("json!package", function(){ return {
    "name": "template-split",
    "siteUrl": "",
    "version": "0.0.1",
    "dependencies": {
        "adaptivejs": "1.2.0",
        "connect": "2.3.4",
        "grunt": "0.4.2",
        "grunt-concurrent": "0.4.3",
        "mocha": "1.14.0",
        "chai": "1.9.0",
        "mobify-chai-assertions": "^1.0.0",
        "lodash": "~2.4.1",
        "grunt-contrib-sass": "0.8.1",
        "grunt-autoprefixer": "2.0.0",
        "nightwatch": "0.5.36",
        "nightwatch-commands": "1.0.0",
        "grunt-eslint": "^2.1.0",
        "mobify-code-style": "2.0.1"
}
}
;});

define('adaptivejs/defaults',[
    'adaptivejs/utils',
    'json!package'
], function(Utils, package) {
    var projectName;

    try {
        projectName = package.name;
    } catch (e) {
        console.error('Couldn\'t determine the project name. Be sure that is in defined in the package.json file.');
    }

    /**
     *  Returns an object with some useful defaults that can be used
     *  to build up a more complex context
     */
    function getContext() {
        var defaultContext = {};
        var config = {};

        config.projectName = projectName;
        config.isDebug = Utils.isDebug();
        config.adaptiveBuildScript = Utils.getAdaptiveBuildScript();
        config.adaptiveBuild = config.adaptiveBuildScript && config.adaptiveBuildScript.getAttribute('src');
        config.buildOrigin = Utils.getBuildOrigin();
        config.ajs = function(context) {
            return Utils.getAjs(config.projectName, context.templateName);
        };

        defaultContext.config = config;
        return defaultContext;
    }

    return {
        'projectName': projectName,
        'getContext': getContext
    };

});

define('includes/_header',['$'], function($) {
    return {
        context: {
            title: function() {
                var $title = $('title');
                return $title.length > 0 ? $title.text() : 'no title found';
            }
        }
    };
});

define('includes/_footer',['$'], function($) {
    return {
        context: {
            documentationLink: function() {
                return {
                    text: 'Adaptive.js Documentation',
                    href: 'https://cloud.mobify.com/docs/adaptivejs/'
                };
            }
        }
    };
});

define('dust',{load: function(id){throw new Error("Dynamic load not allowed: " + id);}});
/*! Dust - Asynchronous Templating - v2.3.3
* http://linkedin.github.io/dustjs/
* Copyright (c) 2014 Aleksander Williams; Released under the MIT License */
(function(root) {
  var dust = {},
      NONE = 'NONE',
      ERROR = 'ERROR',
      WARN = 'WARN',
      INFO = 'INFO',
      DEBUG = 'DEBUG',
      loggingLevels = [DEBUG, INFO, WARN, ERROR, NONE],
      EMPTY_FUNC = function() {},
      logger = EMPTY_FUNC,
      loggerContext = this;

  dust.debugLevel = NONE;
  dust.silenceErrors = false;

  // Try to find the console logger in global scope
  if (root && root.console && root.console.log) {
    logger = root.console.log;
    loggerContext = root.console;
  }

  /**
   * If dust.isDebug is true, Log dust debug statements, info statements, warning statements, and errors.
   * This default implementation will print to the console if it exists.
   * @param {String|Error} message the message to print/throw
   * @param {String} type the severity of the message(ERROR, WARN, INFO, or DEBUG)
   * @public
   */
  dust.log = function(message, type) {
    if(dust.isDebug && dust.debugLevel === NONE) {
      logger.call(loggerContext, '[!!!DEPRECATION WARNING!!!]: dust.isDebug is deprecated.  Set dust.debugLevel instead to the level of logging you want ["debug","info","warn","error","none"]');
      dust.debugLevel = INFO;
    }

    type = type || INFO;
    if (loggingLevels.indexOf(type) >= loggingLevels.indexOf(dust.debugLevel)) {
      if(!dust.logQueue) {
        dust.logQueue = [];
      }
      dust.logQueue.push({message: message, type: type});
      logger.call(loggerContext, '[DUST ' + type + ']: ' + message);
    }

    if (!dust.silenceErrors && type === ERROR) {
      if (typeof message === 'string') {
        throw new Error(message);
      } else {
        throw message;
      }
    }
  };

  /**
   * If debugging is turned on(dust.isDebug=true) log the error message and throw it.
   * Otherwise try to keep rendering.  This is useful to fail hard in dev mode, but keep rendering in production.
   * @param {Error} error the error message to throw
   * @param {Object} chunk the chunk the error was thrown from
   * @public
   */
  dust.onError = function(error, chunk) {
    logger.call(loggerContext, '[!!!DEPRECATION WARNING!!!]: dust.onError will no longer return a chunk object.');
    dust.log(error.message || error, ERROR);
    if(!dust.silenceErrors) {
      throw error;
    } else {
      return chunk;
    }
  };

  dust.helpers = {};

  dust.cache = {};

  dust.register = function(name, tmpl) {
    if (!name) {
      return;
    }
    dust.cache[name] = tmpl;
  };

  dust.render = function(name, context, callback) {
    var chunk = new Stub(callback).head;
    try {
      dust.load(name, chunk, Context.wrap(context, name)).end();
    } catch (err) {
      dust.log(err, ERROR);
    }
  };

  dust.stream = function(name, context) {
    var stream = new Stream();
    dust.nextTick(function() {
      try {
        dust.load(name, stream.head, Context.wrap(context, name)).end();
      } catch (err) {
        dust.log(err, ERROR);
      }
    });
    return stream;
  };

  dust.renderSource = function(source, context, callback) {
    return dust.compileFn(source)(context, callback);
  };

  dust.compileFn = function(source, name) {
    // name is optional. When name is not provided the template can only be rendered using the callable returned by this function.
    // If a name is provided the compiled template can also be rendered by name.
    name = name || null;
    var tmpl = dust.loadSource(dust.compile(source, name));
    return function(context, callback) {
      var master = callback ? new Stub(callback) : new Stream();
      dust.nextTick(function() {
        if(typeof tmpl === 'function') {
          tmpl(master.head, Context.wrap(context, name)).end();
        }
        else {
          dust.log(new Error('Template [' + name + '] cannot be resolved to a Dust function'), ERROR);
        }
      });
      return master;
    };
  };

  dust.load = function(name, chunk, context) {
    var tmpl = dust.cache[name];
    if (tmpl) {
      return tmpl(chunk, context);
    } else {
      if (dust.onLoad) {
        return chunk.map(function(chunk) {
          dust.onLoad(name, function(err, src) {
            if (err) {
              return chunk.setError(err);
            }
            if (!dust.cache[name]) {
              dust.loadSource(dust.compile(src, name));
            }
            dust.cache[name](chunk, context).end();
          });
        });
      }
      return chunk.setError(new Error('Template Not Found: ' + name));
    }
  };

  dust.loadSource = function(source, path) {
    return eval(source);
  };

  if (Array.isArray) {
    dust.isArray = Array.isArray;
  } else {
    dust.isArray = function(arr) {
      return Object.prototype.toString.call(arr) === '[object Array]';
    };
  }

  dust.nextTick = (function() {
    return function(callback) {
      setTimeout(callback,0);
    };
  } )();

  dust.isEmpty = function(value) {
    if (dust.isArray(value) && !value.length) {
      return true;
    }
    if (value === 0) {
      return false;
    }
    return (!value);
  };

  // apply the filter chain and return the output string
  dust.filter = function(string, auto, filters) {
    if (filters) {
      for (var i=0, len=filters.length; i<len; i++) {
        var name = filters[i];
        if (name === 's') {
          auto = null;
          dust.log('Using unescape filter on [' + string + ']', DEBUG);
        }
        else if (typeof dust.filters[name] === 'function') {
          string = dust.filters[name](string);
        }
        else {
          dust.log('Invalid filter [' + name + ']', WARN);
        }
      }
    }
    // by default always apply the h filter, unless asked to unescape with |s
    if (auto) {
      string = dust.filters[auto](string);
    }
    return string;
  };

  dust.filters = {
    h: function(value) { return dust.escapeHtml(value); },
    j: function(value) { return dust.escapeJs(value); },
    u: encodeURI,
    uc: encodeURIComponent,
    js: function(value) {
      if (!JSON) {
        dust.log('JSON is undefined.  JSON stringify has not been used on [' + value + ']', WARN);
        return value;
      } else {
        return JSON.stringify(value);
      }
    },
    jp: function(value) {
      if (!JSON) {dust.log('JSON is undefined.  JSON parse has not been used on [' + value + ']', WARN);
        return value;
      } else {
        return JSON.parse(value);
      }
    }
  };

  function Context(stack, global, blocks, templateName) {
    this.stack  = stack;
    this.global = global;
    this.blocks = blocks;
    this.templateName = templateName;
  }

  dust.makeBase = function(global) {
    return new Context(new Stack(), global);
  };

  Context.wrap = function(context, name) {
    if (context instanceof Context) {
      return context;
    }
    return new Context(new Stack(context), {}, null, name);
  };

  /**
   * Public API for getting a value from the context.
   * @method get
   * @param {string|array} path The path to the value. Supported formats are:
   * 'key'
   * 'path.to.key'
   * '.path.to.key'
   * ['path', 'to', 'key']
   * ['key']
   * @param {boolean} [cur=false] Boolean which determines if the search should be limited to the
   * current context (true), or if get should search in parent contexts as well (false).
   * @public
   * @returns {string|object}
   */
  Context.prototype.get = function(path, cur) {
    if (typeof path === 'string') {
      if (path[0] === '.') {
        cur = true;
        path = path.substr(1);
      }
      path = path.split('.');
    }
    return this._get(cur, path);
  };

  /**
   * Get a value from the context
   * @method _get
   * @param {boolean} cur Get only from the current context
   * @param {array} down An array of each step in the path
   * @private
   * @return {string | object}
   */
  Context.prototype._get = function(cur, down) {
    var ctx = this.stack,
        i = 1,
        value, first, len, ctxThis;
    dust.log('Searching for reference [{' + down.join('.') + '}] in template [' + this.getTemplateName() + ']', DEBUG);
    first = down[0];
    len = down.length;

    if (cur && len === 0) {
      ctxThis = ctx;
      ctx = ctx.head;
    } else {
      if (!cur) {
        // Search up the stack for the first value
        while (ctx) {
          if (ctx.isObject) {
            ctxThis = ctx.head;
            value = ctx.head[first];
            if (value !== undefined) {
              break;
            }
          }
          ctx = ctx.tail;
        }

        if (value !== undefined) {
          ctx = value;
        } else {
          ctx = this.global ? this.global[first] : undefined;
        }
      } else {
        // if scope is limited by a leading dot, don't search up the tree
        ctx = ctx.head[first];
      }

      while (ctx && i < len) {
        ctxThis = ctx;
        ctx = ctx[down[i]];
        i++;
      }
    }

    // Return the ctx or a function wrapping the application of the context.
    if (typeof ctx === 'function') {
      var fn = function() {
        try {
          return ctx.apply(ctxThis, arguments);
        } catch (err) {
          return dust.log(err, ERROR);
        }
      };
      fn.isFunction = true;
      return fn;
    } else {
      if (ctx === undefined) {
        dust.log('Cannot find the value for reference [{' + down.join('.') + '}] in template [' + this.getTemplateName() + ']');
      }
      return ctx;
    }
  };

  Context.prototype.getPath = function(cur, down) {
    return this._get(cur, down);
  };

  Context.prototype.push = function(head, idx, len) {
    return new Context(new Stack(head, this.stack, idx, len), this.global, this.blocks, this.getTemplateName());
  };

  Context.prototype.rebase = function(head) {
    return new Context(new Stack(head), this.global, this.blocks, this.getTemplateName());
  };

  Context.prototype.current = function() {
    return this.stack.head;
  };

  Context.prototype.getBlock = function(key, chk, ctx) {
    if (typeof key === 'function') {
      var tempChk = new Chunk();
      key = key(tempChk, this).data.join('');
    }

    var blocks = this.blocks;

    if (!blocks) {
      dust.log('No blocks for context[{' + key + '}] in template [' + this.getTemplateName() + ']', DEBUG);
      return;
    }
    var len = blocks.length, fn;
    while (len--) {
      fn = blocks[len][key];
      if (fn) {
        return fn;
      }
    }
  };

  Context.prototype.shiftBlocks = function(locals) {
    var blocks = this.blocks,
        newBlocks;

    if (locals) {
      if (!blocks) {
        newBlocks = [locals];
      } else {
        newBlocks = blocks.concat([locals]);
      }
      return new Context(this.stack, this.global, newBlocks, this.getTemplateName());
    }
    return this;
  };

  Context.prototype.getTemplateName = function() {
    return this.templateName;
  };

  function Stack(head, tail, idx, len) {
    this.tail = tail;
    this.isObject = head && typeof head === 'object';
    this.head = head;
    this.index = idx;
    this.of = len;
  }

  function Stub(callback) {
    this.head = new Chunk(this);
    this.callback = callback;
    this.out = '';
  }

  Stub.prototype.flush = function() {
    var chunk = this.head;

    while (chunk) {
      if (chunk.flushable) {
        this.out += chunk.data.join(''); //ie7 perf
      } else if (chunk.error) {
        this.callback(chunk.error);
        dust.log('Chunk error [' + chunk.error + '] thrown. Ceasing to render this template.', WARN);
        this.flush = EMPTY_FUNC;
        return;
      } else {
        return;
      }
      chunk = chunk.next;
      this.head = chunk;
    }
    this.callback(null, this.out);
  };

  function Stream() {
    this.head = new Chunk(this);
  }

  Stream.prototype.flush = function() {
    var chunk = this.head;

    while(chunk) {
      if (chunk.flushable) {
        this.emit('data', chunk.data.join('')); //ie7 perf
      } else if (chunk.error) {
        this.emit('error', chunk.error);
        dust.log('Chunk error [' + chunk.error + '] thrown. Ceasing to render this template.', WARN);
        this.flush = EMPTY_FUNC;
        return;
      } else {
        return;
      }
      chunk = chunk.next;
      this.head = chunk;
    }
    this.emit('end');
  };

  Stream.prototype.emit = function(type, data) {
    if (!this.events) {
      dust.log('No events to emit', INFO);
      return false;
    }
    var handler = this.events[type];
    if (!handler) {
      dust.log('Event type [' + type + '] does not exist', WARN);
      return false;
    }
    if (typeof handler === 'function') {
      handler(data);
    } else if (dust.isArray(handler)) {
      var listeners = handler.slice(0);
      for (var i = 0, l = listeners.length; i < l; i++) {
        listeners[i](data);
      }
    } else {
      dust.log('Event Handler [' + handler + '] is not of a type that is handled by emit', WARN);
    }
  };

  Stream.prototype.on = function(type, callback) {
    if (!this.events) {
      this.events = {};
    }
    if (!this.events[type]) {
      dust.log('Event type [' + type + '] does not exist. Using just the specified callback.', WARN);
      if(callback) {
        this.events[type] = callback;
      } else {
        dust.log('Callback for type [' + type + '] does not exist. Listener not registered.', WARN);
      }
    } else if(typeof this.events[type] === 'function') {
      this.events[type] = [this.events[type], callback];
    } else {
      this.events[type].push(callback);
    }
    return this;
  };

  Stream.prototype.pipe = function(stream) {
    this.on('data', function(data) {
      try {
        stream.write(data, 'utf8');
      } catch (err) {
        dust.log(err, ERROR);
      }
    }).on('end', function() {
      try {
        return stream.end();
      } catch (err) {
        dust.log(err, ERROR);
      }
    }).on('error', function(err) {
      stream.error(err);
    });
    return this;
  };

  function Chunk(root, next, taps) {
    this.root = root;
    this.next = next;
    this.data = []; //ie7 perf
    this.flushable = false;
    this.taps = taps;
  }

  Chunk.prototype.write = function(data) {
    var taps  = this.taps;

    if (taps) {
      data = taps.go(data);
    }
    this.data.push(data);
    return this;
  };

  Chunk.prototype.end = function(data) {
    if (data) {
      this.write(data);
    }
    this.flushable = true;
    this.root.flush();
    return this;
  };

  Chunk.prototype.map = function(callback) {
    var cursor = new Chunk(this.root, this.next, this.taps),
        branch = new Chunk(this.root, cursor, this.taps);

    this.next = branch;
    this.flushable = true;
    callback(branch);
    return cursor;
  };

  Chunk.prototype.tap = function(tap) {
    var taps = this.taps;

    if (taps) {
      this.taps = taps.push(tap);
    } else {
      this.taps = new Tap(tap);
    }
    return this;
  };

  Chunk.prototype.untap = function() {
    this.taps = this.taps.tail;
    return this;
  };

  Chunk.prototype.render = function(body, context) {
    return body(this, context);
  };

  Chunk.prototype.reference = function(elem, context, auto, filters) {
    if (typeof elem === 'function') {
      elem.isFunction = true;
      // Changed the function calling to use apply with the current context to make sure
      // that "this" is wat we expect it to be inside the function
      elem = elem.apply(context.current(), [this, context, null, {auto: auto, filters: filters}]);
      if (elem instanceof Chunk) {
        return elem;
      }
    }
    if (!dust.isEmpty(elem)) {
      return this.write(dust.filter(elem, auto, filters));
    } else {
      return this;
    }
  };

  Chunk.prototype.section = function(elem, context, bodies, params) {
    // anonymous functions
    if (typeof elem === 'function') {
      elem = elem.apply(context.current(), [this, context, bodies, params]);
      // functions that return chunks are assumed to have handled the body and/or have modified the chunk
      // use that return value as the current chunk and go to the next method in the chain
      if (elem instanceof Chunk) {
        return elem;
      }
    }
    var body = bodies.block,
        skip = bodies['else'];

    // a.k.a Inline parameters in the Dust documentations
    if (params) {
      context = context.push(params);
    }

    /*
    Dust's default behavior is to enumerate over the array elem, passing each object in the array to the block.
    When elem resolves to a value or object instead of an array, Dust sets the current context to the value
    and renders the block one time.
    */
    //non empty array is truthy, empty array is falsy
    if (dust.isArray(elem)) {
      if (body) {
        var len = elem.length, chunk = this;
        if (len > 0) {
          // any custom helper can blow up the stack
          // and store a flattened context, guard defensively
          if(context.stack.head) {
            context.stack.head['$len'] = len;
          }
          for (var i=0; i<len; i++) {
            if(context.stack.head) {
              context.stack.head['$idx'] = i;
            }
            chunk = body(chunk, context.push(elem[i], i, len));
          }
          if(context.stack.head) {
            context.stack.head['$idx'] = undefined;
            context.stack.head['$len'] = undefined;
          }
          return chunk;
        }
        else if (skip) {
          return skip(this, context);
        }
      }
    } else if (elem  === true) {
     // true is truthy but does not change context
      if (body) {
        return body(this, context);
      }
    } else if (elem || elem === 0) {
       // everything that evaluates to true are truthy ( e.g. Non-empty strings and Empty objects are truthy. )
       // zero is truthy
       // for anonymous functions that did not returns a chunk, truthiness is evaluated based on the return value
      if (body) {
        return body(this, context.push(elem));
      }
     // nonexistent, scalar false value, scalar empty string, null,
     // undefined are all falsy
    } else if (skip) {
      return skip(this, context);
    }
    dust.log('Not rendering section (#) block in template [' + context.getTemplateName() + '], because above key was not found', DEBUG);
    return this;
  };

  Chunk.prototype.exists = function(elem, context, bodies) {
    var body = bodies.block,
        skip = bodies['else'];

    if (!dust.isEmpty(elem)) {
      if (body) {
        return body(this, context);
      }
    } else if (skip) {
      return skip(this, context);
    }
    dust.log('Not rendering exists (?) block in template [' + context.getTemplateName() + '], because above key was not found', DEBUG);
    return this;
  };

  Chunk.prototype.notexists = function(elem, context, bodies) {
    var body = bodies.block,
        skip = bodies['else'];

    if (dust.isEmpty(elem)) {
      if (body) {
        return body(this, context);
      }
    } else if (skip) {
      return skip(this, context);
    }
    dust.log('Not rendering not exists (^) block check in template [' + context.getTemplateName() + '], because above key was found', DEBUG);
    return this;
  };

  Chunk.prototype.block = function(elem, context, bodies) {
    var body = bodies.block;

    if (elem) {
      body = elem;
    }

    if (body) {
      return body(this, context);
    }
    return this;
  };

  Chunk.prototype.partial = function(elem, context, params) {
    var partialContext;
    //put the params context second to match what section does. {.} matches the current context without parameters
    // start with an empty context
    partialContext = dust.makeBase(context.global);
    partialContext.blocks = context.blocks;
    if (context.stack && context.stack.tail){
      // grab the stack(tail) off of the previous context if we have it
      partialContext.stack = context.stack.tail;
    }
    if (params){
      //put params on
      partialContext = partialContext.push(params);
    }

    if(typeof elem === 'string') {
      partialContext.templateName = elem;
    }

    //reattach the head
    partialContext = partialContext.push(context.stack.head);

    var partialChunk;
    if (typeof elem === 'function') {
      partialChunk = this.capture(elem, partialContext, function(name, chunk) {
        partialContext.templateName = partialContext.templateName || name;
        dust.load(name, chunk, partialContext).end();
      });
    } else {
      partialChunk = dust.load(elem, this, partialContext);
    }
    return partialChunk;
  };

  Chunk.prototype.helper = function(name, context, bodies, params) {
    var chunk = this;
    // handle invalid helpers, similar to invalid filters
    try {
      if(dust.helpers[name]) {
        return dust.helpers[name](chunk, context, bodies, params);
      } else {
        dust.log('Invalid helper [' + name + ']', WARN);
        return chunk;
      }
    } catch (err) {
      dust.log(err, ERROR);
      return chunk;
    }
  };

  Chunk.prototype.capture = function(body, context, callback) {
    return this.map(function(chunk) {
      var stub = new Stub(function(err, out) {
        if (err) {
          chunk.setError(err);
        } else {
          callback(out, chunk);
        }
      });
      body(stub.head, context).end();
    });
  };

  Chunk.prototype.setError = function(err) {
    this.error = err;
    this.root.flush();
    return this;
  };

  function Tap(head, tail) {
    this.head = head;
    this.tail = tail;
  }

  Tap.prototype.push = function(tap) {
    return new Tap(tap, this);
  };

  Tap.prototype.go = function(value) {
    var tap = this;

    while(tap) {
      value = tap.head(value);
      tap = tap.tail;
    }
    return value;
  };

  var HCHARS = new RegExp(/[&<>\"\']/),
      AMP    = /&/g,
      LT     = /</g,
      GT     = />/g,
      QUOT   = /\"/g,
      SQUOT  = /\'/g;

  dust.escapeHtml = function(s) {
    if (typeof s === 'string') {
      if (!HCHARS.test(s)) {
        return s;
      }
      return s.replace(AMP,'&amp;').replace(LT,'&lt;').replace(GT,'&gt;').replace(QUOT,'&quot;').replace(SQUOT, '&#39;');
    }
    return s;
  };

  var BS = /\\/g,
      FS = /\//g,
      CR = /\r/g,
      LS = /\u2028/g,
      PS = /\u2029/g,
      NL = /\n/g,
      LF = /\f/g,
      SQ = /'/g,
      DQ = /"/g,
      TB = /\t/g;

  dust.escapeJs = function(s) {
    if (typeof s === 'string') {
      return s
        .replace(BS, '\\\\')
        .replace(FS, '\\/')
        .replace(DQ, '\\"')
        .replace(SQ, '\\\'')
        .replace(CR, '\\r')
        .replace(LS, '\\u2028')
        .replace(PS, '\\u2029')
        .replace(NL, '\\n')
        .replace(LF, '\\f')
        .replace(TB, '\\t');
    }
    return s;
  };


  if (typeof exports === 'object') {
    module.exports = dust;
  } else {
    root.dust = dust;
  }

})(this);


define("dust-core", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.dust;
    };
}(this)));

define('dust-custom',['dust-core', 'adaptivejs/utils'], function(dust, Utils) {

    var likeArray = function(candidate) {
        return (typeof candidate !== 'string') && (typeof candidate.length === 'number') && (!candidate.tagName);
    };

    var nodeName = function(node) {
        return node.nodeName.toLowerCase();
    };

    var escapeQuote = function(s) {
        return s.replace('"', '&quot;');
    };

    /**
     * Determines if the supplied node is a Node type, or a Node type of the node's window.
     */
    var isNode = function(node) {
        return node instanceof Node ||
                node && node.ownerDocument && node.ownerDocument.defaultView && (node instanceof node.ownerDocument.defaultView.Node);
    };

    var oldIsArray = dust.isArray;
    dust.isArray = function(arr) {
        return Boolean(arr && arr.appendTo) || oldIsArray(arr);
    };

    /**
     *  Return a string for the opening tag of DOMElement `element`.
     */
    dust.filters.openTag = function(element) {
        if (!element) {
            return '';
        }
        if (element.length) {
            element = element[0];
        }

        var stringBuffer = [];

        [].forEach.call(element.attributes, function(attr) {
            stringBuffer.push(' ', attr.name, '="', escapeQuote(attr.value), '"');
        });
        return '<' + nodeName(element) + stringBuffer.join('') + '>';
    };

    /**
     *  Return a string for the closing tag of DOMElement `element`.
     */
    dust.filters.closeTag = function(element) {
        if (!element) {
            return '';
        }
        if (element.length) {
            element = element[0];
        }

        return '</' + nodeName(element) + '>';
    };

    /**
     *  Override the behaviour of the default dust.js filter when
     *  using {key}.
     */
    dust.filters.h = function(node) {
        if (!node) {
            return '';
        }

        // Check if the node is a TextNode
        if (node.nodeType === 3) {
            if (node.nodeValue) {
                return node.nodeValue;
            }
        }

        if (isNode(node)) {
            return Utils.outerHTML(node);
        }

        if (likeArray(node)) {
            var result = [];
            for (var i = 0, len = node.length; i < len; i++) {
                result.push(dust.filters.h(node[i]));
            }
            return result.join('');
        }

        return dust.escapeHtml(node);
    };

    dust.filters.innerHTML = function(node) {
        if (!node) {
            return '';
        }
        if (likeArray(node)) {
            var result = [];
            for (var i = 0, len = node.length; i < len; i++) {
                result.push(node[i].innerHTML || node[i].nodeValue);
            }
            return result.join('');
        }
        else {
            return node.innerHTML;
        }
    };

    // Adds 'count' helper. Like idx, but this one goes to 11. It's 1 higher.
    dust.helpers.count = function(chunk, context, bodies) {
        return bodies.block(chunk, context.push(context.stack.index + 1));
    };

    /**
     *  Returns a full url for an asset including a cache breaker
     */
    dust.helpers.getUrl = function(chunk, context, bodies, params) {
        var url = Utils.getAssetUrl(params.path, params.baseUrl, params.cacheBreaker);
        return chunk.write(url);
    };

    // Override methods in Context and Chunk in order to get chain inheritance,
    // as well as for adding _SUPER_
    var Context = dust.makeBase({}).constructor;
    var Chunk = dust.stream('', {}).head.constructor;

    var oldBlock = Chunk.prototype.block;
    Chunk.prototype.block = function(elem, context, bodies) {
        var topElem = elem ? elem.shift() : undefined;
        if (topElem) {
            context.global = context.global || {};
            // Add `_SUPER_` to the block context.
            context.global._SUPER_ = function(_elem, context, _bodies) {
                return _elem.block(elem, context, bodies);
            };
            context = new context.constructor(context.stack, context.global, context.blocks);
        }

        return oldBlock.call(this, topElem, context, bodies);
    };

    Context.prototype.getBlock = function(key, chk, ctx) {
        if (typeof key === 'function') {
            var tempChk = new Chunk();
            key = key(tempChk, this).data.join('');
        }

        var blocks = this.blocks;

        if (!blocks) {
            dust.log('No blocks for context[{' + key + '}] in template [' + this.getTemplateName() + ']', 'DEBUG');
            return;
        }
        var newBlocks = [];
        for (var i = 0, len = blocks.length; i < len; i++) {
            // Only push the block if it's not undefined
            blocks[i][key] && newBlocks.push(blocks[i][key]);
        }
        return newBlocks;
    };

    return dust;
});


define('dust!templates/partials/_header',["dust-custom"],function(dust){(function(){dust.register("templates/partials/_header",body_0);function body_0(chk,ctx){return chk.section(ctx._get(false, ["header"]),ctx,{"block":body_1},null).write("\n");}function body_1(chk,ctx){return chk.write("\n    ").write("<header class=\"t-header\" role=\"banner\">").write("\n        ").write("<h1>Welcome to your Adaptive.js site</h1>").write("\n        ").write("<p>As an initial example of content selection, we've selected the title of your site and placed it in _header.dust:</p>").write("\n        ").write("<p class=\"c-card\">").write("\n            ").reference(ctx._get(false, ["title"]),ctx,"h").write("\n        ").write("</p>").write("\n    ").write("</header>").write("\n");}return body_0;})(); return function(context, callback) {return dust.render("templates/partials/_header", context, callback)}});

define('dust!templates/partials/_footer',["dust-custom"],function(dust){(function(){dust.register("templates/partials/_footer",body_0);function body_0(chk,ctx){return chk.section(ctx._get(false, ["footer"]),ctx,{"block":body_1},null).write("\n");}function body_1(chk,ctx){return chk.write("\n    ").write("<footer class=\"t-footer\" role=\"contentinfo\">").write("\n        ").write("<hr>").write("\n        ").write("<h3>Documentation</h3>").write("\n        ").write("<div>").write("\n            ").write("<p>For more in-depth information, including API documentation, please visit our ").section(ctx._get(false, ["documentationLink"]),ctx,{"block":body_2},null).write("</p>").write("\n        ").write("</div>").write("\n    ").write("</footer>").write("\n");}function body_2(chk,ctx){return chk.write("<a href=\"").reference(ctx._get(false, ["href"]),ctx,"h").write("\"><b>").reference(ctx._get(false, ["text"]),ctx,"h").write("</b></a>");}return body_0;})(); return function(context, callback) {return dust.render("templates/partials/_footer", context, callback)}});

define('dust!templates/base',["dust-custom","dust!templates/partials/_header","dust!templates/partials/_footer"],function(dust){(function(){dust.register("templates/base",body_0);function body_0(chk,ctx){return chk.write("<!DOCTYPE html>").write("\n").reference(ctx._get(false, ["html"]),ctx,"h",["openTag","s"]).write("\n").reference(ctx._get(false, ["head"]),ctx,"h",["openTag","s"]).write("\n    ").reference(ctx._get(false,["config","adaptiveBuildScript"]),ctx,"h").write("\n    ").block(ctx.getBlock("head"),ctx,{"block":body_1},null).write("\n").write("</head>").write("\n").reference(ctx._get(false, ["body"]),ctx,"h",["openTag","s"]).write("\n    ").block(ctx.getBlock("bodyBlock"),ctx,{"block":body_3},null).write("\n    ").block(ctx.getBlock("scripts"),ctx,{"block":body_5},null).write("\n").write("</body>").write("\n").write("</html>").write("\n");}function body_1(chk,ctx){return chk.write("\n        ").reference(ctx._get(false, ["head"]),ctx,"h",["innerHTML","s"]).write("\n\n        ").block(ctx.getBlock("style"),ctx,{"block":body_2},null).write("\n\n        ").write("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no\">").write("\n\n        ").write("\n        ").reference(ctx._get(false,["config","ajs"]),ctx,"h",["s"]).write("\n        ").write("<script>").write("\n            ").write("var analytics = Mobify.analytics = Mobify.analytics || {};").write("\n            ").write("analytics.ga = analytics.ga || [];").write("\n            ").write("analytics.ua = analytics.ua || function() {").write("\n                ").write("(analytics.ua.q = analytics.ua.q || []).push(arguments);").write("\n            ").write("};").write("\n        ").write("</script>").write("\n    ");}function body_2(chk,ctx){return chk.write("\n            ").write("<link rel=\"stylesheet\" type=\"text/css\" href=\"").helper("getUrl",ctx,{},{"path":"css/stylesheet.css"}).write("\" />").write("\n        ");}function body_3(chk,ctx){return chk.write("\n        ").write("<div id=\"x-root\" class=\"t-").reference(ctx._get(false, ["templateName"]),ctx,"h").write("\">").write("\n\n            ").partial("templates/partials/_header",ctx,null).write("\n\n            ").write("<main class=\"t-main\" role=\"main\">").write("\n                ").block(ctx.getBlock("contentBlock"),ctx,{"block":body_4},null).write("\n            ").write("</main>").write("\n\n            ").partial("templates/partials/_footer",ctx,null).write("\n        ").write("</div>").write("\n    ");}function body_4(chk,ctx){return chk.write("\n                    ").reference(ctx._get(false, ["body"]),ctx,"h",["innerHTML","s"]).write("\n                ");}function body_5(chk,ctx){return chk.write("\n        ").reference(ctx._get(false, ["desktopScripts"]),ctx,"h").write("\n\n        ").write("\n        ").exists(ctx._get(false,["config","isDebug"]),ctx,{"else":body_6,"block":body_7},null).write("\n\n        ").block(ctx.getBlock("uiScripts"),ctx,{"block":body_8},null).write("\n    ");}function body_6(chk,ctx){return chk.write("\n            ").write("<script src=\"").helper("getUrl",ctx,{},{"path":"js/ui.min.js"}).write("\"></script>").write("\n        ");}function body_7(chk,ctx){return chk.write("\n            ").write("<script src=\"").helper("getUrl",ctx,{},{"path":"js/ui.js"}).write("\"></script>").write("\n        ");}function body_8(chk,ctx){return chk;}return body_0;})(); return function(context, callback) {return dust.render("templates/base", context, callback)}});
define('devSettings',[], function() {
    /**
     * WARNING:
     * The following object will only be used during local development.
     * When creating the production build, it will be stripped out,
     * and on the Mobify Cloud, production setting will be injected.
     */
    return {
        cacheBreaker: 11235813 // ensure this is an integer value,
    };
});

define('settings',['devSettings'], function(devSettings) {
    // Ensure that the object returned only contains values that
    // are valid JSON-serializable values.
    try {
        return JSON.parse(JSON.stringify(devSettings));
    } catch (e) {
        console.error('Your Adaptive Settings must return valid JSON!');
        return {};
    }
});

define('views/base',[
    '$',
    'resizeImages',
    'adaptivejs/utils',
    'adaptivejs/defaults',
    'includes/_header',
    'includes/_footer',
    'dust!templates/base',
    'settings'
],
function($, ResizeImages, Utils, Defaults, header, footer, template, Settings) {

    /**
     * Grab the default cache breaker variable from the Mobify Config
     */
    if (ResizeImages && Settings) {
        ResizeImages.defaults.cacheBreaker = Settings.cacheBreaker;
    }

    /**
     *  Grabs the images which you would like to run through
     *  imageResizer and sends them away. Can be setup
     *  with more profiles for different types of images
     *  if needed.
     */
    var resizeImages = function() {
        var $imgs = $('img');
        var defaultOpts = {
            projectName: Defaults.projectName
        };

        ResizeImages.resize($imgs, defaultOpts);

        return $imgs;
    };

    return {
        template: template,
        includes: {
            header: header,
            footer: footer
        },
        /**
        * preProcess receives a context as a paramater and should return
        * that context with any modifications the user needs. This runs
        * before keys in `context` are executed
        */
        preProcess: function(context) {
            // Transforms should take place here rather then within `context`.
            // An example of a DOM transform:
            $('head').find('meta[name="viewport"]').remove();
            $('style, link[rel="stylesheet"]').remove();

            return context;
        },

        /**
        * postProcess receives a context as a paramater and should return
        * that context with any modifications the user needs. This runs
        * after keys in `context` are executed
        */
        postProcess: function(context) {
            // Transforms should take place here rather then within `context`.
            // An example of a DOM transform:
            context.desktopScripts = $('script').remove();

            // Uncomment the following line to use Mobify's image resizer:
            // resizeImages();

            return context;
        },
        context: {
            templateName: 'base',
            html: function() {
                return $('html');
            },
            head: function() {
                return $('head');
            },
            body: function() {
                return $('body');
            }
        }
    };
});

/**
 * SplitTest, A library for creating and persisting splits
 * for A/B testing
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define('split-test',[], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.SplitTest = factory();
    }
}(this, function() {

    var SplitTest = function(values, options) {
        options = options || {};
        this.cookieName = 'split';
        if (options.namespace) {
            this.cookieName = options.namespace + '-' + this.cookieName;
        }

        this.cookieDomain = options.cookieDomain || window.location.hostname;

        var splitValue = this.getValue();

        if (!splitValue) {
            splitValue = SplitTest.randomChoice(values);
            this.setValue(splitValue);
        }
    };

    /**
     * Allows you to enter split parameters and
     * probabilities. Sets the current split value only
     * if a current split is not in effect.
     * Total probability will be normalized to 1.
     *
     * Usage:
     *  var split = SplitTest.init({
     *      "A": 0.1,
     *      "B": 0.9
     *  }, {
     *      namespace: "mobify",
     *      lifetime: 15*24*3600 // 15 days in seconds
     *  });
     *
     *  splitVal = split.getValue();
     */
    SplitTest.init = function(values, options) {
        return new SplitTest(values, options);
    };

    /**
     * Allows you to explicitly set the split value.
     * '' (the empty string) is the default state. It will be overridden
     * by calls to randomChoice(), for example.
     *
     */
    SplitTest.prototype.setChoice = SplitTest.prototype.setValue = function(value) {
        // Splits are stored for 30 days.
        SplitTest.setCookie(this.cookieName, value, this.cookieDomain);
    };

    /**
     * Returns the current split stored in the cookie
     */
    SplitTest.prototype.getChoice = SplitTest.prototype.getValue = function() {
        var splitValue = SplitTest.getCookie(this.cookieName);

        if (splitValue) {
            // Push the session out 30 days
            this.setValue(splitValue);
        }

        return splitValue;
    };

    /**
     * Returns a random choice from the given values
     * where values is a dictionary of (option, weight)
     */
    SplitTest.randomChoice = function(values) {
        var choices = [];
        var cumProbabilities = [];
        var total = 0;

        for (var value in values) {
            if (values.hasOwnProperty(value)) {
                total += values[value];
                choices.push(value);
                cumProbabilities.push(total);
            }
        }

        var pick = Math.random() * total;
        for (var i = 0, len = choices.length; i < len; i++) {
            var cumP = cumProbabilities[i];
            if (cumP > pick) {
                return choices[i];
            }
        }
    };

    /**
     * Reads a cookie with the given name.
     */
    SplitTest.getCookie = function(name) {
        var cookieRe = new RegExp(name + '=([^;]+)');
        var match = cookieRe.exec(document.cookie);

        return (match ? match[1] : '');
    };

    /**
     * Sets a cookie with the given name and value.
     * If a lifetime value is given, the expiry will be set to lifetime
     * seconds in the future. Otherwise, the expiry is 30 days.
     *
     * If domain is given, the cookie is set with that domain.
     */
    SplitTest.setCookie = function(name, value, domain, lifetime) {
        var expires = new Date();
        var now = (+expires); //type coerce to timestamp

        if (lifetime > 0) {
            // Lifetime (seconds) in to the future
            expires.setTime(now + lifetime * 1000);
        } else {
            // 30 Days in to the future
            expires.setTime(now + 30 * 24 * 3600 * 1000);
        }
        document.cookie = name + '=' + value + '; expires=' +
        expires.toGMTString() + '; path=/; ' + (domain && domain !== 'localhost' ? 'domain=' + domain : '');
    };

    return SplitTest;
}));


define('dust!templates/home1',["dust-custom","dust!templates/base"],function(dust){(function(){dust.register("templates/home1",body_0);var blocks={"contentBlock":body_1,"uiScripts":body_2};function body_0(chk,ctx){ctx=ctx.shiftBlocks(blocks);return chk.partial("templates/base",ctx,null).write("\n\n").write("\n\n").write("\n\n");}function body_1(chk,ctx){ctx=ctx.shiftBlocks(blocks);return chk.write("\n    ").write("<h1>HOME Version 1</h1>").write("\n    ").write("<p>We've also extracted the first paragraph from your site and placed it in home.dust:</p>").write("\n    ").write("<p class=\"c-card\">").write("\n        ").reference(ctx._get(false, ["firstp"]),ctx,"h").write("\n    ").write("</p>").write("\n");}function body_2(chk,ctx){ctx=ctx.shiftBlocks(blocks);return chk.write("\n    ").write("<script>").write("\n    ").write("// Note: Add any JavaScript that should be run on this page into").write("\n    ").write("// assets/js/ui/view-scripts/home.js").write("\n    ").write("(function(require) {").write("\n        ").write("require([\"view-scripts/home\"], function(homeUI) {").write("\n            ").write("homeUI();").write("\n        ").write("});").write("\n    ").write("})(Adaptive.AMD.require);").write("\n    ").write("</script>").write("\n");}return body_0;})(); return function(context, callback) {return dust.render("templates/home1", context, callback)}});

define('dust!templates/home2',["dust-custom","dust!templates/base"],function(dust){(function(){dust.register("templates/home2",body_0);var blocks={"contentBlock":body_1,"uiScripts":body_2};function body_0(chk,ctx){ctx=ctx.shiftBlocks(blocks);return chk.partial("templates/base",ctx,null).write("\n\n").write("\n\n").write("\n\n");}function body_1(chk,ctx){ctx=ctx.shiftBlocks(blocks);return chk.write("\n    ").write("<h1>HOME Version 2</h1>").write("\n    ").write("<p>We've also extracted the first paragraph from your site and placed it in home.dust:</p>").write("\n    ").write("<p class=\"c-card\">").write("\n        ").reference(ctx._get(false, ["firstp"]),ctx,"h").write("\n    ").write("</p>").write("\n");}function body_2(chk,ctx){ctx=ctx.shiftBlocks(blocks);return chk.write("\n    ").write("<script>").write("\n    ").write("// Note: Add any JavaScript that should be run on this page into").write("\n    ").write("// assets/js/ui/view-scripts/home.js").write("\n    ").write("(function(require) {").write("\n        ").write("require([\"view-scripts/home\"], function(homeUI) {").write("\n            ").write("homeUI();").write("\n        ").write("});").write("\n    ").write("})(Adaptive.AMD.require);").write("\n    ").write("</script>").write("\n");}return body_0;})(); return function(context, callback) {return dust.render("templates/home2", context, callback)}});

define('dust!templates/home3',["dust-custom","dust!templates/base"],function(dust){(function(){dust.register("templates/home3",body_0);var blocks={"contentBlock":body_1,"uiScripts":body_2};function body_0(chk,ctx){ctx=ctx.shiftBlocks(blocks);return chk.partial("templates/base",ctx,null).write("\n\n").write("\n\n").write("\n\n");}function body_1(chk,ctx){ctx=ctx.shiftBlocks(blocks);return chk.write("\n    ").write("<h1>HOME Version 3</h1>").write("\n    ").write("<p>We've also extracted the first paragraph from your site and placed it in home.dust:</p>").write("\n    ").write("<p class=\"c-card\">").write("\n        ").reference(ctx._get(false, ["firstp"]),ctx,"h").write("\n    ").write("</p>").write("\n");}function body_2(chk,ctx){ctx=ctx.shiftBlocks(blocks);return chk.write("\n    ").write("<script>").write("\n    ").write("// Note: Add any JavaScript that should be run on this page into").write("\n    ").write("// assets/js/ui/view-scripts/home.js").write("\n    ").write("(function(require) {").write("\n        ").write("require([\"view-scripts/home\"], function(homeUI) {").write("\n            ").write("homeUI();").write("\n        ").write("});").write("\n    ").write("})(Adaptive.AMD.require);").write("\n    ").write("</script>").write("\n");}return body_0;})(); return function(context, callback) {return dust.render("templates/home3", context, callback)}});
define('views/home',[
    '$',
    'views/base',
    'split-test',
    'dust!templates/home1',
    'dust!templates/home2',
    'dust!templates/home3'
],
function($, BaseView, SplitTest, home1, home2, home3) {
    var template;
    var splitTest = SplitTest.init({
        'home1': 0.2,
        'home2': 0.6,
        'home3': 0.2
    }, {
        namespace: 'mobify',
        lifetime: 15 * 24 * 3600 // 15 days in seconds
    });

    var choice = splitTest.getChoice();

    if (choice === 'home1') {
        template = home1;
    } else if (choice === 'home2') {
        template = home2;
    } else {
        template = home3;
    }

    return {
        template: template,
        extend: BaseView,
        context: {
            templateName: 'home',
            firstp: function() {
                return $('p').first().text() || 'Could not find the first paragraph text in your page';
            }
        }

        /**
         * If you wish to override preProcess/postProcess in this view, have a look at the documentation:
         * https://cloud.mobify.com/docs/adaptivejs/views/
         */
    };
});

define('router',[
    '$',
    'adaptivejs/router',
    'views/home'
],
function($, Router, Home) {
    var router = new Router();

    router
        .add(Router.selectorMatch('body.home'), Home)
        .add(Router.urlMatch('/foo'), Home)
        .add(function() {return true;}, Home);

    return router;
});

// Fixes anchor links (on FF)
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define('mobifyjs/patchAnchorLinks',["mobifyjs/utils"], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        var Utils = require('../bower_components/mobifyjs-utils/utils.js');
        module.exports = factory(Utils);
    } else {
        // Browser globals (root is window)
        root.Utils = factory(root.Utils);
    }
}(this, function (Utils) {
    var exports = {};

    var isOldFirefox = function(ua) {
        ua = ua || window.navigator.userAgent;
        var match = /(firefox|fennec)[\/\s](\d+)/i.exec(ua);
        if (match) {
            var version = +match[2];
            if (version >= 29) {
                return false;
            }
            return true;
        }

        return false;
    };

    var _patchAnchorLinks = function(doc) {
        // Anchor links in FF, after we do `document.open` cause a page
        // navigation (a refresh) instead of just scrolling the
        // element in to view.
        //
        // So, we prevent the default action on the element, and
        // then manually scroll it in to view (unless some else already
        // called prevent default).

        var body = doc.body;

        if (!(body && body.addEventListener)) {
            // Body is not there or we can't bind as expected.
            return;
        }

        var _handler = function(e) {
            // Handler for all clicks on the page, but only triggers
            // on proper anchor links.

            var target = e.target;

            var matches = function(el) {
                return (el.nodeName == "A") && (/^#/.test(el.getAttribute('href')));
            };

            if (!matches(target)) {
                return;
            }
            
            // Newer browsers support `e.defaultPrevented`. FF 4.0 supports `e.getPreventDefault()`
            var defaultPrevented = (typeof e.defaultPrevented !== "undefined") ?
                e.defaultPrevented :
                e.getPreventDefault && e.getPreventDefault();

            if (!defaultPrevented) {
                // Prevent the default action, which would cause a
                // page refresh.
                e.preventDefault();

                // But pretend that we didn't call it.
                e.defaultPrevented = false;

                // We have to wait and see if anyone else calls
                // `preventDefault`. If they do, we don't scroll.
                var scroll = true;

                // Override the `preventDefault` to stop  us from scrolling.
                e.preventDefault = function() {
                    e.defaultPrevented = true;
                    scroll = false;
                };

                // If no other events call `preventDefault` we manually
                // scroll to the element in question.
                setTimeout(function() {
                    if (scroll) {
                        _scrollToAnchor(target.getAttribute('href'));
                    }
                }, 50);
            }
        };


        var _scrollToAnchor = function(anchor) {
            // Scrolls to the element, if any, that matches
            // the given anchor link (eg, "#foo").

            var anchorRe = /^#([^\s]*)/;
            var match = anchor.match(anchorRe);
            var target;
            
            // Find the target, if any
            if (match && match[1] === "") {
                target = doc.body;
            } else if (match && match[1]) {
                target = doc.getElementById(match[1]);
            }

            // Scroll to it, if it exists
            if (target) {
                target.scrollIntoView && target.scrollIntoView();
            }
        };

        // We have to get the event through bubbling, otherwise
        // events cancelled by the return value of an onclick
        // handler are not correctly handled.
        body.addEventListener('click', _handler, false);
    };

    var patchAnchorLinks = function() {
        if (!isOldFirefox()) {
            return;
        }

        Utils.waitForReady(document, _patchAnchorLinks);
    };

    patchAnchorLinks._isOldFirefox = isOldFirefox;


    return patchAnchorLinks;
}));

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define('mobifyjs/capture',['mobifyjs/utils', 'mobifyjs/patchAnchorLinks'], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require('../bower_components/mobifyjs-utils/utils.js'), require('./patchAnchorLinks.js'));
    } else {
        // Browser globals (root is window)
        root.Capture = factory(root.Utils, root.patchAnchorLinks);
    }
}(this, function (Utils, patchAnchorLinks) {

// ##
// # Static Variables/Functions
// ##

// v6 tag backwards compatibility change
if (window.Mobify && 
    !window.Mobify.capturing &&
    document.getElementsByTagName("plaintext").length) 
{
            window.Mobify.capturing = true;
}

var openingScriptRe = /(<script[\s\S]*?>)/gi;

// Inline styles and scripts are disabled using a unknown type.
var tagDisablers = {
    style: ' media="mobify-media"',
    script: ' type="text/mobify-script"'
};

var tagEnablingRe = new RegExp(Utils.values(tagDisablers).join('|'), 'g');

// Map of all attributes we should disable (to prevent resources from downloading)
var disablingMap = {
    img:    ['src'],
    source: ['src'],
    iframe: ['src'],
    script: ['src', 'type'],
    link:   ['href'],
    style:  ['media'],
};

var affectedTagRe = new RegExp('<(' + Utils.keys(disablingMap).join('|') + ')([\\s\\S]*?)>', 'gi');
var attributeDisablingRes = {};
var attributesToEnable = {};

// Populate `attributesToEnable` and `attributeDisablingRes`.
for (var tagName in disablingMap) {
    if (!disablingMap.hasOwnProperty(tagName)) continue;
    var targetAttributes = disablingMap[tagName];

    targetAttributes.forEach(function(value) {
        attributesToEnable[value] = true;
    });

    // <space><attr>='...'|"..."
    attributeDisablingRes[tagName] = new RegExp(
        '\\s+((?:'
        + targetAttributes.join('|')
        + ")\\s*=\\s*(?:('|\")[\\s\\S]+?\\2))", 'gi');
}

/**
 * Returns the name of a node (in lowercase)
 */
function nodeName(node) {
    return node.nodeName.toLowerCase();
}

/**
 * Escape quotes
 */
function escapeQuote(s) {
    return s.replace('"', '&quot;');
}


/**
 * Helper method for looping through and grabbing strings of elements
 * in the captured DOM after plaintext insertion
 */
function extractHTMLStringFromElement(container) {
    if (!container) return '';
    return [].map.call(container.childNodes, function(el) {
        var tagName = nodeName(el);
        if (tagName == '#comment') return '<!--' + el.textContent + '-->';
        if (tagName == 'plaintext') return el.textContent;
        // Don't allow mobify related scripts to be added to the new document
        if (tagName == 'script' && ((/mobify/.test(el.src) || /mobify/i.test(el.textContent)))) {
            return '';
        }
        return el.outerHTML || el.nodeValue || Utils.outerHTML(el);
    }).join('');
}

// cached div used repeatedly to create new elements
var cachedDiv = document.createElement('div');

// ##
// # Constructor
// ##
var Capture = function(sourceDoc, prefix) {
    this.sourceDoc = sourceDoc;
    this.prefix = prefix || "x-";
    if (window.Mobify) window.Mobify.prefix = this.prefix;
};

/**
 * Initiate a buffered capture. `init` is an alias to `initCapture` for
 * backwards compatibility.
 */
Capture.init = Capture.initCapture = function(callback, doc, prefix) {
    var doc = doc || document;

    var createCapture = function(callback, doc, prefix) {
        var capture = new Capture(doc, prefix);
        var capturedStringFragments = Capture.createDocumentFragmentsStrings(capture.sourceDoc);
        Utils.extend(capture, capturedStringFragments);
        var capturedDOMFragments = capture.createDocumentFragments();
        Utils.extend(capture, capturedDOMFragments);
        callback(capture);
    }

    if (Utils.domIsReady(doc)) {
        createCapture(callback, doc, prefix);
    }
    // We may be in "loading" state by the time we get here, meaning we are
    // not ready to capture. Next step after "loading" is "interactive",
    // which is a valid state to start capturing on (except IE), and thus when ready
    // state changes once, we know we are good to start capturing.
    // Cannot rely on using DOMContentLoaded because this event prematurely fires
    // for some IE10s.
    else {
        var created = false;
        
        var create = function() {
            if (!created) {
                created = true;
                iid && clearInterval(iid);
                createCapture(callback, doc, prefix);
            }
        }
        // backup with polling incase readystatechange doesn't fire
        // (happens with some Android 2.3 browsers)
        var iid = setInterval(function(){
            if (Utils.domIsReady(doc)) {
                create();
            }
        }, 100);
        doc.addEventListener("readystatechange", create, false);

    }
};

/**
 * Removes closing tags from the end of an HTML string.
 */
Capture.removeClosingTagsAtEndOfString = function(html) {
    var match = html.match(/((<\/[^>]+>)+)$/);
    if (!match) return html;
    return html.substring(0, html.length - match[0].length);
}

Capture.removeTargetSelf = function(html) {
    return html.replace(/target=("_self"|\'_self\')/gi, '');
}

/**
 * Grab attributes from a string representation of an elements and clone them into dest element
 */
Capture.cloneAttributes = function(sourceString, dest) {
    var match = sourceString.match(/^<(\w+)([\s\S]*)$/i);
    cachedDiv.innerHTML = '<div' + match[2];
    [].forEach.call(cachedDiv.firstChild.attributes, function(attr) {
        try {
            dest.setAttribute(attr.nodeName, attr.nodeValue);
        } catch (e) {
            console.error("Error copying attributes while capturing: ", e);
        }
    });

    return dest;
};

/**
 * Returns a string with all external attributes disabled.
 * Includes special handling for resources referenced in scripts and inside
 * comments.
 * Not declared on the prototype so it can be used as a static method.
 */
Capture.disable = function(htmlStr, prefix) {
    var self = this;
    // Disables all attributes in disablingMap by prepending prefix
    var disableAttributes = (function(){
        return function(whole, tagName, tail) {
            lowercaseTagName = tagName.toLowerCase();
            return result = '<' + lowercaseTagName + (tagDisablers[lowercaseTagName] || '')
                + tail.replace(attributeDisablingRes[lowercaseTagName], ' ' + prefix + '$1') + '>';
        }
    })();

    var splitRe = /(<!--[\s\S]*?-->)|(?=<\/script)/i;
    var tokens = htmlStr.split(splitRe);
    var ret = tokens.map(function(fragment) {
                var parsed

                // Fragment may be empty or just a comment, no need to escape those.
                if (!fragment) return '';
                if (/^<!--/.test(fragment)) return fragment;

                // Disable before and the <script> itself.
                // parsed = [before, <script>, script contents]
                parsed = fragment.split(openingScriptRe);
                parsed[0] = parsed[0].replace(affectedTagRe, disableAttributes);
                if (parsed[1]) parsed[1] = parsed[1].replace(affectedTagRe, disableAttributes);
                return parsed;
            });

    return [].concat.apply([], ret).join('');
};

/**
 * Returns a string with all disabled external attributes enabled.
 * Not declared on the prototype so it can be used as a static method.
 */
Capture.enable = function(htmlStr, prefix) {
    var attributeEnablingRe = new RegExp('\\s' + prefix + '(' + Utils.keys(attributesToEnable).join('|') + ')', 'gi');
    return htmlStr.replace(attributeEnablingRe, ' $1').replace(tagEnablingRe, '');
};

/**
 * Return a string for the opening tag of DOMElement `element`.
 */
Capture.openTag = function(element) {
    if (!element) return '';
    if (element.length) element = element[0];

    var stringBuffer = [];

    [].forEach.call(element.attributes, function(attr) {
        stringBuffer.push(' ', attr.name, '="', escapeQuote(attr.value), '"');
    })

    return '<' + nodeName(element) + stringBuffer.join('') + '>';
};

/**
 * Set the content of an element with html from a string
 */
Capture.setElementContentFromString = function(el, htmlString) {
    for (cachedDiv.innerHTML = htmlString; cachedDiv.firstChild; el.appendChild(cachedDiv.firstChild));
};

/**
 * Returns an object containing the state of the original page. Caches the object
 * in `extractedHTML` for later use.
 */
 Capture.createDocumentFragmentsStrings = function(doc) {
    var headEl = doc.getElementsByTagName('head')[0] || doc.createElement('head');
    var bodyEl = doc.getElementsByTagName('body')[0] || doc.createElement('body');
    var htmlEl = doc.getElementsByTagName('html')[0];

    var captured = {
        doctype: Utils.getDoctype(doc),
        htmlOpenTag: Capture.openTag(htmlEl),
        headOpenTag: Capture.openTag(headEl),
        bodyOpenTag: Capture.openTag(bodyEl),
        headContent: extractHTMLStringFromElement(headEl),
        bodyContent: extractHTMLStringFromElement(bodyEl)
    };

    /**
     * RR: I assume that Mobify escaping tag is placed in <head>. If so, the <plaintext>
     * it emits would capture the </head><body> boundary, as well as closing </body></html>
     * Therefore, bodyContent will have these tags, and they do not need to be added to .all()
     */
    captured.all = function(inject) {
        return this.doctype + this.htmlOpenTag + this.headOpenTag + (inject || '') + this.headContent + this.bodyOpenTag + this.bodyContent;
    };

    // During capturing, we will usually end up hiding our </head>/<body ... > boundary
    // within <plaintext> capturing element. To construct source DOM, we need to rejoin
    // head and body content, iterate through it to find head/body boundary and expose
    // opening <body ... > tag as a string.

    // Consume comments without grouping to avoid catching
    // <body> inside a comment, common with IE conditional comments.
    // (using a "new RegExp" here because in Android 2.3 when you use a global
    // match using a RegExp literal, the state is incorrectly cached).
    var bodySnatcher = new RegExp('<!--(?:[\\s\\S]*?)-->|(<\\/head\\s*>|<body[\\s\\S]*$)', 'gi');

    //Fallback for absence of </head> and <body>
    var rawHTML = captured.bodyContent = captured.headContent + captured.bodyContent;
    captured.headContent = '';

    // Search rawHTML for the head/body split.
    for (var match; match = bodySnatcher.exec(rawHTML); match) {
        // <!-- comment --> . Skip it.
        if (!match[1]) continue;

        // Grab the contents of head
        captured.headContent = rawHTML.slice(0, match.index);
        // Parse the head content
        var parsedHeadTag = (new RegExp('^[\\s\\S]*(<head(?:[^>\'"]*|\'[^\']*?\'|"[^"]*?")*>)([\\s\\S]*)$')).exec(captured.headContent);
        if (parsedHeadTag) {
            // if headContent contains an open head, then we know the tag was placed
            // outside of the body
            captured.headOpenTag = parsedHeadTag[1];
            captured.headContent = parsedHeadTag[2];
        }

        // If there is a closing head tag
        if (match[1][1] == '/') {
            // Hit </head. Gather <head> innerHTML. Also, take trailing content,
            // just in case <body ... > is missing or malformed
            captured.bodyContent = rawHTML.slice(match.index + match[1].length);
        } else {
            // Hit <body. Gather <body> innerHTML.
            // If we were missing a </head> before, now we can pick up everything before <body
            captured.bodyContent = match[0];

            // Find the end of <body ... >
            var parseBodyTag = /^((?:[^>'"]*|'[^']*?'|"[^"]*?")*>)([\s\S]*)$/.exec(captured.bodyContent);

            // Will skip this if <body was malformed (e.g. no closing > )
            if (parseBodyTag) {
                // Normal termination. Both </head> and <body> were recognized and split out
                captured.bodyOpenTag = parseBodyTag[1];
                captured.bodyContent = parseBodyTag[2];
            }
            break;
        }
    }
    return captured;
};

Capture.isIOS8_0 = function() {
    var IOS8_REGEX = /ip(hone|od|ad).*Version\/8.0/i;

    return IOS8_REGEX.test(window.navigator.userAgent);
};

/**
 * This is a feature detection function to determine if you
 * can construct body using innerHTML. In iOS8, setting
 * innerHTML on body seems to break if you have forms.
 * If you have forms in the page which are siblings,
 * the second sibling ends up becoming a child element
 * of the first sibling.
 */
Capture.isSetBodyInnerHTMLBroken = function(){
    var doc = document.implementation.createHTMLDocument("");
    var bodyEl = doc.documentElement.lastChild;
    if (!bodyEl) {
        return false;
    }
    bodyEl.innerHTML = '<form></form><form></form>';
    if (bodyEl.childNodes && bodyEl.childNodes.length === 1) {
        return true;
    }
    return false;
};

/**
 * iOS 8.0 has a bug where dynamically switching the viewport (by swapping the
 * viewport meta tag) causes the viewport to automatically scroll. When
 * capturing, the initial document never has an active meta viewport tag.
 * Then, the rendered document injects one causing the aforementioned scroll.
 *
 * Create a meta viewport tag that we inject into the page to force the page to
 * scroll before anything is rendered in the page (this code should be called
 * before document.open!)
 *
 * JIRA: https://mobify.atlassian.net/browse/GOLD-883
 * Open Radar: http://www.openradar.me/radar?id=5516452639539200
 * WebKit Bugzilla: https://bugs.webkit.org/show_bug.cgi?id=136904
 */
Capture.ios8_0ScrollFix = function(doc, callback) {
    // Using `getElementsByTagName` here because grabbing head using
    // `document.head` will throw exceptions in some older browsers (iOS 4.3).
    var head = doc.getElementsByTagName('head');
    // Be extra safe and guard against `head` not existing.
    if (!head.length) {
        return;
    }
    var head = head[0];

    var meta = document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    meta.setAttribute('content', 'width=device-width');
    head.appendChild(meta);

    if (callback) {
        // Wait two paints for the meta viewport tag to take effect. This is
        // required for this fix to work, but guard against it being undefined
        // anyway just in case.
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(function() {
                window.requestAnimationFrame(callback);
            });
        }
        else {
            callback();
        }
    }
};

/**
 * Grab the captured document and render it
 */
Capture.prototype.restore = function(inject) {
    var self = this;

    Utils.waitForReady(document, function() {
        self.render(self.all(inject));
    });
};

/**
 * Grab fragment strings and construct DOM fragments
 * returns htmlEl, headEl, bodyEl, doc
 */
Capture.prototype.createDocumentFragments = function() {
    var docFrags = {};
    var doc = docFrags.capturedDoc = document.implementation.createHTMLDocument("");
    var htmlEl = docFrags.htmlEl = doc.documentElement;
    var headEl = docFrags.headEl = htmlEl.firstChild;
    var bodyEl = docFrags.bodyEl = htmlEl.lastChild;

    // Reconstruct html, body, and head with the same attributes as the original document
    Capture.cloneAttributes(this.htmlOpenTag, htmlEl);
    Capture.cloneAttributes(this.headOpenTag, headEl);
    Capture.cloneAttributes(this.bodyOpenTag, bodyEl);

    var disabledBodyContent = Capture.disable(this.bodyContent, this.prefix);
    // Set innerHTML on body (if the browser is capable of doing so).
    // If not, set innerHTML on a div and copy children elements into body.
    if (!Capture.isSetBodyInnerHTMLBroken()) {
        // Set innerHTML of new source DOM body
        bodyEl.innerHTML = disabledBodyContent;
    } else {
        Capture.setElementContentFromString(bodyEl, disabledBodyContent);
    }

    // In Safari 4/5 and iOS 4.3, there are certain scenarios where elements
    // in the body (ex "meta" in "noscripts" tags) get moved into the head,
    // which can cause issues with certain websites (for example, if you have
    // a meta refresh tag inside of a noscript tag)
    var heads = doc.querySelectorAll('head');
    if (heads.length > 1) {
        while (heads[1].hasChildNodes()) {
            heads[1].removeChild(heads[1].lastChild);
        }
    }

    var disabledHeadContent = Capture.disable(this.headContent, this.prefix);
    // On FF4, iOS 4.3, and potentially other browsers, you cannot modify <head>
    // using innerHTML. In that case, do a manual copy of each element
    try {
        headEl.innerHTML = disabledHeadContent;
    } catch (e) {
        var title = headEl.getElementsByTagName('title')[0];
        title && headEl.removeChild(title);
        Capture.setElementContentFromString(headEl, disabledHeadContent);
    }

    return docFrags;
};

/**
 * Returns an HTML representation of the captured DOM with resources enabled.
 * (escapedHTMLString remains for backwards compatibility)
 */
Capture.prototype.enabledHTMLString = Capture.prototype.escapedHTMLString = function() {
    var doc = this.capturedDoc;
    var html = Capture.enable(Utils.outerHTML(doc.documentElement), this.prefix);
    var htmlWithDoctype = this.doctype + html;
    return htmlWithDoctype;
};

/**
 * Rewrite the document with a new html string
 */
Capture.prototype.render = function(htmlString) {
    var enabledHTMLString;
    if (!htmlString) {
        enabledHTMLString = this.enabledHTMLString();
    } else {
        enabledHTMLString = Capture.enable(htmlString, this.prefix);
    }

    var doc = this.sourceDoc;

    // Set capturing state to false so that the user main code knows how to execute
    if (window.Mobify) window.Mobify.capturing = false;

    var write = function() {
        // Asynchronously render the new document
        setTimeout(function(){
            doc.open("text/html", "replace");
            doc.write(enabledHTMLString);
            doc.close();
        });
    };
    
    if (Capture.isIOS8_0()) {
        Capture.ios8_0ScrollFix(document, write);
    } else {
        write();
    }
};

/**
 * Get the captured document
 */
Capture.prototype.getCapturedDoc = function(options) {
    return this.capturedDoc;
};

Capture.getMobifyLibrary = function(doc) {
    var doc = doc || document;
    var mobifyjsScript = doc.getElementById("mobify-js");

    // v6 tag backwards compatibility change
    if (!mobifyjsScript) {
        mobifyjsScript = doc.getElementsByTagName("script")[0];
        mobifyjsScript.id = "mobify-js";
        mobifyjsScript.setAttribute("class", "mobify");
    }

    return mobifyjsScript;
};

/**
 * Grabs the postload function/src/script if it exists
 */
Capture.getPostload = function(doc) {
    var doc = doc || document;
    var postloadScript = undefined;

    // mainExecutable is used for backwards compatibility purposes
    var tagOptions = window.Mobify.Tag && window.Mobify.Tag.options && window.Mobify.Tag.getOptions(Mobify.Tag.options) || {};
    var postload = (tagOptions.post && tagOptions.post.toString()) || window.Mobify.mainExecutable;
    if (postload) {
        // Checks for main executable string on Mobify object and creates a script
        // out of it
        postloadScript = document.createElement('script');
        postloadScript.innerHTML = "var postload = " + postload + "; postload();";
        postloadScript.id = 'postload';
        postloadScript.setAttribute("class", "mobify");
    } else {
        // Older tags used to insert the main executable by themselves. 
        postloadScript = doc.getElementById("main-executable");
    }
    return postloadScript;
}

/**
 * Insert Mobify scripts back into the captured doc
 * in order for the library to work post-document.write
 */
Capture.insertMobifyScripts = function(sourceDoc, destDoc) {
    // After document.open(), all objects will be removed.
    // To provide our library functionality afterwards, we
    // must re-inject the script.
    var mobifyjsScript = Capture.getMobifyLibrary(sourceDoc);

    var head = destDoc.head || destDoc.getElementsByTagName('head')[0];
    if (!head) {
        return;
    }

    // If main script exists, re-inject it.
    var mainScript = Capture.getPostload(sourceDoc);
    if (mainScript) {
        // Since you can't move nodes from one document to another,
        // we must clone it first using importNode:
        // https://developer.mozilla.org/en-US/docs/DOM/document.importNode
        var mainClone = destDoc.importNode(mainScript, false);
        if (!mainScript.src) {
            mainClone.innerHTML = mainScript.innerHTML;
        }
        head.insertBefore(mainClone, head.firstChild);
    }
    // reinject mobify.js file
    var mobifyjsClone = destDoc.importNode(mobifyjsScript, false);
    head.insertBefore(mobifyjsClone, head.firstChild);
};

/**
 * Render the captured document
 */
Capture.prototype.renderCapturedDoc = function(options) {
    // Insert the mobify scripts back into the captured doc
    Capture.insertMobifyScripts(this.sourceDoc, this.capturedDoc);

    // Inject timing point (because of blowing away objects on document.write)
    // if it exists
    if (window.Mobify && window.Mobify.points) {
        var body = this.bodyEl;
        var date = this.capturedDoc.createElement("div");
        date.id = "mobify-point";
        date.setAttribute("style", "display: none;")
        date.innerHTML = window.Mobify.points[0];
        body.insertBefore(date, body.firstChild);
    }

    this.render();
};

/**
 * patchAnchorLinks
 *
 * Anchor Links `<a href="#foo">Link</a>` are broken on Firefox.
 * We provide a function that patches, but it does break
 * actually changing the URL to show "#foo".
 * 
 */
Capture.patchAnchorLinks = patchAnchorLinks;

return Capture;

}));

define('adaptivejs/adaptive',[
    '$',
    'adaptivejs/defaults',
    'adaptivejs/logger',
    'adaptivejs/utils',
    'mobifyjs/capture'
], function($, Defaults, Logger, Utils, Capture) {

    // Backwards compatibility fix needed for v6 tag
    window.Mobify = window.Mobify || {};
    window.Mobify.api = true;

    // Instantiate the Adaptive object
    var Adaptive = window.Adaptive = window.Adaptive || {};

    /**
    * Restore the original document when capturing
    */
    Adaptive.restore = function() {
        // Make sure we don't render the current doc before restoring
        Adaptive.disabled = true;

        // Inject Mobify analytics script to track errors
        var ajsScript = Utils.getAjs(Defaults.projectName);
        Adaptive.capture.restore(ajsScript);
        window.Mobify.capturing = false;
    };

    /**
    * Set mobify-path= on the cookie and reload the page so that tag falls
    * through to the original page.  Disables adaptation for subsequent requests
    *
    * url: Optional url to redirect to after opting out.
    */
    Adaptive.disable = function(url) {
        document.cookie = 'mobify-path=; path=/;';

        var capturing = window.Mobify && window.Mobify.capturing || false;

        if (!capturing) {
            if (url) {
                window.location = url;
                return;
            }

            // Use window.reload in webkit only since it doesn't work in Firefox
            if (/webkit/i.test(window.navigator.userAgent)) {
                // Clear the mobify-overide hash before reloading (if we don't
                // remove the mobify-override, it will force us back into
                // preview mode again)
                if (Utils.isDebug()) {
                    window.location.hash = '';
                }
                window.location.reload(true);
            } else {
                window.location = window.location.pathname;
            }

            return;
        }

        Adaptive.restore();
    };

    // Method for initializing 'Adaptive'
    // callback(capturedDocument)
    Adaptive.init = function(callback) {
        var capturing = window.Mobify && window.Mobify.capturing || false;

        if (capturing) {
            // Setup the logger and initialize the start time

            Logger.init({start: Mobify.points[0], debug: Utils.isDebug()});
            Logger.addTimingPoint('Starting capture of original document');

            // Grab reference to a newly created document
            Capture.init(function(capture) {
                // Store the 'capture' object on 'Adaptive' for later use when
                // rendering
                Logger.addTimingPoint('Capture is complete');
                Adaptive.capture = capture;
                var buildScript = capture.capturedDoc.getElementsByTagName('script')[0];
                if (buildScript && /adaptive(\.min)?\.js/.test(buildScript.getAttribute('x-src'))) {
                    buildScript.parentNode.removeChild(buildScript);
                }
                // Bind selector engine to the captured document
                $.attachDocument(capture.capturedDoc);
                callback(capture.capturedDoc);
            });
        }
        else {
            // Expose Almond to UI scripts
            Adaptive.AMD = {};
            Adaptive.AMD.require = require;
            Adaptive.AMD.define = define;
            // Expose $ for front-end scripts
            Adaptive.$ = $;

            // We're not capturing. Bind selector library to original document
            $.attachDocument(document);
            // Adds logging points for Load and DOMContentLoaded events
            Logger.setDebugger(Utils.isDebug());
            Logger.addTimingPoint('Rendering Done');
            Logger.addDOMContentListener();
            Logger.addOnLoadListener(function() {
                Logger.logTimingPoints();
            });
        }
    };

    Adaptive.renderPage = function(htmlStr) {
        if (!Adaptive.disabled) {
            if (!Adaptive.capture) {
                throw 'We are using Capturing, but there is no capture object to render';
            }
            Logger.addTimingPoint('Rendering Start');
            Adaptive.capture.render(htmlStr);
        }
    };

    return Adaptive;
});

/*
 * A module for evaluating function and DOM element based template rendering
 * contexts.
 */
/*jshint forin: false */

define('adaptivejs/context',[
    'adaptivejs/utils',
    'adaptivejs/logger'
], function(Utils, Logger) {
    var Context = {};

    var isPrimitive = function(value) {
        var type = typeof value;
        return type !== 'object' && type !== 'function';
    };

    var isArrayLike = function(obj) {
        var isArray = Object.prototype.toString.call(obj) === '[object Array]';
        return isArray || obj.hasOwnProperty('length');
    };

    /**
     *  Recursively evaluates keys of the given context until we get
     *  a DOM node, DOM element, jQuery/Zepto object, or a primitive.
     */
    /* jshint ignore:start */
    Context.process = function(ogContext) {
        var errors = {};
        var walkContext = function(context) {
            var result;
            var value;

            if (context === null) {
                return undefined;
            }

            // Return DOM nodes, DOM elements, and primitives
            if (Utils.isDOMLike(context) || isPrimitive(context)) {
                return context;
            }

            // invoke functions
            if (typeof context === 'function') {
                result = walkContext(context(ogContext));

                // Primatives or complex objects which we don't care
                // to break into
                return result;
            }

            if (isArrayLike(context)) {
                result = [];
                for (var i = 0, len = context.length; i < len; i++) {
                    result.push(walkContext(context[i]));
                }
                return result;
            }

            // We know we are dealing with an object now. Lets grab the object to be
            //  evaluated and replace context with an empty object to fill in with the results
            //  of evaluating the object.
            for (var key in context) {
                if (!context.hasOwnProperty(key)) {
                    continue;
                }

                value = context[key];
                try {
                    Logger.addTimingPoint(key, {namespace: 'Evaluating View'});
                    Logger.increaseStack();
                    context[key] = walkContext(value);

                    // Warn if the key is undefined
                    // Keys should always be assigned some value
                    if (context[key] === undefined) {
                        Logger.log(key + ' key is undefined. Context keys should always return a value', 'warn');
                    }
                    Logger.decreaseStack();
                }
                catch (e) {
                    console.error('Error evaluating key "' + key + '". ' + e.stack);
                    context[key] = undefined;
                    errors[key] = e;
                }
            }

            return context;
        };

        var resultContext = walkContext(ogContext);

        // If there were errors, add them to the resulting context
        if (Object.keys(errors).length) {
            resultContext.errors = errors;
        }
        return resultContext;
    };
    /* jshint ignore:end */

    return Context;

});

/*jshint forin: false */

define('adaptivejs/view',[
    'adaptivejs/context',
    'adaptivejs/logger',
    'adaptivejs/utils'
], function(Context, Logger, Utils) {

    var View = {};

    /**
     *  Executes the passed function, but wraps in a try/catch.
     */
    var safeExecFunction = function(func, errPrefix, params) {
        errPrefix = errPrefix || '';
        params = params || [];
        try {
            func.apply(this, params);
        } catch (e) {
            console.error(errPrefix, e.stack);
        }
    };

    /**
     *  Adds any context from partials to the views context.
     *  Tack on include preProcess methods to the list of methods to run.
     */
    var processIncludes = function(includes, includeMethods, context) {
        // tmp array to preserve preProcess execution order
        var preTemp = [];
        var postTemp = [];
        var tempContext = {};
        for (var key in includes){
            // Don't add include if a child already added it
            if (!includes.hasOwnProperty(key) || context.hasOwnProperty(key)) {
                continue;
            }

            var include = includes[key];

            // Add includes to tempContext which we extend to preserve order
            tempContext[key] = include.context;
            include.preProcess && preTemp.push({'key': key, 'function': include.preProcess});
            include.postProcess && postTemp.push({'key': key, 'function': include.postProcess});
        }

        // Add preProcess methods to the start of the list so they run in order
        includeMethods.preProcess = preTemp.concat(includeMethods.preProcess);
        includeMethods.postProcess = postTemp.concat(includeMethods.postProcess);

        // Add includes to the context
        return Utils.extend(tempContext, context);
    };

    /**
     *  Evaluates and returns a views context by:
     *  1. Extend context of all includes onto the view
     *  2. Extend context of any parent views onto the context
     *  3. Call preProcess method of all includes which define it
     *  4. Call parent views proProcess, unless the child view overrides it
     *  5. Evaluating all the context keys
     *  6. Call postProcess method of all includes which define it
     *  7. Call parent views postProcess, unless the view overrides it
     */
    /* jshint ignore:start */
    View.evaluateContext = function(view, defaultContext) {
        // Used to store preProcess functions for later execution
        var includeMethods = {
            preProcess: [],
            postProcess: []
        };
        var includes = {};
        var error;
        var i;

        // Build up view
        var tempContext = this.compileContext(view, defaultContext, includes, includeMethods);

        // Call all include preProcess functions in correct order
        for (i = 0; i < includeMethods.preProcess.length; i++) {
            var preProcess = includeMethods.preProcess[i];
            error = 'Error calling preProcess from' + preProcess.key;

            tempContext = safeExecFunction(preProcess['function'], error, [tempContext]) || tempContext;
            Logger.addTimingPoint(preProcess.key + 'PreProcess', {namespace: 'Evaluating View'});
        }

        // Call preProcess from the view, or it's closest ancestor
        var viewPreProcess = getClosestProperty(view, 'preProcess');
        if (viewPreProcess) {
            tempContext = safeExecFunction(viewPreProcess, 'Error calling views preProcess', [tempContext]) || tempContext;
            Logger.addTimingPoint('viewPreProcess', {namespace: 'Evaluating View'});
        }

        // Evaluate context
        tempContext = Context.process(tempContext);

        // Call all include postProcess functions
        for (i = 0; i < includeMethods.postProcess.length; i++) {
            var postProcess = includeMethods.postProcess[i];
            error = 'Error calling postProcess from' + postProcess.key;

            tempContext = safeExecFunction(postProcess['function'], error, [tempContext]) || tempContext;
            Logger.addTimingPoint(postProcess.key + 'PostProcess', {namespace: 'Evaluating View'});
        }

        // Call postProcess from the view, or it's closest ancestor
        var viewPostProcess = getClosestProperty(view, 'postProcess');
        if (viewPostProcess){
            tempContext = safeExecFunction(viewPostProcess, 'Error calling views postProcess', [tempContext]) || tempContext;
            Logger.addTimingPoint('viewPostProcess', {namespace: 'Evaluating View'});
        }

        Logger.addTimingPoint('View processed');
        Logger.logCollapsed('Evaluated Context', tempContext);
        return tempContext;
    };
    /* jshint ignore:end */

    /**
     *  Builds up the structure of the views context, inherriting from parents
     *  Doesn't evaluate any functions.
     */
    View.compileContext = function(view, context, includes, includeMethods) {
        var parentView = view.extend;

        // We use this to build the context in the correct order
        var tempContext = context || {};

        // Add all includes to the context
        if (view.includes) {
            tempContext = processIncludes(view.includes, includeMethods, tempContext);
        }

        // If there is a parent view, extend it.
        if (parentView) {
            // Remove keys that will be overridden to preserve order
            for (var key in parentView.context) {
                if (view.context.hasOwnProperty(key)) {
                    delete parentView.context[key];
                }
            }

            tempContext = View.compileContext(view.extend, tempContext, includes, includeMethods);
        }

        // Add the views context after all the previous context keys
        // for proper evaluation order
        tempContext = Utils.extend(tempContext, view.context);

        return tempContext;

    };

    /**
     *  Finds the closest ancestor to the view with the given property.
     *  Returns that property.
     */
    var getClosestProperty = function(view, property) {
        if (!view.extend && !view[property]){
            return undefined;
        }
        return view[property] || getClosestProperty(view.extend, property);
    };

    return View;

});

require([
    'router',
    'adaptivejs/adaptive',
    'adaptivejs/view',
    'adaptivejs/utils',
    'adaptivejs/defaults'
],
function(router, Adaptive, View, Utils, Defaults) {

    Adaptive.init(function(capturedDocument) {
        try {
            var view = router.resolve(capturedDocument);
            if (!view) {
                console.error('No routes were matched. Rendering original document.');
                Adaptive.restore();
                return;
            }

            // Make any changes to defaultContext here, then add it to view.context
            var defaultContext = Defaults.getContext();

            // Build up context of the main view
            var resultContext = View.evaluateContext(view, defaultContext);

            // Feed context to template and render result
            view.template(resultContext, function(err, out) {
                Adaptive.renderPage(out);
            });
        } catch (e) {
            console.error(e.stack);
            Adaptive.restore();
        }
    });

}, undefined, true);
// relPath, forceSync
;
define("main", function(){});

}());
//# sourceMappingURL=adaptive.js.map