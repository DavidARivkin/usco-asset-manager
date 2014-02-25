'use strict'
path = require "path"
fs   = require "fs"

AssetManager = require "../src/assetManager"
STLParser = require "./STLParser"
OBJParser = require "./OBJParser"
OBJParserAsync = require "./OBJParserAsync"

DummyStore = require "./dummyStore"
DummyXHRStore = require "./dummyXHRStore"

          
describe "AssetManager", ->
  assetManager = null
  stores = []
  stlParser = null
  
  beforeEach ->
    stores["dummy"] = new DummyStore()
    stores["xhr"] = new DummyXHRStore()
    assetManager = new AssetManager( stores )
    stlParser = new STLParser()
  
  it 'should fail to load resources with unvalid uris gracefully',(done)->
    assetManager.addParser("stl", new STLParser())
    
    fileUri = "dummy:specs/femur.stl"
    assetManager.load( fileUri ).promise.catch ( error ) =>
      expect(error.error).toEqual("specs/femur.stl not found")
      done()
  , 400
  
  it 'should fail to load resources with no valid parsers gracefully',(done)->
    fileUri = "dummy:specs/data/femur.ctm"
    assetManager.load( fileUri ).promise.catch ( error ) =>
      expect(error.error).toEqual("No parser found for ctm file format")
      done()
  , 400
  
  it 'should fail to load resources with no valid store gracefully',(done)->
    fileUri = "foo:specs/data/femur.ctm"
    promise = assetManager.load( fileUri ).promise
    console.log("promise", promise)
    promise.catch ( error ) =>
      expect(error.message).toEqual("No store named foo")
      done()
  , 400
  
  it 'can load parsers dynamically based on resource extension',(done)->
    try
      fs.symlinkSync(path.resolve("./specs/STLParser.js"),"node_modules/STLParser.js")

    fileUri = "dummy:specs/data/femur.stl"
    assetManager.load( fileUri ).promise.then ( loadedResource ) =>
      expect( loadedResource.data ).not.toEqual(null)
      done()
    try
      fs.unlinkSync("node_modules/STLParser.js")
  , 400


  it 'can handle various file types via settable parsers',(done)->
    storeName = "dummy"
    
    assetManager.addParser("stl", stlParser )
    assetManager.addParser("obj", new OBJParser() )
    
    stlFileName = "dummy:specs/data/cube.stl"
    objFileName = "dummy:specs/data/cube.obj"
    
    assetManager.load( stlFileName, {transient:true} ).promise.done (loadedResource) =>
      expect(loadedResource.data).not.toEqual(null)

    assetManager.load( objFileName, {transient:true} ).promise.done (loadedResource) =>
      expect(loadedResource.data).not.toEqual(null)
      done()
  
  it 'can handle sync and async parsers',(done)->
    storeName = "dummy"
    
    assetManager.addParser("stl", stlParser)
    assetManager.addParser("obj", new OBJParserAsync() )
    
    stlFileName = "dummy:specs/data/cube.stl"
    objFileName = "dummy:specs/data/cube.obj"
    
    assetManager.load( stlFileName, {transient:true} ).promise.done (loadedResource) =>
      expect(loadedResource.data).not.toEqual(null)

    assetManager.load( objFileName, {transient:true} ).promise.done (loadedResource) =>
      expect(loadedResource.data).not.toEqual(null)
      done()

  
  it 'can load resources from different stores',(done)->
    assetManager.addParser("stl", stlParser)
    
    fileUri = "dummy:specs/data/cube.stl"
    assetManager.load( fileUri ).promise.done ( loadedResource ) =>
      expect( loadedResource.data ).not.toEqual(null)

    fileUri = "https://raw.github.com/kaosat-dev/repBug/master/cad/stl/femur.stl"
    assetManager.load( fileUri ).promise.done ( loadedResource ) =>
      expect( loadedResource.data ).not.toEqual(null)
      done()
      
  ###
  it 'caches resources by default',(done)->
    assetManager.addParser("stl", STLParser)
    stlFileName = "dummy:specs/data/cube.stl"
    
    expect(assetManager.assetCache).toEqual({})
    
    assetManager.load( stlFileName ).done (loadedResource) =>
      expect( assetManager.assetCache ).toEqual({"dummy:specs/data/cube.stl":loadedResource})
      done()

  it 'does not cache transient resources',(done)->
    assetManager.addParser("stl", STLParser)
    stlFileName = "dummy:specs/data/cube.stl"
    
    expect(assetManager.assetCache).toEqual({})
    
    assetManager.load( stlFileName, null, {transient:true} ).done (loadedResource) =>
      expect(assetManager.assetCache).toEqual({})
      done() 

  it 'can keep the raw(not parsed) data',(done)->
    assetManager.addParser("stl", STLParser)
    stlFileName = "dummy:specs/data/cube.stl"
    expRawData = fs.readFileSync( "specs/data/cube.stl", 'utf8' )    
    
    assetManager.load( stlFileName, null, {keepRawData:true} ).done (loadedResource) =>
      expect(loadedResource.rawData).toEqual( expRawData )
      done() 

  it 'can handle uris with query parameters',(done)->
    assetManager.addParser("stl", STLParser)

    fileUri = "https://raw.github.com/kaosat-dev/repBug/master/cad/stl/femur.stl?size=2&diameter=4"
    assetManager.load( fileUri ).done ( loadedResource ) =>
      expect( loadedResource.uri ).not.toEqual(null)
      expect( loadedResource.name ).toEqual("femur.stl")
      expect( loadedResource.queryParams ).toEqual("size=2&diameter=4")
      done()

  it 'returns a resource object for easier tracking of reading data',(done)->
    assetManager.addParser("stl", STLParser)
    stlFileName = "dummy:specs/data/cube.stl"
    
    assetManager.load( stlFileName ).done (loadedResource) =>
      expect(loadedResource.uri).toBe( "dummy:specs/data/cube.stl" )
      expect(loadedResource.name).toBe( "cube.stl" )
      expect(loadedResource.loaded).toBe( true )
      expect(loadedResource.size).toBe( 0 )
      done()   
      
  ###

  ###
  it 'can resolve absolute and relative file paths, from different stores',(done)->
    assetManager.addParser("stl", STLParser)

    #relative, dummy store
    stores["dummy"].rootUri = path.resolve("./specs")
    fileUri = "./data/cube.stl"
    assetManager.loadResource( fileUri, "dummy:specs/" ).done ( loadedResource ) =>
      expect( loadedResource ).not.toEqual(null)
    
    #absolute, dummy store
    fullPath = path.resolve("./specs/data/cube.stl")
    fileUri = "dummy:#{fullPath}"
    assetManager.loadResource( fileUri ).done ( loadedResource ) =>
      expect( loadedResource ).not.toEqual(null)
    
    #relative, remote store
    fileUri = "./femur.stl"
    assetManager.loadResource( fileUri, "https://raw.github.com/kaosat-dev/repBug/master/cad/stl/" ).done ( loadedResource ) =>
      expect( loadedResource ).not.toEqual(null)
    
    #absolute, remote store
    fileUri = "https://raw.github.com/kaosat-dev/repBug/master/cad/stl/femur.stl"
    assetManager.loadResource( fileUri ).done ( loadedResource ) =>
      expect( loadedResource ).not.toEqual(null)
      done()
  , 1000
    
  it 'can load projects', (done)->
    uri = path.resolve("./specs/data/PeristalticPump")
    assetManager.loadProject( uri )
    .then ( loadedResource ) =>
      expect( loadedResource ).not.toEqual(null)  
    .fail( error ) ->
      expect(false).toBeTruthy error.message
      done()
  ###
  ###
  
  it 'can load source files (no parsing, raw text)',(done)->
    fileName = "dummy:specs/data/test.coffee"
    expSource = """assembly.add( new Cube() )"""
    assetManager.loadResource( fileName, {transient:true} ).done (loadedResource) =>
      expect(loadedResource).toEqual(expSource)
      done()
  
  it 'allows for manual unloading of resources', (done)->
    assetManager.addParser("stl", STLParser)
    stlFileName = "dummy:specs/data/cube.stl"
    
    assetManager.loadResource( stlFileName ).done (loadedResource) =>
      expect( assetManager.assetCache ).toEqual({"dummy:specs/data/cube.stl":loadedResource})
      assetManager.unLoadResource( stlFileName )
      expect(assetManager.assetCache).toEqual({})
      done()   
  ###  
