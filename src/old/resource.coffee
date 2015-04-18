

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
    @fetched = false

    @fetchProgress = 0;
    @parseProgress = 0;
    @totalRawSize = 0;

    @totalDisplaySize = ""#TODO: remove this, ui only
    @deferred = null


module.exports = Resource
