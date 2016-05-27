(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var benchmark = require('vdom-benchmark-base');
var setDOM = require('set-dom');

var NAME = 'set-dom';
var VERSION = '0.2.3';

function renderTree(nodes, parent, depth) {
  var e;
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    if (n.children !== null) {
      e = document.createElement('div');
      e.id = '' + depth + '_' + n.key;
      parent.appendChild(e);
      renderTree(n.children, e, depth + 1);
    } else {
      e = document.createElement('span');
      e.id = '' + depth + '_' + n.key;
      e.textContent = n.key;
      parent.appendChild(e);
    }
  }
}

function BenchmarkImpl(container, a, b) {
  this.container = container;
  this.a = a;
  this.b = b;
  this._root = null;
}

BenchmarkImpl.prototype.setUp = function() {
};

BenchmarkImpl.prototype.tearDown = function() {
  this.container.removeChild(this.container.firstChild);
};

BenchmarkImpl.prototype.render = function() {
  this._root = document.createElement('div');
  renderTree(this.a, this._root, 0);
  this.container.appendChild(this._root);
};

BenchmarkImpl.prototype.update = function() {
  var e = document.createElement('div');
  renderTree(this.b, e, 0);
  setDOM(this._root, e);
};

document.addEventListener('DOMContentLoaded', function(e) {
  benchmark(NAME, VERSION, BenchmarkImpl);
}, false);

},{"set-dom":2,"vdom-benchmark-base":5}],2:[function(require,module,exports){
'use strict'

var NODE_INDEX = '__set-dom-index__'
var HTML_ELEMENT = document.createElement('html')
var BODY_ELEMENT = document.createElement('body')

module.exports = setDOM

/**
 * @description
 * Updates existing dom to match a new dom.
 *
 * @param {HTMLEntity} prev - The html entity to update.
 * @param {String|HTMLEntity} next - The updated html(entity).
 */
function setDOM (prev, next) {
  // Alias document element with document.
  if (prev === document) prev = document.documentElement

  // If a string was provided we will parse it as dom.
  if (typeof next === 'string') {
    if (prev === document.documentElement) {
      HTML_ELEMENT.innerHTML = next
      next = HTML_ELEMENT
    } else {
      BODY_ELEMENT.innerHTML = next
      next = BODY_ELEMENT.firstChild
    }
  }

  // Update the node.
  setNode(prev, next)
}

/**
 * @private
 * @description
 * Updates a specific htmlNode and does whatever it takes to convert it to another one.
 *
 * @param {HTMLEntity} prev - The previous HTMLNode.
 * @param {HTMLEntity} next - The updated HTMLNode.
 */
function setNode (prev, next) {
  // Handle text node update.
  if (next.nodeName === '#text') {
    if (prev.nodeName !== '#text') {
      // we have to replace the node.
      prev.parentNode.replaceChild(next, prev)
    } else if (prev.nodeValue !== next.nodeValue) {
      // If both are text nodes we can update directly.
      prev.nodeValue = next.nodeValue
    }
    return
  }

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

/*
 * @private
 * @description
 * Utility that will update one list of attributes to match another.
 *
 * @param {HTMLEntity} parent - The current parentNode being updated.
 * @param {Attributes} prev - The previous attributes.
 * @param {Attributes} next - The updated attributes.
 */
function setAttributes (parent, prev, next) {
  var i, a, b, attr

  // Remove old attributes.
  for (i = prev.length; i--;) {
    a = prev.item(i)
    b = next.getNamedItem(a.name)
    if (!b) prev.removeNamedItem(a.name)
  }

  // Set new attributes.
  for (i = next.length; i--;) {
    a = next.item(i)
    b = prev.getNamedItem(a.name)
    if (!b) {
      // Add a new attribute.
      attr = document.createAttribute(a.name)
      attr.value = a.value
      prev.setNamedItem(attr)
    } else if (b.value !== a.value) {
      // Update existing attribute.
      b.value = a.value
    }
  }
}

/*
 * @private
 * @description
 * Utility that will update one list of childNodes to match another.
 *
 * @param {HTMLEntity} parent - The current parentNode being updated.
 * @param {NodeList} prevChildNodes - The previous children.
 * @param {NodeList} nextChildNodes - The updated children.
 */
function setChildNodes (parent, prevChildNodes, nextChildNodes) {
  var key, a, b

  // Convert nodelists into a usuable map.
  var prev = keyNodes(prevChildNodes)
  var next = keyNodes(nextChildNodes)

  // Remove old nodes.
  for (key in prev) {
    if (next[key]) continue
    parent.removeChild(prev[key])
  }

  // Set new nodes.
  for (key in next) {
    a = prev[key]
    b = next[key]

    if (a) {
      // Update an existing node.
      setNode(a, b)
      // Check if the node has moved in the tree.
      if (a[NODE_INDEX] === b[NODE_INDEX]) continue
      // Check if the node has already been repositioned during the diff.
      if (a.nextSibling === prevChildNodes[b[NODE_INDEX]]) continue
      // Reposition node.
      parent.insertBefore(a, prevChildNodes[b[NODE_INDEX]])
    } else {
      // Append the new node.
      parent.appendChild(b)
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
  for (var i = childNodes.length, el; i--;) {
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
 * (Uses 'id' if possible and falls back to 'data-key')
 *
 * @param {HTMLEntity} node - The node to get the key for.
 * @return {String}
 */
function getKey (node) {
  if (typeof node.getAttribute !== 'function') return
  return node.id || node.getAttribute('data-key')
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

},{"./benchmark":3}]},{},[1])


//# sourceMappingURL=main.js.map
