'use strict'
path = require 'path'
Q = require 'q'
detectEnv = require "composite-detect"
requireP = require "./requirePromise"

if detectEnv.isModule
  Minilog=require("minilog")
  logger = Minilog('asset-manager')

if detectEnv.isBrowser
  Minilog.pipe(Minilog.suggest).pipe(Minilog.backends.console.formatClean).pipe(Minilog.backends.console)
  logger = Minilog('asset-manager')

if detectEnv.isNode
  Minilog.pipe(Minilog.suggest).pipe(Minilog.backends.console.formatColor).pipe(Minilog.backends.console)

#TODO: add loading from git repos , with optional tag, commit, hash, branch etc (similar to npm dependencies)
#TODO: perhaps we should seperate store TYPE (local , xhr, dropbox) from store NAME (the root uri ?)

#TODO: should this be "asset??"
class Resource
  constructor:(uri)->
    @uri = uri
    _uriElems = uri.split("?")
    @name = _uriElems.shift().split("/").pop()
    @ext = @name.split(".").pop().toLowerCase()
    @queryParams = _uriElems.pop()

    @data = null
    @error = null

    @rawData = null #data before processing : should not always be kept
    @rawDataType = null

    @size = 0
    @loaded = false

    @fetchProgress = 10;
    @parseProgress = 0;
    @totalRawSize = 0;

    @totalDisplaySize = ""#TODO: remove this, ui only


###*
 *Manager for lifecyle of assets: load, store unload 
 *For external code files, stl, amf, textures, fonts etc
*###
class AssetManager
  constructor:( stores )->
  	#manages assets (files)
  	@stores = stores or {}
  	@parsers = {}
  	@assetCache = {}
  	
  	#extensions of code file names (do not need parsing, but more complex evaluating !!)
  	@codeExtensions = ["coffee","litcoffee","ultishape","scad"]
  
  _parseFileUri: ( fileUri )->
    #extract store, file path etc
    #logger.debug "extracting store from", fileUri
    url = require('url')
    pathInfo = url.parse( fileUri )
    storeName = pathInfo.protocol
    fileName = pathInfo.host  + pathInfo.pathname
    storeName = storeName.replace(":","")
    
    if storeName is null
      if pathInfo.path[0] is "/"
        #local fs
        storeName = "local"
      else
        #TODO: deal with relative paths
    else if storeName is "http" or storeName is "https"
      storeName = "xhr"
      fileName = pathInfo.href
    return [ storeName, fileName ] 

  _toAbsoluteUri:(fileName, parentUri, store)->
    #normalization test
    path = require 'path'
    
    segments = fileName.split( "/" )
    if segments[0] != '.' and segments[0] != '..'
      logger.debug("fullPath (from absolute)", fileName)
      return fileName
    
    logger.debug("relative path: ", fileName)
    #path is relative
    rootUri = parentUri or store.rootUri or ""
    fileName = path.normalize(fileName)
    isXHr = rootUri.indexOf("http") isnt -1
    
    #TODO: this explains WHY it would be a good idea to have path resolving done on a PER STORE basis
    if isXHr
      fullPath = rootUri + fileName
    else
      #hack to force dirname to work on paths ending with slash
      rootUri = if rootUri[rootUri.length-1] == "/" then rootUri +="a" else rootUri
      rootUri = path.normalize(rootUri)
      rootUri = path.dirname(rootUri)
      fullPath = path.join( rootUri, fileName )
      
    logger.debug("fullPath (from relative)", fullPath)
    return fullPath
  
  addParser:( extension, parser )=>
    #add a parser
    @parsers[extension] = new parser()
  
  ###* 
   * fileUri : path to the file, starting with the node prefix
   * transient : boolean : if true, don't store the resource in cache
   * parentUri : string : not sure we should have this here : for relative path resolution
   * caching params : various cachin params : lifespan etc
   * If no store is specified, file paths are expected to be relative
  ###
  load: ( fileUri, parentUri, cachingParams  )->
    #load resource, store it in resource map, return it for use
    parentUri = parentUri or null
    transient = if cachingParams? then cachingParams.transient else false
    keepRawData = if cachingParams? then cachingParams.keepRawData else false
    
    deferred = Q.defer()
    
    if not fileUri?
      throw new Error( "Invalid file name : #{fileUri}" )
     
    #resolve full path
    fileUri = @_toAbsoluteUri(fileUri, parentUri)
    
    [storeName,filename] = @_parseFileUri( fileUri, parentUri)
    logger.info( "Attempting to load :", filename,  "from store:", storeName )

    #STEP1: dynamically "require" the adequate store
    #STEP2: dynamically "require" the adequate parser
    #STEP3: no errors yet : fetch the data
    #STEP4: no errors yet : parse the data, return resouce
    
    resource = new Resource(fileUri)

    #get store instance , if it exists
    store = @stores[ storeName ]
    if not store
      throw new Error("No store named #{storeName}")
    
    if not (filename of @assetCache)
      extension = resource.ext #filename.split(".").pop().toLowerCase()
      
      #if extension not in @codeExtensions
      parserPromise = @_loadParser( extension )

      parserPromise
      .then (parser) =>
        #load raw data from uri/file, get a promise
        rawDataPromise = store.read(filename)
        rawDataPromise
        .then (loadedResource) =>
          deferred.notify( "starting parsing" )
          resource.rawData = if keepRawData then loadedResource else null
          loadedResource = parser.parse(loadedResource)
          resource.data = loadedResource
          resource.loaded = true

          if not transient #if we are meant to hold on to this resource, cache it
            @assetCache[ fileUri ] = resource
          
          deferred.resolve resource
        .progress ( progress ) =>
            logger.info "got some progress", progress
            deferred.notify( progress )
            resource.size = progress.total
            
        .fail (error) =>
           logger.error("failure in data reading step",error) 
           resource.error = error.message
           deferred.reject resource
      .fail (error) =>
        logger.error("failure in getting parser",error) 
        resource.error = "No parser found for #{extension} file format"
        deferred.reject resource
    else
      #the resource was already loaded, return it 
      loadedResource = @assetCache[filename]
      deferred.resolve( loadedResource )
      
    return deferred.promise

  _loadParser:( extension )=>
    parser = @parsers[ extension ]
    parserDeferred = Q.defer()
    if not parser
      parserName = extension.toUpperCase()+"Parser"
      parserPromise = requireP( parserName )
      parserPromise.then (parserKlass) =>
        parser = new parserKlass()
        @parsers[ extension ] = parser
        parserDeferred.resolve( parser )
      .fail (error)->
        parserDeferred.reject( error )
    else
      parserDeferred.resolve( parser )
    return parserDeferred.promise

  ###*** 
  *remove resource from cached assets
  ###
  unLoad: ( fileUri )->
    #TODO : should resources be wrapped so we can deal with MANUAL reference counting, metadata etc?
    if (fileUri of @assetCache)
      delete @assetCache[ fileUri ]
  
  save: ( fileUri )->

  delete: (fileUri )->

  stats: (fileUri, parentUri)->
    if not fileUri?
      throw new Error( "Invalid file name : #{fileUri}" )
     
    #resolve full path
    fileUri = @_toAbsoluteUri(fileUri, parentUri)
    
    [storeName,filename] = @_parseFileUri( fileUri, parentUri)
    logger.info( "Attempting to load :", filename,  "from store:", storeName )
    
    #get store instance , if it exists
    store = @stores[ storeName ]

    if not store
      throw new Error("No store named #{storeName}")

    return store.stats( fileUri )
    

  ###***
  *load project (folder): TODO: should this be here ??
  * @param {string} uri: folder/url path
  ###
  loadProject:( uri )->
    deferred = Q.defer()
    storeName = @_parseStoreName( uri )
    console.log "storeName", storeName
    
    return deferred.promise
  
	
module.exports = AssetManager

