require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"18WD8H":[function(require,module,exports){
'use strict';
var AssetManager, Minilog, Q, Resource, detectEnv, logger, path, requireP,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

path = require('path');

Q = require('q');

detectEnv = require("composite-detect");

requireP = require("./requirePromise");

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
    this.fetchProgress = 10;
    this.parseProgress = 0;
    this.totalRawSize = 0;
    this.totalDisplaySize = "";
  }

  return Resource;

})();

/**
 *Manager for lifecyle of assets: load, store unload 
 *For external code files, stl, amf, textures, fonts etc
*
*/


AssetManager = (function() {
  function AssetManager(stores) {
    this._loadParser = __bind(this._loadParser, this);
    this.addParser = __bind(this.addParser, this);
    this.stores = stores || {};
    this.parsers = {};
    this.assetCache = {};
    this.codeExtensions = ["coffee", "litcoffee", "ultishape", "scad"];
  }

  AssetManager.prototype._parseFileUri = function(fileUri) {
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

  AssetManager.prototype._toAbsoluteUri = function(fileName, parentUri, store) {
    var fullPath, isXHr, rootUri, segments;
    path = require('path');
    segments = fileName.split("/");
    if (segments[0] !== '.' && segments[0] !== '..') {
      logger.debug("fullPath (from absolute)", fileName);
      return fileName;
    }
    logger.debug("relative path: ", fileName);
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
    logger.debug("fullPath (from relative)", fullPath);
    return fullPath;
  };

  AssetManager.prototype.addParser = function(extension, parser) {
    return this.parsers[extension] = new parser();
  };

  /** 
   * fileUri : path to the file, starting with the node prefix
   * transient : boolean : if true, don't store the resource in cache
   * parentUri : string : not sure we should have this here : for relative path resolution
   * caching params : various cachin params : lifespan etc
   * If no store is specified, file paths are expected to be relative
  */


  AssetManager.prototype.load = function(fileUri, parentUri, cachingParams) {
    var deferred, extension, filename, keepRawData, loadedResource, parserPromise, resource, store, storeName, transient, _ref,
      _this = this;
    parentUri = parentUri || null;
    transient = cachingParams != null ? cachingParams.transient : false;
    keepRawData = cachingParams != null ? cachingParams.keepRawData : false;
    deferred = Q.defer();
    if (fileUri == null) {
      throw new Error("Invalid file name : " + fileUri);
    }
    fileUri = this._toAbsoluteUri(fileUri, parentUri);
    _ref = this._parseFileUri(fileUri, parentUri), storeName = _ref[0], filename = _ref[1];
    logger.info("Attempting to load :", filename, "from store:", storeName);
    resource = new Resource(fileUri);
    store = this.stores[storeName];
    if (!store) {
      throw new Error("No store named " + storeName);
    }
    extension = resource.ext;
    if (!(filename in this.assetCache)) {
      parserPromise = this._loadParser(extension);
      parserPromise.then(function(parser) {
        var inputDataType, rawDataPromise;
        if (parser.inputDataType != null) {
          inputDataType = parser.inputDataType;
          rawDataPromise = store.read(filename, {
            dataType: inputDataType
          });
        } else {
          rawDataPromise = store.read(filename);
        }
        return rawDataPromise.then(function(loadedResource) {
          deferred.notify("starting parsing");
          resource.rawData = keepRawData ? loadedResource : null;
          loadedResource = parser.parse(loadedResource);
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
          logger.info("got some progress", progress);
          deferred.notify(progress);
          return resource.size = progress.total;
        }).fail(function(error) {
          logger.error("failure in data reading step", error);
          resource.error = error.message;
          return deferred.reject(resource);
        });
      }).fail(function(error) {
        logger.error("failure in getting parser", error);
        resource.error = "No parser found for " + extension + " file format";
        return deferred.reject(resource);
      });
    } else {
      loadedResource = this.assetCache[filename];
      deferred.resolve(loadedResource);
    }
    return deferred;
  };

  AssetManager.prototype._loadParser = function(extension) {
    var parser, parserDeferred, parserName, parserPromise,
      _this = this;
    parser = this.parsers[extension];
    parserDeferred = Q.defer();
    if (!parser) {
      parserName = extension.toUpperCase() + "Parser";
      parserPromise = requireP(parserName);
      parserPromise.then(function(parserKlass) {
        parser = new parserKlass();
        _this.parsers[extension] = parser;
        return parserDeferred.resolve(parser);
      }).fail(function(error) {
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
    console.log("storeName", storeName);
    return deferred.promise;
  };

  return AssetManager;

})();

module.exports = AssetManager;


},{"./requirePromise":3,"composite-detect":"composite-detect","minilog":"minilog","path":"path","q":"q","url":"url"}],"AssetManager":[function(require,module,exports){
module.exports=require('18WD8H');
},{}],3:[function(require,module,exports){
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

},{"q":"q"}]},{},[])
;
