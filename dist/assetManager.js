'use strict';
var AssetManager, Minilog, Q, Resource, detectEnv, logger, pathUtils,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

Q = require('q');

detectEnv = require("composite-detect");

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
    this.removeSerializer = bind(this.removeSerializer, this);
    this.removeParser = bind(this.removeParser, this);
    this.removeStore = bind(this.removeStore, this);
    this.addSerializer = bind(this.addSerializer, this);
    this.addParser = bind(this.addParser, this);
    this.addStore = bind(this.addStore, this);
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

  AssetManager.prototype.removeStore = function(name, store) {
    return delete this.stores[name];
  };

  AssetManager.prototype.removeParser = function(extension, parser) {
    return delete this.parsers[extension];
  };

  AssetManager.prototype.removeSerializer = function(extension, serializer) {
    return delete this.serializers[extension];
  };


  /** 
   * fileUri : path to the file, starting with the node prefix
   * options: object : additionnal options for loading resource
   *  options.parentUri : string : not sure we should have this here : for relative path resolution
   *  options.transient : boolean : if true, don't store the resource in cache, default;false
   *  options.keepRawData: boolean: if true, keep a copy of the original data (un-parsed)
   *  options.noParse: boolean: if true, do not attempt to parse the raw data
   * 
   * If no store is specified, file paths are expected to be relative
   */

  AssetManager.prototype.load = function(fileUri, options) {
    var _file, deferred, error, extension, fetchOptions, file, fileOrFileName, filename, inputDataType, keepRawData, loadedResource, noParse, parentUri, parseOptions, parser, parserNotFoundError, rawDataDeferred, ref, ref1, resource, store, storeName, storeNotFoundError, transient;
    options = options || {};
    parentUri = options.parentUri || null;
    transient = options.transient || false;
    keepRawData = options.keepRawData || false;
    noParse = options.noParse || false;
    fetchOptions = options.fetching || {};
    parseOptions = options.parsing || {};
    deferred = Q.defer();
    if (fileUri == null) {
      deferred.reject("Invalid file name : " + fileUri);
      return deferred;
    }
    try {
      if ((typeof File !== "undefined" && File !== null) && fileUri instanceof File) {
        ref = ["desktop", fileUri.name], storeName = ref[0], filename = ref[1];
        file = fileUri;
        _file = fileUri;
        fileUri = fileUri.name;
      } else {
        fileUri = pathUtils.toAbsoluteUri(fileUri, parentUri);
        ref1 = pathUtils.parseFileUri(fileUri, parentUri), storeName = ref1[0], filename = ref1[1];
      }
    } catch (_error) {
      error = _error;
      deferred.reject(error);
    }
    logger.info("Attempting to load :", filename, "from store:", storeName);
    resource = new Resource(fileUri);
    resource.deferred = deferred;
    extension = resource.ext;
    if (_file != null) {
      resource._file = _file;
    }
    store = this.stores[storeName];
    if (!store) {
      storeNotFoundError = new Error("No store named " + storeName);
      storeNotFoundError.name = "storeNotFoundError";
      logger.error(storeNotFoundError);
      deferred.reject(resource);
      resource.error = storeNotFoundError;
      return resource;
    }
    parser = this.parsers[extension];
    if (!parser) {
      parserNotFoundError = new Error("No parser found for '" + extension + "' file format");
      parserNotFoundError.name = "parserNotFoundError";
      logger.error(parserNotFoundError);
      resource.error = parserNotFoundError;
      deferred.reject(resource);
      return resource;
    }
    if (!(filename in this.assetCache)) {
      fileOrFileName = storeName === "desktop" ? file : filename;
      if (parser.inputDataType != null) {
        inputDataType = parser.inputDataType;
        rawDataDeferred = store.read(fileOrFileName, {
          dataType: inputDataType
        });
      } else {
        rawDataDeferred = store.read(fileOrFileName);
      }
      deferred.promise.fail((function(_this) {
        return function(error) {
          return rawDataDeferred.reject(error);
        };
      })(this));
      rawDataDeferred.promise.then((function(_this) {
        return function(loadedResource) {
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
        };
      })(this)).progress((function(_this) {
        return function(progress) {
          logger.debug("got some progress", JSON.stringify(progress));
          if ("fetching" in progress) {
            resource.fetchProgress = progress.fetching;
          }
          if ("parsing" in progress) {
            resource.parseProgress = progress.parsing;
          }
          deferred.notify(progress);
          return resource.size = progress.total;
        };
      })(this)).fail((function(_this) {
        return function(error) {
          var fetchError;
          logger.error("failure in data reading step", error);
          fetchError = new Error(error.message);
          fetchError.name = "fetchError";
          resource.error = fetchError;
          return deferred.reject(resource);
        };
      })(this));
    } else {
      logger.info("resource already in cache, returning cached version");
      loadedResource = this.assetCache[filename];
      deferred.resolve(loadedResource);
      return loadedResource;
    }
    return resource;
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
    var filename, ref, store, storeName;
    if (fileUri == null) {
      throw new Error("Invalid file name : " + fileUri);
    }
    fileUri = this._toAbsoluteUri(fileUri, parentUri);
    ref = this._parseFileUri(fileUri, parentUri), storeName = ref[0], filename = ref[1];
    logger.info("Attempting to load :", filename, "from store:", storeName);
    store = this.stores[storeName];
    if (!store) {
      throw new Error("No store named " + storeName);
    }
    return store.stats(fileUri);
  };

  AssetManager.prototype.clearResources = function() {
    var deferred, k, ref, resource, v;
    ref = this.assetCache;
    for (k in ref) {
      v = ref[k];
      resource = this.assetCache[k];
      deferred = resource.deferred;
      if (deferred != null) {
        deferred.reject();
      }
      delete this.assetCache[k];
    }
    return this.assetCache = {};
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

  return AssetManager;

})();

module.exports = AssetManager;

//# sourceMappingURL=assetManager.js.map
