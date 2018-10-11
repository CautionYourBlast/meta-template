"use strict";
const abs = require("./abstract");
const invariant = require("invariant");
const formatFactory = require("./factory");
const nodes = require("nunjucks/src/nodes");
const { parse } = require("nunjucks/src/parser");

const If = function(node) {
  let K_IF = this.K_IF;

  if (node.cond.type == "Not") {
    K_IF = this.K_IF_NOT;
    this._chomp(node.cond.target);
  } else {
    this._chomp(node.cond);
  }

  const parts = [
    this.C_OPEN,
    K_IF,
    this.WS,
    this.node(node.cond),
    this.C_CLOSE,
    this.node(node.body)
  ];

  this._spit(node.cond);

  if (node.else_) {
    parts.push(this.C_OPEN, this.K_ELSE, this.C_CLOSE, this.node(node.else_));
  }

  parts.push(this.C_OPEN, this.K_END_IF, this.C_CLOSE);

  return parts.join("");
};

const _chomp = function(node) {
  switch (node.type) {
    case "Symbol":
    case "Array":
      this._context.unshift(node.value);
      break;

    case "LookupVal":
      var target = node.target;
      var depth = 1;
      while (target.type === "LookupVal") {
        this._context.unshift(target.val.value);
        target = target.target;
        depth++;
      }
      this._context.unshift(target.value);
      node._lookupDepth = depth;
      break;

    default:
      throw new Error(
        'Expected Symbol or LookupVal, but got "' + node.type + '"'
      );
  }
};

const _spit = function(node) {
  switch (node.type) {
    case "Symbol":
    case "Array":
      this._context.shift();
      break;

    case "LookupVal":
      invariant(node._lookupDepth, "Missing _lookupDepth in _spit()");
      this._context.splice(0, node._lookupDepth);
      break;
  }
};

const For = function(node) {
  const arrName = this.node(node.arr);
  let name = this.node(node.name);
  if (name.includes(" ")) {
    name = `{ ${name.split(" ").join(",")} }`;
  }
  const parts = ["{#each ", arrName, " as ", name, "}"];
  parts.push(this.node(node.body));
  parts.push("{/each}");

  return parts.join("");
};

const Filter = function(node) {
  const name = this.filterAliasMap[node.name.value] || node.name.value;
  return [
    name,
    "(",
    node.args.children.map(arg => this.node(arg)).join(", "),
    ")"
  ].join("");
};

/**
 * @return {string}
 */
const Macro = function(node) {
  const fileName = node.body.children
    .find(child => {
      return child.template;
    })
    .template.value.replace(/\.[^\.]+$/, ".html");

  const componentName = node.name.value;

  const scriptTag = `
    <script>
    import ${componentName} from ${fileName} 
    export default {
    	data() {
    		return {
    		}
    	},
    	components: {
    	    ${componentName}
    	}
    }
    </script>
    `;

  const params = this.node(node.args);

  let parts = [`<${componentName}`, ` {${params}} `, `/>`, scriptTag];

  return parts.join("");
};

const LookupVal = function(node) {
  const stack = [node.val.value];
  var target = node.target;
  while (target.type === "LookupVal") {
    stack.unshift(target.val.value);
    target = target.target;
  }
  stack.unshift(target.value);

  var i = 0;
  while (this._context[i] && stack[0] === this._context[i]) {
    // console.warn('trimming:', stack[0], '@', i);
    stack.shift();
    i++;
  }

  if (stack.length === 0) {
    return ".";
  } else if (stack.length === 1) {
    return this.Symbol({ value: stack[0] });
  } else {
    return stack.reduce((out, symbol) => {
      return out + this.accessor(symbol);
    }, stack.shift());
  }
};

const quote = function(symbol) {
  // symbols are never quoted, even in accessor expressions
  return symbol;
};

const accessor = function(symbol) {
  // any valid JavaScript identifier just gets a leading ".";
  // otherwise, we "escape" the symbol with brackets
  return this.P_IDENTIFIER.test(symbol) ? "." + symbol : ".[" + symbol + "]";
};

const NodeList = function(node) {
  return node.children.map(child => this.node(child)).join(" ");
};

module.exports = formatFactory({
  WS: "",

  // note that our control structure open and close delimiters
  // do *not* include the leading #, since some keyword equivalents
  // do not use it ("^" for else, etc.)
  C_OPEN: "{",
  C_CLOSE: "}",
  // for parity with other templating systems,
  // output should *not* be HTML-escaped (double curlies)
  O_OPEN: "{",
  O_CLOSE: "}",

  K_IF: "#if ",
  K_ELSE: ":else",
  K_ELSE_IF: ":elseif",
  K_END_IF: "/if",

  K_EACH: "#each ",
  K_END_EACH: "/each",
  K_FOR: "#each ",

  // current symbol context
  _context: [],

  P_NUMERIC: abs.P_NUMERIC,
  P_WORD: abs.P_WORD,
  P_IDENTIFIER: /^[a-z]\w*$/i,

  _chomp: _chomp,
  _spit: _spit,

  filterAliasMap: {
    safe: "raw"
  },

  literalAliases: {
    null: "nil"
  },

  // abstract word quoting helper
  Array: NodeList,
  quote: abs.quote,
  accessor: abs.accessor,
  Block: abs.Block,
  Capture: abs.Capture,
  Compare: abs.Compare,
  Extends: abs.Extends,
  For: For,
  Filter: Filter,
  Group: abs.Group,
  If: abs.If,
  InlineIf: abs.If,
  Include: abs.Include,
  Literal: abs.Literal,
  LookupVal: abs.LookupVal,
  NodeList: abs.NodeList,
  Not: abs.Not,
  Operator: abs.Operator,
  Output: abs.Output,
  Root: abs.NodeList,
  Symbol: abs.Symbol,
  TemplateData: abs.TemplateData,
  Macro: Macro
});