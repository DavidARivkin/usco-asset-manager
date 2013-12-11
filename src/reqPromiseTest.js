var THREE = require('three');
var fs = require('fs')
var requirePromise = require("./requirePromise");

stlParserProm = requirePromise("./STLParser")
objParserProm = requirePromise("./OBJParser")

stlParserProm.then(function(module){
  console.log("promise returned stl parser module data", module);

  try
  {
    var parser = new module();

    var data = fs.readFileSync("src/slotted_disk_ascii.stl",'binary')
    var parsedSTL = parser.parse(data);
    console.log("result",parsedSTL.vertices.length);

  }catch(error)
  {
    console.log("error",error)
  }
});

objParserProm.then(function(module){
  console.log("promise returned obj parser module data", module)
});
