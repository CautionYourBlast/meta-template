#!/usr/bin/env node
"use strict";
// note: meta-template is not published on npm yet, so you will
// need to clone it and run `npm install && npm link` first!
const mt = require("../../index");
const ast = require("../../ast/index");
const fs = require("fs");
const path = require("path");
const util = require("util");

const p = new Promise(function(resolve, reject) {
  mt.parse.file("macro.njk", {}, (u, parsed) => {
    // console.log(util.inspect(parsed, false, null, true));
    // console.log("\n \n \n");
    resolve(
      ast.walk(parsed, node => {
        if (node.type === "Include") {
          const template = fs.readFileSync(path.join(node.template.value));
          const parsedTemplate = mt.parse.buffer(template);
          node.type = parsedTemplate.type;
          node.children = parsedTemplate.children;
          return node;
        }
      })
    );
  });
});

p.then(output => {
  const out = mt.format.svelte(output);
  console.log(out);
});

//

// console.log(out);
