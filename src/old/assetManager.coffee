'use strict'
Q = require 'q'
detectEnv = require "composite-detect"

Resource = require "./resource.coffee"
pathUtils= require "./pathUtils.coffee"

if detectEnv.isModule
  Minilog=require("minilog")
  logger = Minilog('asset-manager')

if detectEnv.isBrowser
  Minilog.pipe(Minilog.suggest).pipe(Minilog.backends.console.formatClean).pipe(Minilog.backends.console)
  #.pipe(Minilog.backends.browser)#
  logger = Minilog('asset-manager')

if detectEnv.isNode
  Minilog.pipe(Minilog.suggest).pipe(Minilog.backends.console.formatColor).pipe(Minilog.backends.console)

#TODO: add loading from git repos , with optional tag, commit, hash, branch etc (similar to npm dependencies)
#TODO: perhaps we should seperate store TYPE (local , xhr, dropbox) from store NAME (the root uri ?)

###*
 *Manager for lifecyle of assets: load, store unload 
 *For external code files, stl, amf, textures, fonts etc
*###
class AssetManager
  constructor:( stores )->
    #manages assets (files)
    @stores      = stores or {}
    @parsers     = {}
    @serializers = {}

    @assetCache = {}
    
    #extensions of code file names (do not need parsing, but more complex evaluating !!)
    @codeExtensions = ["coffee","litcoffee","ultishape","scad"]
  
  addStore:( name, store )=>
    #add a store
    @stores[name] = store

  addParser:( extension, parser )=>
    #add a parser
    @parsers[extension] = parser

  addSerializer:( extension, serializer )=>
    #add a serializer
    @serializers[extension] = serializer
    
  removeStore:( name, store )=>
    #remove a store
    delete @stores[name]

  removeParser:( extension, parser )=>
    #add a parser
    delete @parsers[extension]

  removeSerializer:( extension, serializer )=>
    #add a serializer
    delete @serializers[extension]
  
  ###* 
   * fileUri : path to the file, starting with the node prefix
   * options: object : additionnal options for loading resource
   *  options.parentUri : string : not sure we should have this here : for relative path resolution
   *  options.transient : boolean : if true, don't store the resource in cache, default;false
   *  options.keepRawData: boolean: if true, keep a copy of the original data (un-parsed)
   *  options.noParse: boolean: if true, do not attempt to parse the raw data
   * 
   * If no store is specified, file paths are expected to be relative
  ###
  load: ( fileUri, options  )->
    #TODO: cleann this all up
    #load resource, store it in resource map, return it for use
    options       = options or {}
    parentUri     = options.parentUri or null
    transient     = options.transient or false
    keepRawData   = options.keepRawData or false 
    noParse       = options.noParse or false 
    fetchOptions  = options.fetching or {}
    parseOptions  = options.parsing or {}
    
    deferred = Q.defer()
    
    if not fileUri?
      deferred.reject( "Invalid file name : #{fileUri}" )
      return deferred

    try
      if File? and fileUri instanceof File #determine if we are dealing with an HTML5 File instance
        [storeName,filename] = ["desktop", fileUri.name]
        file = fileUri
        _file = fileUri;
        fileUri = fileUri.name
      else
        #resolve full path
        fileUri = pathUtils.toAbsoluteUri(fileUri, parentUri)
        [storeName,filename] = pathUtils.parseFileUri( fileUri, parentUri)
    catch error
      deferred.reject(error)
    #TODO: how to hanlde this ??
     
   
    logger.info( "Attempting to load :", filename,  "from store:", storeName )

    #STEP3: no errors yet : fetch the data
    #STEP4: no errors yet : parse the data, return resouce
    
    resource = new Resource( fileUri )
    resource.deferred = deferred
    extension = resource.ext
    
    if _file? 
      resource._file = _file #FIXME; a bit of a hack: for future uploads we keep the original file?
    
    #get store instance , if it exists
    store = @stores[ storeName ]
    if not store
      storeNotFoundError = new Error("No store named #{storeName}")
      storeNotFoundError.name = "storeNotFoundError"
      logger.error(storeNotFoundError) 
      deferred.reject resource
      resource.error = storeNotFoundError
      return resource
    
    
    #if not noParse
    #get parser instance , if it exists
    parser = @parsers[ extension ]
    if not parser
      parserNotFoundError = new Error( "No parser found for '#{extension}' file format" )
      parserNotFoundError.name = "parserNotFoundError"
      logger.error(parserNotFoundError) 
      resource.error = parserNotFoundError
      deferred.reject resource  
      return resource    

    if not (filename of @assetCache)
      #if extension not in @codeExtensions
    
      #get prefered input data type for parser/extension
      #FIXME: do this more elegantly 
      fileOrFileName = if storeName is "desktop" then file else filename #if we are dealing with html5 Files (drag & drop etc)
      if parser.inputDataType?
        inputDataType = parser.inputDataType
        rawDataDeferred = store.read( fileOrFileName , {dataType:inputDataType})
      else
        rawDataDeferred = store.read( fileOrFileName )
      
      deferred.promise.fail ( error ) =>
        rawDataDeferred.reject( error )
         
      #load raw data from uri/file, get a deferred/promise
      rawDataDeferred.promise
      .then (loadedResource) =>
        resource.fetched = true
        deferred.notify( {parsing:0} )
        resource.rawData = if keepRawData then loadedResource else null

        resourceDeferred = parser.parse loadedResource, parseOptions
        loadedResource = resourceDeferred.promise
        
        deferred.promise.fail ( error ) =>
          resourceDeferred.reject( error )
        
        Q.when loadedResource, (value)=>
          loadedResource = value
          resource.data = loadedResource
          resource.loaded = true

          if not transient #if we are meant to hold on to this resource, cache it
            @assetCache[ fileUri ] = resource
          
          deferred.resolve resource

      .progress ( progress ) =>
          logger.debug "got some progress", JSON.stringify(progress)
          if "fetching" of progress
            resource.fetchProgress = progress.fetching
          if "parsing" of progress
            resource.parseProgress = progress.parsing
          deferred.notify( progress )
          resource.size = progress.total
          
      .fail (error) =>
         logger.error("failure in data reading step",error) 
         fetchError = new Error( error.message )
         fetchError.name = "fetchError";
         resource.error = fetchError
         
         deferred.reject resource
    else
      #the resource was already loaded, return it 
      logger.info( "resource already in cache, returning cached version" )
      loadedResource = @assetCache[filename]
      deferred.resolve loadedResource 
      return loadedResource
      
    return resource

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
    

  clearResources:()->
    #deferred.reject()  while (deferred = @assetCache.pop())?
    
    for k,v of @assetCache
      resource = @assetCache[k]
      deferred = resource.deferred
      deferred.reject() if deferred?
      delete @assetCache[k]
      
    @assetCache = {};
    
  ###***
  *load project (folder): TODO: should this be here ??
  * @param {string} uri: folder/url path
  ###
  loadProject:( uri )->
    deferred = Q.defer()
    storeName = @_parseStoreName( uri )
    
    return deferred.promise
  
  
module.exports = AssetManager

