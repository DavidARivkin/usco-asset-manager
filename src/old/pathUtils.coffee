path = require 'path'

parseFileUri= ( fileUri )->
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

toAbsoluteUri=(fileName, parentUri, store)->
  #normalization test
  path = require 'path'
  
  segments = fileName.split( "/" )
  if segments[0] != '.' and segments[0] != '..'
    return fileName
  
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
    
  return fullPath
  
module.exports.parseFileUri = parseFileUri
module.exports.toAbsoluteUri= toAbsoluteUri
