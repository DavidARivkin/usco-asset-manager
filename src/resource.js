//TODO: should this be "asset??"

class Resource{
  constructor(uri)
  {
    var _uriElems;
    this.uri = uri;
    _uriElems = uri.split("?");
    this.name = _uriElems.shift().split("/").pop();
    this.ext = this.name.split(".").pop().toLowerCase();
    this.queryParams = _uriElems.pop();

    this.data = null;
    this.error = null;
    this.rawData = null;//data before processing : should not always be kept
    this.rawDataType = null;
    this.size = 0;
    this.loaded = false;
    this.fetched = false;
    
    this.fetchProgress = 0;
    this.parseProgress = 0;
    this.totalRawSize = 0;
    this.totalDisplaySize = "";//ODO: remove this, ui only
    this.deferred = null;
  }
}

export default Resource

