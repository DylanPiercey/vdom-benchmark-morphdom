'use strict';

var benchmark = require('vdom-benchmark-base');
var morphdom = require('morphdom');

var NAME = 'morphdom';
var VERSION = '0.1.10';

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
  morphdom(this._root, e);
};

document.addEventListener('DOMContentLoaded', function(e) {
  benchmark(NAME, VERSION, BenchmarkImpl);
}, false);
