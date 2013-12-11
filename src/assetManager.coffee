'use strict'
path = require('path')
Q = require('q')
logger = require("./logger.coffee")
logger.level = "info"
requireP = require("./requirePromise")

#TODO: add loading from git repos , with optional tag, commit, hash, branch etc (similar to npm dependencies)
#TODO: perhaps we should seperate store TYPE (local , xhr, dropbox) from store NAME (the root uri ?)


#TODO: should this be "asset??"
class Resource
  constructor:(uri)->
    console.log("uri",uri)
    @name = uri.split("/").pop()
    @data = null
    @error = null

    @fetchProgress = 10;
    @parseProgress = 0;
    @totalRawSize = 0;

    @totalDisplaySize = ""#TODO: remove this, ui only
    @loaded = false

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
    
    #logger.debug("relative path: ", fileName)
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
      extension = filename.split(".").pop().toLowerCase()
      
      #if extension not in @codeExtensions
      parserPromise = @_loadParser( extension )

      parserPromise
      .then (parser) =>
        #load raw data from uri/file, get a promise
        rawDataPromise = store.read(filename)
        rawDataPromise
        .then (loadedResource) =>
          deferred.notify( "starting parsing" )
          loadedResource = parser.parse(loadedResource)
          resource.data = loadedResource

          if not transient #if we are meant to hold on to this resource, cache it
            @assetCache[ fileUri ] = resource

          deferred.resolve resource
        .progress ( progress ) =>
            deferred.notify( progress )
            logger.info "got some progress", progress
        .fail (error) =>
           console.log("fail in data reading step",error) 
           resource.error = error.message
           deferred.reject resource
      .fail (error) =>
        resource.error = "No parser found for #{extension} file format"
        deferred.reject resource
    else
      #the resource was already loaded, return it 
      loadedResource = @assetCache[filename]
      deferred.resolve( loadedResource )
      
    return deferred.promise

  _loadParser:( extension )=>
    parser = @parsers[ extension ]
    if not parser
      parserName = extension.toUpperCase()+"Parser"
      parserPromise = requireP( "./"+parserName )
      return parserPromise.then (parserKlass) =>
        @parsers[ extension ] = new parserKlass()
    else
      Q(parser)

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

