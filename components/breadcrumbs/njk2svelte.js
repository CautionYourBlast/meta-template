#!/usr/bin/env node
"use strict";
// note: meta-template is not published on npm yet, so you will
// need to clone it and run `npm install && npm link` first!
const mt = require("../../index");
const ast = require("../../ast/index");
const fs = require("fs");
const path = require("path");
const util = require("util");

fs.readdir("./", (err, files) => {
  files
    .filter(file => {
      return path.extname(file) === ".njk";
    })
    .forEach(file => {
      console.log(file);
      const p = parseToSvelte(file);
      p.then(output => {
        console.log(mt.format.svelte(output));
      });
    });
});

function parseToSvelte(filename) {
  return new Promise(function(resolve, reject) {
    mt.parse.file(filename, {}, (u, parsed) => {
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
}
