(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

var parseHTML = require('./parse-html')
var KEY_PREFIX = '_set-dom-'
var NODE_INDEX = KEY_PREFIX + 'index'
var NODE_MOUNTED = KEY_PREFIX + 'mounted'
var ELEMENT_TYPE = window.Node.ELEMENT_NODE
var DOCUMENT_TYPE = window.Node.DOCUMENT_NODE
setDOM.KEY = 'data-key'
setDOM.IGNORE = 'data-ignore'

module.exports = setDOM

/**
 * @description
 * Updates existing dom to match a new dom.
 *
 * @param {Node} prev - The html entity to update.
 * @param {String|Node} next - The updated html(entity).
 */
function setDOM (prev, next) {
  // Ensure a realish dom node is provided.
  assert(prev && prev.nodeType, 'You must provide a valid node to update.')

  // Alias document element with document.
  if (prev.nodeType === DOCUMENT_TYPE) prev = prev.documentElement

  // If a string was provided we will parse it as dom.
  if (typeof next === 'string') next = parseHTML(next, prev.nodeName)

  // Update the node.
  setNode(prev, next)

  // Trigger mount events on initial set.
  if (!prev[NODE_MOUNTED]) {
    prev[NODE_MOUNTED] = true
    mount(prev)
  }
}

/**
 * @private
 * @description
 * Updates a specific htmlNode and does whatever it takes to convert it to another one.
 *
 * @param {Node} prev - The previous HTMLNode.
 * @param {Node} next - The updated HTMLNode.
 */
function setNode (prev, next) {
  if (prev.nodeType === next.nodeType) {
    // Handle regular element node updates.
    if (prev.nodeType === ELEMENT_TYPE) {
      // Ignore elements that explicity choose not to be diffed.
      if (!(prev.attributes[setDOM.IGNORE] && next.attributes[setDOM.IGNORE])) {
        // Update all children (and subchildren).
        setChildNodes(prev, prev.childNodes, next.childNodes)

        // Update the elements attributes / tagName.
        if (prev.nodeName === next.nodeName) {
          // If we have the same nodename then we can directly update the attributes.
          setAttributes(prev, prev.attributes, next.attributes)
        } else {
          // Otherwise clone the new node to use as the existing node.
          var newPrev = next.cloneNode()
          // Copy over all existing children from the original node.
          while (prev.firstChild) newPrev.appendChild(prev.firstChild)
          // Replace the original node with the new one with the right tag.
          prev.parentNode.replaceChild(newPrev, prev)
        }
      }
    } else {
      // Handle other types of node updates (text/comments/etc).
      // If both are the same type of node we can update directly.
      if (prev.nodeValue !== next.nodeValue) {
        prev.nodeValue = next.nodeValue
      }
    }
  } else {
    // we have to replace the node.
    dismount(prev)
    prev.parentNode.replaceChild(next, prev)
    mount(next)
  }
}

/**
 * @private
 * @description
 * Utility that will update one list of attributes to match another.
 *
 * @param {Node} parent - The current parentNode being updated.
 * @param {NamedNodeMap} prev - The previous attributes.
 * @param {NamedNodeMap} next - The updated attributes.
 */
function setAttributes (parent, prev, next) {
  var i, a, b, ns, name

  // Remove old attributes.
  for (i = prev.length; i--;) {
    a = prev[i]
    ns = a.namespaceURI
    name = a.localName
    b = next.getNamedItemNS(ns, name)
    if (!b) prev.removeNamedItemNS(ns, name)
  }

  // Set new attributes.
  for (i = next.length; i--;) {
    a = next[i]
    ns = a.namespaceURI
    name = a.localName
    b = prev.getNamedItemNS(ns, name)
    if (!b) {
      // Add a new attribute.
      next.removeNamedItemNS(ns, name)
      prev.setNamedItemNS(a)
    } else if (b.value !== a.value) {
      // Update existing attribute.
      b.value = a.value
    }
  }
}

/**
 * @private
 * @description
 * Utility that will update one list of childNodes to match another.
 *
 * @param {Node} parent - The current parentNode being updated.
 * @param {NodeList} prevChildNodes - The previous children.
 * @param {NodeList} nextChildNodes - The updated children.
 */
function setChildNodes (parent, prevChildNodes, nextChildNodes) {
  var key, a, b, newPosition, nextEl

  // Convert nodelists into a usuable map.
  var prev = keyNodes(prevChildNodes)
  var next = keyNodes(nextChildNodes)

  // Remove old nodes.
  for (key in prev) {
    if (next[key]) continue
    // Trigger custom dismount event.
    dismount(prev[key])
    // Remove child from dom.
    parent.removeChild(prev[key])
  }

  // Set new nodes.
  for (key in next) {
    a = prev[key]
    b = next[key]
    // Extract the position of the new node.
    newPosition = b[NODE_INDEX]

    if (a) {
      // Update an existing node.
      setNode(a, b)
      // Check if the node has moved in the tree.
      if (a[NODE_INDEX] === newPosition) continue
      // Get the current element at the new position.
      /* istanbul ignore next */
      nextEl = prevChildNodes[newPosition] || null // TODO: figure out if || null is needed.
      // Check if the node has already been properly positioned.
      if (nextEl === a) continue
      // Reposition node.
      parent.insertBefore(a, nextEl)
    } else {
      // Get the current element at the new position.
      nextEl = prevChildNodes[newPosition] || null
      // Append the new node at the correct position.
      parent.insertBefore(b, nextEl)
      // Trigger custom mounted event.
      mount(b)
    }
  }
}

/**
 * @private
 * @description
 * Converts a nodelist into a keyed map.
 * This is used for diffing while keeping elements with 'data-key' or 'id' if possible.
 *
 * @param {NodeList} childNodes - The childNodes to convert.
 * @return {Object}
 */
function keyNodes (childNodes) {
  var result = {}
  var len = childNodes.length
  var el

  for (var i = 0; i < len; i++) {
    el = childNodes[i]
    el[NODE_INDEX] = i
    result[getKey(el) || i] = el
  }

  return result
}

/**
 * @private
 * @description
 * Utility to try to pull a key out of an element.
 * Uses 'data-key' if possible and falls back to 'id'.
 *
 * @param {Node} node - The node to get the key for.
 * @return {String}
 */
function getKey (node) {
  if (node.nodeType !== ELEMENT_TYPE) return
  var key = node.getAttribute(setDOM.KEY) || node.id
  if (key) key = KEY_PREFIX + key
  return key && KEY_PREFIX + key
}

/**
 * Recursively trigger a mount event for a node and it's children.
 *
 * @param {Node} node - the initial node to be mounted.
 */
function mount (node) {
  // Trigger mount event for this element if it has a key.
  if (getKey(node)) dispatch(node, 'mount')

  // Mount all children.
  var child = node.firstChild
  while (child) {
    mount(child)
    child = child.nextSibling
  }
}

/**
 * Recursively trigger a dismount event for a node and it's children.
 *
 * @param {Node} node - the initial node to be dismounted.
 */
function dismount (node) {
  // Dismount all children.
  var child = node.firstChild
  while (child) {
    dismount(child)
    child = child.nextSibling
  }

  // Trigger dismount event for this element if it has a key.
  if (getKey(node)) dispatch(node, 'dismount')
}

/**
 * @private
 * @description
 * Create and dispatch a custom event.
 *
 * @param {Node} el - the node to dispatch the event for.
 * @param {String} type - the name of the event.
 */
function dispatch (el, type) {
  var e = document.createEvent('Event')
  var prop = { value: el }
  e.initEvent(type, false, false)
  Object.defineProperty(e, 'target', prop)
  Object.defineProperty(e, 'srcElement', prop)
  el.dispatchEvent(e)
}

/**
 * @private
 * @description
 * Confirm that a value is truthy, throws an error message otherwise.
 *
 * @param {*} val - the val to test.
 * @param {String} msg - the error message on failure.
 * @throws Error
 */
function assert (val, msg) {
  if (!val) throw new Error('set-dom: ' + msg)
}

},{"./parse-html":2}],2:[function(require,module,exports){
'use strict'

var parser = new window.DOMParser()
var htmlType = 'text/html'
var xhtmlType = 'application/xhtml+xml'
var testCode = '<i></i>'
var documentRootName = 'HTML'
var supportsHTMLType = false
var supportsXHTMLType = false

// Check if browser supports text/html DOMParser
try {
  /* istanbul ignore next: Fails in older browsers */
  if (parser.parseFromString(testCode, htmlType)) supportsHTMLType = true
} catch (err) {}

try {
  /* istanbul ignore next: Only used in ie9 */
  if (!supportsHTMLType && parser.parseFromString(testCode, xhtmlType)) supportsXHTMLType = true
} catch (err) {}

/**
 * Returns the results of a DOMParser as an HTMLElement.
 * (Shims for older browser and IE9).
 */
module.exports = supportsHTMLType
  ? function parseHTML (markup, rootName) {
    var doc = parser.parseFromString(markup, htmlType)
    return rootName === documentRootName
      ? doc.documentElement
      : doc.body.firstChild
  }
  /* istanbul ignore next: Only used in older browsers */
  : function parseHTML (markup, rootName) {
    var isRoot = rootName === documentRootName

    // Special case for ie9 (documentElement.innerHTML not supported).
    if (supportsXHTMLType && isRoot) {
      return parser.parseFromString(markup, xhtmlType).documentElement
    }

    // Fallback to innerHTML for other older browsers.
    var doc = document.implementation.createHTMLDocument('')
    if (isRoot) {
      doc.documentElement.innerHTML = markup
      return doc.documentElement
    } else {
      doc.body.innerHTML = markup
      return doc.body.firstChild
    }
  }

},{}],3:[function(require,module,exports){
'use strict';

var Executor = require('./executor');

function Benchmark() {
  this.running = false;
  this.impl = null;
  this.tests = null;
  this.reportCallback = null;
  this.enableTests = false;

  this.container = document.createElement('div');

  this._runButton = document.getElementById('RunButton');
  this._iterationsElement = document.getElementById('Iterations');
  this._reportElement = document.createElement('pre');

  document.body.appendChild(this.container);
  document.body.appendChild(this._reportElement);

  var self = this;

  this._runButton.addEventListener('click', function(e) {
    e.preventDefault();

    if (!self.running) {
      var iterations = parseInt(self._iterationsElement.value);
      if (iterations <= 0) {
        iterations = 10;
      }

      self.run(iterations);
    }
  }, false);

  this.ready(true);
}

Benchmark.prototype.ready = function(v) {
  if (v) {
    this._runButton.disabled = '';
  } else {
    this._runButton.disabled = 'true';
  }
};

Benchmark.prototype.run = function(iterations) {
  var self = this;
  this.running = true;
  this.ready(false);

  new Executor(self.impl, self.container, self.tests, 1, function() { // warmup
    new Executor(self.impl, self.container, self.tests, iterations, function(samples) {
      self._reportElement.textContent = JSON.stringify(samples, null, ' ');
      self.running = false;
      self.ready(true);
      if (self.reportCallback != null) {
        self.reportCallback(samples);
      }
    }, undefined, false).start();
  }, undefined, this.enableTests).start();
};

module.exports = Benchmark;

},{"./executor":4}],4:[function(require,module,exports){
'use strict';

function render(nodes) {
  var children = [];
  var j;
  var c;
  var i;
  var e;
  var n;

  for (i = 0; i < nodes.length; i++) {
    n = nodes[i];
    if (n.children !== null) {
      e = document.createElement('div');
      c = render(n.children);
      for (j = 0; j < c.length; j++) {
        e.appendChild(c[j]);
      }
      children.push(e);
    } else {
      e = document.createElement('span');
      e.textContent = n.key.toString();
      children.push(e);
    }
  }

  return children;
}

function testInnerHtml(testName, nodes, container) {
  var c = document.createElement('div');
  var e = document.createElement('div');
  var children = render(nodes);
  for (var i = 0; i < children.length; i++) {
    e.appendChild(children[i]);
  }
  c.appendChild(e);
  if (c.innerHTML !== container.innerHTML) {
    console.log('error in test: ' + testName);
    console.log('container.innerHTML:');
    console.log(container.innerHTML);
    console.log('should be:');
    console.log(c.innerHTML);
  }
}


function Executor(impl, container, tests, iterations, cb, iterCb, enableTests) {
  if (iterCb === void 0) iterCb = null;

  this.impl = impl;
  this.container = container;
  this.tests = tests;
  this.iterations = iterations;
  this.cb = cb;
  this.iterCb = iterCb;
  this.enableTests = enableTests;

  this._currentTest = 0;
  this._currentIter = 0;
  this._renderSamples = [];
  this._updateSamples = [];
  this._result = [];

  this._tasksCount = tests.length * iterations;

  this._iter = this.iter.bind(this);
}

Executor.prototype.start = function() {
  this._iter();
};

Executor.prototype.finished = function() {
  this.cb(this._result);
};

Executor.prototype.progress = function() {
  if (this._currentTest === 0 && this._currentIter === 0) {
    return 0;
  }

  var tests = this.tests;
  return (this._currentTest * tests.length + this._currentIter) / (tests.length * this.iterataions);
};

Executor.prototype.iter = function() {
  if (this.iterCb != null) {
    this.iterCb(this);
  }

  var tests = this.tests;

  if (this._currentTest < tests.length) {
    var test = tests[this._currentTest];

    if (this._currentIter < this.iterations) {
      var e, t;
      var renderTime, updateTime;

      e = new this.impl(this.container, test.data.a, test.data.b);
      e.setUp();

      t = window.performance.now();
      e.render();
      renderTime = window.performance.now() - t;

      if (this.enableTests) {
        testInnerHtml(test.name + 'render()', test.data.a, this.container);
      }

      t = window.performance.now();
      e.update();
      updateTime = window.performance.now() - t;

      if (this.enableTests) {
        testInnerHtml(test.name + 'update()', test.data.b, this.container);
      }

      e.tearDown();

      this._renderSamples.push(renderTime);
      this._updateSamples.push(updateTime);

      this._currentIter++;
    } else {
      this._result.push({
        name: test.name + ' ' + 'render()',
        data: this._renderSamples.slice(0)
      });

      this._result.push({
        name: test.name + ' ' + 'update()',
        data: this._updateSamples.slice(0)
      });

      this._currentTest++;

      this._currentIter = 0;
      this._renderSamples = [];
      this._updateSamples = [];
    }

    setTimeout(this._iter, 0);
  } else {
    this.finished();
  }
};

module.exports = Executor;

},{}],5:[function(require,module,exports){
'use strict';

var Benchmark = require('./benchmark');
var benchmark = new Benchmark();

function initFromScript(scriptUrl, impl) {
  var e = document.createElement('script');
  e.src = scriptUrl;

  e.onload = function() {
    benchmark.tests = window.generateBenchmarkData().units;
    benchmark.ready(true);
  };

  document.head.appendChild(e);
}

function initFromParentWindow(parent, name, version, id) {
  window.addEventListener('message', function(e) {
    var data = e.data;
    var type = data.type;

    if (type === 'tests') {
      benchmark.tests = data.data;
      benchmark.reportCallback = function(samples) {
        parent.postMessage({
          type: 'report',
          data: {
            name: name,
            version: version,
            samples: samples
          },
          id: id
        }, '*');
      };
      benchmark.ready(true);

      parent.postMessage({
        type: 'ready',
        data: null,
        id: id
      }, '*');
    } else if (type === 'run') {
      benchmark.run(data.data.iterations);
    }
  }, false);

  parent.postMessage({
    type: 'init',
    data: null,
    id: id
  }, '*');
}

function init(name, version, impl) {
  // Parse Query String.
  var qs = (function(a) {
    if (a == "") return {};
    var b = {};
    for (var i = 0; i < a.length; ++i) {
      var p=a[i].split('=', 2);
      if (p.length == 1) {
        b[p[0]] = "";
      } else {
        b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
      }
    }
    return b;
  })(window.location.search.substr(1).split('&'));

  if (qs['name'] !== void 0) {
    name = qs['name'];
  }

  if (qs['version'] !== void 0) {
    version = qs['version'];
  }

  var type = qs['type'];

  if (qs['test'] !== void 0) {
    benchmark.enableTests = true;
    console.log('tests enabled');
  }

  var id;
  if (type === 'iframe') {
    id = qs['id'];
    if (id === void 0) id = null;
    initFromParentWindow(window.parent, name, version, id);
  } else if (type === 'window') {
    if (window.opener != null) {
      id = qs['id'];
      if (id === void 0) id = null;
      initFromParentWindow(window.opener, name, version, id);
    } else {
      console.log('Failed to initialize: opener window is NULL');
    }
  } else {
    var testsUrl = qs['data']; // url to the script generating test data
    if (testsUrl !== void 0) {
      initFromScript(testsUrl);
    } else {
      console.log('Failed to initialize: cannot load tests data');
    }
  }

  benchmark.impl = impl;
}

// performance.now() polyfill
// https://gist.github.com/paulirish/5438650
// prepare base perf object
if (typeof window.performance === 'undefined') {
  window.performance = {};
}
if (!window.performance.now){
  var nowOffset = Date.now();
  if (performance.timing && performance.timing.navigationStart) {
    nowOffset = performance.timing.navigationStart;
  }
  window.performance.now = function now(){
    return Date.now() - nowOffset;
  };
}

module.exports = init;

},{"./benchmark":3}],6:[function(require,module,exports){
module.exports={
  "private": true,
  "name": "vdom-benchmark-set-dom",
  "version": "0.2.0",
  "description": "Virtual DOM Benchmark: set-dom",
  "license": "BSD",
  "repository": "https://github.com/localvoid/vdom-benchmark-set-dom",
  "author": {
    "name": "Boris Kaul",
    "email": "localvoid@gmail.com",
    "url": "https://github.com/localvoid"
  },
  "keywords": [
    "virtual",
    "dom",
    "virtualdom",
    "vdom",
    "diff",
    "browser",
    "benchmark",
    "vdom-benchmark"
  ],
  "dependencies": {
    "envify": "~3.4.1",
    "set-dom": "^5.0.2",
    "vdom-benchmark-base": "~0.2.4"
  },
  "devDependencies": {
    "browser-sync": "^2.17.5",
    "browserify": "^13.1.0",
    "del": "^2.2.2",
    "gulp": "^3.9.1",
    "gulp-gh-pages": "~0.5.4",
    "gulp-if": "^2.0.1",
    "gulp-sourcemaps": "^2.1.1",
    "gulp-uglify": "^2.0.0",
    "vinyl-buffer": "^1.0.0",
    "vinyl-source-stream": "^1.1.0"
  }
}

},{}],7:[function(require,module,exports){
'use strict'

var benchmark = require('vdom-benchmark-base')
var setDOM = require('set-dom')

var NAME = 'set-dom'
var VERSION = require('../../package.json').dependencies['set-dom']

function renderTree (nodes, parent, depth) {
  var e
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i]
    if (n.children !== null) {
      e = document.createElement('div')
      e.id = '' + depth + '_' + n.key
      parent.appendChild(e)
      renderTree(n.children, e, depth + 1)
    } else {
      e = document.createElement('span')
      e.id = '' + depth + '_' + n.key
      e.textContent = n.key
      parent.appendChild(e)
    }
  }
}

function BenchmarkImpl (container, a, b) {
  this.container = container
  this.a = a
  this.b = b
  this._root = null
}

BenchmarkImpl.prototype.setUp = function () {}

BenchmarkImpl.prototype.tearDown = function () {
  this.container.removeChild(this.container.firstChild)
}

BenchmarkImpl.prototype.render = function () {
  this._root = document.createElement('div')
  renderTree(this.a, this._root, 0)
  this.container.appendChild(this._root)
}

BenchmarkImpl.prototype.update = function () {
  var e = document.createElement('div')
  renderTree(this.b, e, 0)
  setDOM(this._root, e)
}

document.addEventListener('DOMContentLoaded', function (e) {
  benchmark(NAME, VERSION, BenchmarkImpl)
}, false)

},{"../../package.json":6,"set-dom":1,"vdom-benchmark-base":5}]},{},[7])


//# sourceMappingURL=main.js.map
