/**
 * Promises/A+
 *
 * @class promise
 * @namespace abaaso
 */
var promise = {
	/**
	 * Promise factory
	 * 
	 * @method factory
	 * @return {Object} Instance of promise
	 */
	factory : function () {
		return new Promise();
	},

	// Caching if this function is available
	freeze : (function () {
		return (typeof Object.freeze === "function");
	})(),

	// Inherited by promises
	methods : {
		/**
		 * Breaks a Promise
		 * 
		 * @method reject
		 * @param  {Mixed} arg Promise outcome
		 * @return {Object} Promise
		 */
		reject : function ( arg ) {
			var self = this;

			utility.defer( function () {
				promise.resolve.call( self, promise.state.broken, arg );
			});

			return this;
		},

		/**
		 * Promise is resolved
		 * 
		 * @method resolve
		 * @param  {Mixed} arg Promise outcome
		 * @return {Object}    Promise
		 */
		resolve : function ( arg ) {
			var self = this;

			utility.defer( function () {
				promise.resolve.call( self, promise.state.resolved, arg );
			});

			return this;
		},

		/**
		 * Returns a boolean indicating state of the Promise
		 * 
		 * @method resolved
		 * @return {Boolean} `true` if resolved
		 */
		resolved : function () {
			return ( this.state === promise.state.broken || this.state === promise.state.resolved );
		},

		/**
		 * Registers handler( s ) for a Promise
		 * 
		 * @method then
		 * @param  {Function} success Executed when/if promise is resolved
		 * @param  {Function} failure [Optional] Executed when/if promise is broken
		 * @return {Object}           New Promise instance
		 */
		then : function ( success, failure ) {
			var self     = this,
			    deferred = promise.factory(),
			    fn;

			fn = function ( yay ) {
				var handler = yay ? success : failure,
				    error   = yay ? false   : true,
				    result;

				try {
					result = handler( self.outcome );
					error  = false;
				}
				catch ( e ) {
					result = e;
					error  = true;
					if ( result !== undefined && !( result instanceof Error ) ) {
						// Encoding Array or Object as a JSON string for transmission
						if ( typeof result === "object" ) {
							result = json.encode( result );
						}

						// Casting to an Error to fix context
						result = Error( result );
					}
				}
				finally {
					// Not a Promise, passing result & chaining if applicable
					if ( !( result instanceof Promise ) ) {
						// This is clearly a mistake on the dev's part
						if ( error && result === undefined ) {
							throw Error( label.error.invalidArguments );
						}
						else {
							deferred[!error ? "resolve" : "reject"]( result || self.outcome );
						}
					}
					// Assuming a `pending` state until `result` is resolved
					else {
						self.state        = promise.state.pending;
						self.outcome      = null;
						result.parentNode = self;
						result.then( function ( arg ) {
							self.resolve( arg );
						}, function ( arg ) {
							self.reject( arg );
						});
					}

					return result;
				}
			};

			if ( typeof success === "function" ) {
				promise.vouch.call( this, promise.state.resolved, function () {
					return fn(true); 
				});
			}

			if ( typeof failure === "function" ) promise.vouch.call( this, promise.state.broken, function () {
				return fn(false);
			});

			// Setting reference to `self`
			deferred.parentNode = self;

			return deferred;
		}
	},

	/**
	 * Resolves a Promise ( fulfilled or failed )
	 * 
	 * @method resolve
	 * @param  {String} state State to resolve
	 * @param  {String} val   Value to set
	 * @return {Object}       Promise instance
	 */
	resolve : function ( state, val ) {
		var handler = state === promise.state.broken ? "error" : "fulfill",
		    self    = this,
		    pending = false,
		    error   = false,
		    purge   = [],
		    i, reason, result;

		if ( this.state !== promise.state.pending ) {
			throw Error( label.error.promiseResolved.replace( "{{outcome}}", this.outcome ) );
		}

		this.state   = state;
		this.outcome = val;

		// The state & outcome can mutate here
		array.each( this[handler], function ( fn, idx ) {
			result = fn.call( self, val );
			purge.push( idx );

			if ( result instanceof Promise ) {
				pending      = true;
				self.outcome = null;
				self.state   = promise.state.pending

				return false;
			}
			else if ( result instanceof Error ) {
				error  = true;
				reason = result;
				state  = promise.state.broken;
			}
		});

		if ( !pending ) {
			this.error   = [];
			this.fulfill = [];

			// Possible jump to 'resolve' logic
			if ( !error ) {
				result = reason;
				state  = promise.state.resolved;
			}

			// Reverse chaining
			if ( this.parentNode !== null && this.parentNode.state === promise.state.pending ) {
				this.parentNode[state === promise.state.resolved ? "resolve" : "reject"]( result || this.outcome );
			}

			// Freezing promise
			if ( promise.freeze ) {
				Object.freeze( this );
			}

			return this;
		}
		else {
			// Removing handlers that have run
			i = purge.length;
			while ( i-- ) {
				array.remove( self[handler], purge[i] );
			}

			return result;
		}
	},

	// States of a promise
	state : {
		broken   : "rejected",
		pending  : "pending",
		resolved : "fulfilled"
	},

	/**
	 * Vouches for a state
	 * 
	 * @method vouch
	 * @param  {String}   state Promise descriptor
	 * @param  {Function} fn    Function to execute
	 * @return {Object}         Promise instance
	 */
	vouch : function ( state, fn ) {
		if ( string.isEmpty( state ) ) {
			throw Error( label.error.invalidArguments );
		}

		if ( this.state === promise.state.pending ) {
			this[state === promise.state.resolved ? "fulfill" : "error"].push( fn );
		}
		else if ( this.state === state ) {
			fn( this.outcome );
		}

		return this;
	}
};

/**
 * Promise factory
 *
 * @class Promise
 * @namespace abaaso
 * @return {Object} Instance of Promise
 */
function Promise () {
	this.error      = [];
	this.fulfill    = [];
	this.parentNode = null;
	this.outcome    = null;
	this.state      = promise.state.pending;
};

// Setting prototype & constructor loop
Promise.prototype = promise.methods;
Promise.prototype.constructor = Promise;
