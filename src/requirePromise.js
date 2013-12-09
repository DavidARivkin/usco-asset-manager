var NativeModule = require('native_module');
var fs = require('fs');
var Q = require('q');

if(!require.async) require.async = function (path, callback) { module.exports(path, this, callback); } // Comment out if you dislike using globals
module.exports = function(request, parent, callback) {
  var deferred = Q.defer();

  var filename = Module.resolve(request, parent); // This is a Sync function. TODO, change it to an async function with a callback.

  if (Module.cache[filename]) deferred.resolve( Module.cache[filename].exports ); //callback(Module.cache[filename].exports);

  else if (NativeModule.exists(filename)) callback(new Error('What are you thinking?'))
  else fs.readFile(filename, 'utf8', function(err, file) {
    if (Module.cache[filename]) deferred.resolve( Module.cache[filename].exports ) //callback(null, Module.cache[filename].exports); // For the case when there are two calls to require.async at a time.
    else if(err) deferred.resolve( err );//callback(err)
    else {
      var module = new Module(filename, parent);
      try {
        module._compile(file);
        Module.cache[filename] = module;
      } catch(ex) {
        callback(err)
      }
      if(Module.cache[filename]) deferred.resolve( module.exports ); //callback(null, module.exports)
    }


  return defferred.promise;
}
