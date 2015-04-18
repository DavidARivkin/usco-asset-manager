'use strict';

import Q from 'q'
import pathUtils from './pathUtils'
import Resource from './resource'
import logger from 'log-minim'

let log = logger("asset-manager");
log.setLevel("warn");

//TODO: add loading from git repos , with optional tag, commit, hash, branch etc (similar to npm dependencies)
//TODO: perhaps we should seperate store TYPE (local , xhr, dropbox) from store NAME (the root uri ?)

/**
 *Manager for lifecyle of assets: load, store unload 
 *For external code files, stl, amf, textures, fonts etc
 **/
class AssetManager{
  constructor(stores) {
    this.stores = stores || {};
    this.parsers = {};
    this.serializers = {};
    this.assetCache = {};
    this.codeExtensions = ["coffee", "litcoffee", "ultishape", "scad"];
  }

  addStore(name, store) {
    return this.stores[name] = store;
  }

  addParser(extension, parser) {
    return this.parsers[extension] = parser;
  }

  addSerializer(extension, serializer) {
    return this.serializers[extension] = serializer;
  }

  removeStore(name, store) {
    return delete this.stores[name];
  }

  removeParser(extension, parser) {
    return delete this.parsers[extension];
  }

  removeSerializer(extension, serializer) {
    return delete this.serializers[extension];
  }


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
  load(fileUri, options) {
    //TODO: cleann this all up
    //load resource, store it in resource map, return it for use
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

    ///////////
    log.info("Attempting to load :", filename, "from store:", storeName);
    resource = new Resource(fileUri);
    resource.deferred = deferred;
    extension = resource.ext;
    if (_file != null) {
      resource._file = _file;//FIXME; a bit of a hack: for future uploads we keep the original file?
    }

    store = this.stores[storeName];
    if (!store) {
      storeNotFoundError = new Error("No store named " + storeName);
      storeNotFoundError.name = "storeNotFoundError";
      log.error(storeNotFoundError);
      deferred.reject(resource);
      resource.error = storeNotFoundError;
      return resource;
    }

    //if not noParse
    //get parser instance , if it exists
    parser = this.parsers[extension];
    if (!parser) {
      parserNotFoundError = new Error("No parser found for '" + extension + "' file format");
      parserNotFoundError.name = "parserNotFoundError";
      log.error(parserNotFoundError);
      resource.error = parserNotFoundError;
      deferred.reject(resource);
      return resource;
    }

    //the resource was already loaded, return it 
    if (filename in this.assetCache){
      log.info("resource already in cache, returning cached version");
      loadedResource = this.assetCache[filename];
      deferred.resolve(loadedResource);
      return loadedResource;
    }
    else{
      //if extension not in @codeExtensions
      //get prefered input data type for parser/extension
      //FIXME: do this more elegantly 

      fileOrFileName = storeName === "desktop" ? file : filename;
      if (parser.inputDataType != null) {
        inputDataType = parser.inputDataType;
        rawDataDeferred = store.read(fileOrFileName, {
          dataType: inputDataType
        });
      } else {
        rawDataDeferred = store.read(fileOrFileName);
      }

      //handle failure of fetching data
      deferred.promise.fail( error => rawDataDeferred.reject( error ) );

      let self = this;

      let onSuccess = function( loadedResource ){
        resource.fetched = true;
        deferred.notify({
            parsing: 0
        });
          
        resource.rawData = keepRawData ? loadedResource : null;
        let resourceDeferred = parser.parse(loadedResource, parseOptions);
        log.warn("resourceDeferred",resourceDeferred)
        loadedResource   = resourceDeferred.promise;
        
        deferred.promise.fail(function(error) {
          resourceDeferred.reject(error);
        });

        Q.when(loadedResource, function(value) {
            console.log("BORDEL")
            loadedResource = value;
            resource.data = loadedResource;
            resource.loaded = true;
            if (!transient) {
              self.assetCache[fileUri] = resource;
            }
            deferred.resolve(resource);
        });
      }

      let onProgress = function(progress) {
        log.debug("got some progress", JSON.stringify(progress));
        if ("fetching" in progress) {
          resource.fetchProgress = progress.fetching;
        }
        if ("parsing" in progress) {
          resource.parseProgress = progress.parsing;
        }
        deferred.notify(progress);
        resource.size = progress.total;
      };

      let onError    = function( error ){
        var fetchError;
        log.error("failure in data reading step", error);
        fetchError = new Error(error.message);
        fetchError.name = "fetchError";
        resource.error = fetchError;
        deferred.reject(resource);
      }

      //load raw data from uri/file, get a deferred/promise
      rawDataDeferred.promise.then( onSuccess, onError, onProgress);
      return resource;
    }
  }


  /**** 
  *remove resource from cached assets
   */
  unLoad(fileUri) {
    if (fileUri in this.assetCache) {
      return delete this.assetCache[fileUri];
    }
  }

  save(fileUri) {}

  delete(fileUri) {}

  stats(fileUri, parentUri) {
    var filename, ref, store, storeName;
    if (fileUri == null) {
      throw new Error("Invalid file name : " + fileUri);
    }
    fileUri = this._toAbsoluteUri(fileUri, parentUri);
    ref = this._parseFileUri(fileUri, parentUri), storeName = ref[0], filename = ref[1];
    log.info("Attempting to load :", filename, "from store:", storeName);
    store = this.stores[storeName];
    if (!store) {
      throw new Error("No store named " + storeName);
    }
    return store.stats(fileUri);
  }

  clearResources() {
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
  }


  /****
  *load project (folder): TODO: should this be here ??
  * @param {string} uri: folder/url path
   */

  loadProject(uri) {
    var deferred, storeName;
    deferred = Q.defer();
    storeName = this._parseStoreName(uri);
    return deferred.promise;
  }
}

export default AssetManager;