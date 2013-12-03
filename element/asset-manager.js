Polymer('asset-manager', {
  created: function() {
    AssetManager = require("AssetManager");
    this._assetManager = new AssetManager();

    //stores, parsers, assetcache
  },
  _onResourceLoaded: function( resource) 
  {
    this.fire("resource:loaded",resource);
  },
  //API
  addParser: function( extension, parser ) //why would we want to add them on the fly via api ?
  {
    return this._assetManager.addParser( extension, parser );
  },
  read: function( fileUri, parentUri, cachingParams )
  {
    var promise = this._assetManager.load( fileUri, parentUri, cachingParams );
    promise.then( this._onResourceLoaded.bind(this) );
    return promise
  }
});
