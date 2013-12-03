'use strict'
Q = require "q"
fs = require "fs"
path = require "path"
#mime = require "mime"

if not window?
  #if (not XMLHttpRequest?)
  console.log(" on NODE")
  XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
else
  XMLHttpRequest = window.XMLHttpRequest


#merge = utils.merge
logger = require("./logger.coffee")
logger.level = "critical"


class XHRStore
  constructor:(options)->
    options = options or {}
    defaults =
      enabled: (if process? then true else false)
      name:"XHR"
      type:"",
      description: ""
      rootUri:if process? then process.env.HOME or process.env.HOMEPATH or process.env.USERPROFILE else null
      isDataDumpAllowed: false
      showPaths:true
    
    #options = merge defaults, options
    #super options
    ###
    #FIXME@vent.on("project:saved",@pushSavedProject)
    ###
  
  login:=>

  
  logout:=>
   


  ###-------------------file/folder manipulation methods----------------###
  
  ###*
  * list all elements inside the given uri (non recursive)
  * @param {String} uri the folder whose content we want to list
  * @return {Object} a promise, that gets resolved with the content of the uri
  ###
  list:( uri )=>
    deferred = Q.defer()
    return deferred.promise
  
  ###*
  * read the file at the given uri, return its content
  * @param {String} uri absolute uri of the file whose content we want
  * @param {String} encoding the encoding used to read the file
  * @return {Object} a promise, that gets resolved with the content of file at the given uri
  ###
  read:( uri , encoding )=>
    encoding = encoding or 'utf8'
    return @_request(uri)
 
  #Helpers
  
  #ajax request wrapper
  _request:(uri, type)=>
    #type: GET, POST, etc
    type = type or "GET"
    
    encoding = encoding or 'utf8'
    deferred = Q.defer()

    request = new XMLHttpRequest()

    console.log("getting", uri);
    request.open( "GET", uri, true );
    
    onLoad= ( event )=>
      result = event.target.responseText
      #serializer = new XMLSerializer() #FIXME: needed ???
      #result = serializer.serializeToString(result)
      deferred.resolve( result )
    
    onProgress= ( event )=>
      if (event.lengthComputable)
        percentComplete = (event.loaded/event.total)*100
        logger.debug "percent", percentComplete
        deferred.notify( {"download":percentComplete} )
    
    onError= ( event )=>
      deferred.reject(event)
    
    request.addEventListener 'load', onLoad, false
    request.addEventListener 'loadend', onLoad, false
    request.addEventListener 'progress', onProgress, false
    request.addEventListener 'error', onError, false
    
    request.send()
    return deferred.promise


    
module.exports = XHRStore
