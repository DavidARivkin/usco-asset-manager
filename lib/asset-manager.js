require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"gpXRB5":[function(require,module,exports){
'use strict';
var AssetManager, Minilog, Q, Resource, detectEnv, logger, pathUtils, requireP,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

Q = require('q');

detectEnv = require("composite-detect");

requireP = require("./requirePromise");

Resource = require("./resource.coffee");

pathUtils = require("./pathUtils.coffee");

if (detectEnv.isModule) {
  Minilog = require("minilog");
  logger = Minilog('asset-manager');
}

if (detectEnv.isBrowser) {
  Minilog.pipe(Minilog.suggest).pipe(Minilog.backends.console.formatClean).pipe(Minilog.backends.console);
  logger = Minilog('asset-manager');
}

if (detectEnv.isNode) {
  Minilog.pipe(Minilog.suggest).pipe(Minilog.backends.console.formatColor).pipe(Minilog.backends.console);
}


/**
 *Manager for lifecyle of assets: load, store unload 
 *For external code files, stl, amf, textures, fonts etc
*
 */

AssetManager = (function() {
  function AssetManager(stores) {
    this._loadParser = __bind(this._loadParser, this);
    this.addSerializer = __bind(this.addSerializer, this);
    this.addParser = __bind(this.addParser, this);
    this.addStore = __bind(this.addStore, this);
    this.stores = stores || {};
    this.parsers = {};
    this.serializers = {};
    this.assetCache = {};
    this.codeExtensions = ["coffee", "litcoffee", "ultishape", "scad"];
  }

  AssetManager.prototype.addStore = function(name, store) {
    return this.stores[name] = store;
  };

  AssetManager.prototype.addParser = function(extension, parser) {
    return this.parsers[extension] = parser;
  };

  AssetManager.prototype.addSerializer = function(extension, serializer) {
    return this.serializers[extension] = serializer;
  };


  /** 
   * fileUri : path to the file, starting with the node prefix
   * options: object : additionnal options for loading resource
   *  options.parentUri : string : not sure we should have this here : for relative path resolution
   *  options.transient : boolean : if true, don't store the resource in cache, default;false
   *  options.keepRawData: boolean: if true, keep a copy of the original data (un-parsed)
   * 
   * If no store is specified, file paths are expected to be relative
   */

  AssetManager.prototype.load = function(fileUri, options) {
    var deferred, error, extension, fetchOptions, file, filename, keepRawData, loadedResource, parentUri, parseOptions, parserPromise, resource, store, storeName, transient, _ref, _ref1;
    options = options || {};
    parentUri = options.parentUri || null;
    transient = options.transient || false;
    keepRawData = options.keepRawData || false;
    fetchOptions = options.fetching || {};
    parseOptions = options.parsing || {};
    deferred = Q.defer();
    if (fileUri == null) {
      deferred.reject("Invalid file name : " + fileUri);
      return deferred;
    }
    if ((typeof File !== "undefined" && File !== null) && fileUri instanceof File) {
      _ref = ["desktop", fileUri.name], storeName = _ref[0], filename = _ref[1];
      file = fileUri;
      fileUri = fileUri.name;
    } else {
      fileUri = pathUtils.toAbsoluteUri(fileUri, parentUri);
      _ref1 = pathUtils.parseFileUri(fileUri, parentUri), storeName = _ref1[0], filename = _ref1[1];
    }
    logger.info("Attempting to load :", filename, "from store:", storeName);
    resource = new Resource(fileUri);
    resource.deferred = deferred;
    store = this.stores[storeName];
    if (!store) {
      error = new Error("No store named " + storeName);
      deferred.reject(error);
      return deferred;
    }
    extension = resource.ext;
    if (!(filename in this.assetCache)) {
      parserPromise = this._loadParser(extension);
      parserPromise.then((function(_this) {
        return function(parser) {
          var fileOrFileName, inputDataType, rawDataDeferred;
          fileOrFileName = storeName === "desktop" ? file : filename;
          if (parser.inputDataType != null) {
            inputDataType = parser.inputDataType;
            rawDataDeferred = store.read(fileOrFileName, {
              dataType: inputDataType
            });
          } else {
            rawDataDeferred = store.read(fileOrFileName);
          }
          deferred.promise.fail(function(error) {
            return rawDataDeferred.reject(error);
          });
          return rawDataDeferred.promise.then(function(loadedResource) {
            var resourceDeferred;
            resource.fetched = true;
            deferred.notify({
              parsing: 0
            });
            resource.rawData = keepRawData ? loadedResource : null;
            resourceDeferred = parser.parse(loadedResource, parseOptions);
            loadedResource = resourceDeferred.promise;
            deferred.promise.fail(function(error) {
              return resourceDeferred.reject(error);
            });
            return Q.when(loadedResource, function(value) {
              loadedResource = value;
              resource.data = loadedResource;
              resource.loaded = true;
              if (!transient) {
                _this.assetCache[fileUri] = resource;
              }
              return deferred.resolve(resource);
            });
          }).progress(function(progress) {
            logger.debug("got some progress", JSON.stringify(progress));
            console.log(progress);
            if ("fetching" in progress) {
              resource.fetchProgress = progress.fetching;
            }
            if ("parsing" in progress) {
              resource.parseProgress = progress.parsing;
            }
            deferred.notify(progress);
            return resource.size = progress.total;
          }).fail(function(error) {
            logger.error("failure in data reading step", error);
            resource.error = error.message;
            return deferred.reject(resource);
          });
        };
      })(this)).fail((function(_this) {
        return function(error) {
          logger.error("failure in getting parser", error);
          resource.error = "No parser found for " + extension + " file format";
          return deferred.reject(resource);
        };
      })(this));
    } else {
      loadedResource = this.assetCache[filename];
      deferred.resolve(loadedResource);
    }
    return resource;
  };

  AssetManager.prototype._loadParser = function(extension) {
    var parser, parserDeferred, parserName, parserPromise;
    parser = this.parsers[extension];
    parserDeferred = Q.defer();
    if (!parser) {
      parserName = extension.toUpperCase() + "Parser";
      parserPromise = requireP(parserName);
      parserPromise.then((function(_this) {
        return function(parserKlass) {
          parser = new parserKlass();
          _this.parsers[extension] = parser;
          return parserDeferred.resolve(parser);
        };
      })(this)).fail(function(error) {
        return parserDeferred.reject(error);
      });
    } else {
      parserDeferred.resolve(parser);
    }
    return parserDeferred.promise;
  };


  /**** 
  *remove resource from cached assets
   */

  AssetManager.prototype.unLoad = function(fileUri) {
    if (fileUri in this.assetCache) {
      return delete this.assetCache[fileUri];
    }
  };

  AssetManager.prototype.save = function(fileUri) {};

  AssetManager.prototype["delete"] = function(fileUri) {};

  AssetManager.prototype.stats = function(fileUri, parentUri) {
    var filename, store, storeName, _ref;
    if (fileUri == null) {
      throw new Error("Invalid file name : " + fileUri);
    }
    fileUri = this._toAbsoluteUri(fileUri, parentUri);
    _ref = this._parseFileUri(fileUri, parentUri), storeName = _ref[0], filename = _ref[1];
    logger.info("Attempting to load :", filename, "from store:", storeName);
    store = this.stores[storeName];
    if (!store) {
      throw new Error("No store named " + storeName);
    }
    return store.stats(fileUri);
  };


  /****
  *load project (folder): TODO: should this be here ??
  * @param {string} uri: folder/url path
   */

  AssetManager.prototype.loadProject = function(uri) {
    var deferred, storeName;
    deferred = Q.defer();
    storeName = this._parseStoreName(uri);
    return deferred.promise;
  };

  AssetManager.prototype.clearResources = function(options) {
    var clearCache;
    options = options || {};
    clearCache = options.clearCache || false;

    /*while((deferred=this.resouceDeferreds.pop()) != null){
      deferred.reject();
    }
     */
    return this.assetCache = {};
  };

  return AssetManager;

})();

module.exports = AssetManager;


},{"./pathUtils.coffee":3,"./requirePromise":4,"./resource.coffee":5,"composite-detect":false,"minilog":false,"q":false}],"asset-manager":[function(require,module,exports){
module.exports=require('gpXRB5');
},{}],3:[function(require,module,exports){
var parseFileUri, path, toAbsoluteUri;

path = require('path');

parseFileUri = function(fileUri) {
  var fileName, pathInfo, storeName, url;
  url = require('url');
  pathInfo = url.parse(fileUri);
  storeName = pathInfo.protocol;
  fileName = pathInfo.host + pathInfo.pathname;
  storeName = storeName.replace(":", "");
  if (storeName === null) {
    if (pathInfo.path[0] === "/") {
      storeName = "local";
    } else {

    }
  } else if (storeName === "http" || storeName === "https") {
    storeName = "xhr";
    fileName = pathInfo.href;
  }
  return [storeName, fileName];
};

toAbsoluteUri = function(fileName, parentUri, store) {
  var fullPath, isXHr, rootUri, segments;
  path = require('path');
  segments = fileName.split("/");
  if (segments[0] !== '.' && segments[0] !== '..') {
    return fileName;
  }
  rootUri = parentUri || store.rootUri || "";
  fileName = path.normalize(fileName);
  isXHr = rootUri.indexOf("http") !== -1;
  if (isXHr) {
    fullPath = rootUri + fileName;
  } else {
    rootUri = rootUri[rootUri.length - 1] === "/" ? rootUri += "a" : rootUri;
    rootUri = path.normalize(rootUri);
    rootUri = path.dirname(rootUri);
    fullPath = path.join(rootUri, fileName);
  }
  return fullPath;
};

module.exports.parseFileUri = parseFileUri;

module.exports.toAbsoluteUri = toAbsoluteUri;


},{"path":false,"url":false}],4:[function(require,module,exports){
//var NativeModule = require('native_module');
//var fs = require('fs');
var Q = require('q');

function requirePromise(moduleName)
{
  var deferred = Q.defer();
  try
  {
    deferred.resolve(require(moduleName));
  }
  catch(error)
  {
    deferred.reject( error );
  }

  return deferred.promise;
}

module.exports = requirePromise;
/*
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
}*/

},{"q":false}],5:[function(require,module,exports){
var Resource;

Resource = (function() {
  function Resource(uri) {
    var _uriElems;
    this.uri = uri;
    _uriElems = uri.split("?");
    this.name = _uriElems.shift().split("/").pop();
    this.ext = this.name.split(".").pop().toLowerCase();
    this.queryParams = _uriElems.pop();
    this.data = null;
    this.error = null;
    this.rawData = null;
    this.rawDataType = null;
    this.size = 0;
    this.loaded = false;
    this.fetched = false;
    this.fetchProgress = 0;
    this.parseProgress = 0;
    this.totalRawSize = 0;
    this.totalDisplaySize = "";
    this.deferred = null;
  }

  return Resource;

})();

module.exports = Resource;


},{}]},{},[])