var _ = require( "lodash" );
var when = require( "when" );
var format = require( "util" ).format;
var clock = require( "vectorclock" );
var log = require( "./log" )( "consequent.models" );

function getAdapter( adapters, lib, io, type ) {
	var adapter = adapters[ io ][ type ];
	if ( !adapter ) {
		adapter = lib.create( type );
		adapters[ io ][ type ] = adapter;
	}
	return adapter;
}

function getCache( adapters, cacheLib, type ) {
	return getAdapter( adapters, cacheLib, "cache", type );
}

function getStore( adapters, storeLib, type ) {
	return getAdapter( adapters, storeLib, "store", type );
}

function getFromCache( models, adapters, cacheLib, type, id ) {
	var cache = getCache( adapters, cacheLib, type );

	function onInstance( instance ) {
		var clone;
		if ( instance ) {
			clone = _.cloneDeep( models[ type ].metadata );
			clone.state = instance;
			clone.state.id = id;
		}
		return clone;
	}

	function onError( err ) {
		var error = format( "Failed to get instance '%s' of '%s' from cache with %s", id, type, err );
		log.error( error );
		return undefined;
	}

	return cache.fetch( id )
		.then( onInstance, onError );
}

function getFromStore( models, adapters, storeLib, type, id ) {
	var store = getStore( adapters, storeLib, type );
	function onInstance( instance ) {
		var promise = models[ type ].factory( id );
		if ( !promise.then ) {
			promise = when.resolve( promise );
		}
		return promise
			.then( function( state ) {
				var clone = _.cloneDeep( models[ type ].metadata );
				if ( instance ) {
					clone.state = _.defaults( instance, state );
				}
				clone.state.id = id;
				return clone;
			} );
	}

	function onError( err ) {
		var error = format( "Failed to get instance '%s' of '%s' from store with %s", id, type, err );
		log.error( error );
		return when.reject( new Error( error ) );
	}

	return store.fetch( id )
		.then( onInstance, onError );
}

function getBaseline( models, adapters, storeLib, cacheLib, type, id ) {
	function onmodel( instance ) {
		if ( instance ) {
			return instance;
		} else {
			return getFromStore( models, adapters, storeLib, type, id );
		}
	}

	return getFromCache( models, adapters, cacheLib, type, id )
		.then( onmodel );
}

function getVersion( vector ) {
	var clocks = vector.split( ";" );
	return clocks.reduce( function( version, clock ) {
		var parts = clock.split( ":" );
		return version + parseInt( parts[ 1 ] );
	}, 0 );
}

function parseVector( vector ) {
	var pairs = vector.split( ";" );
	return _.reduce( pairs, function( acc, pair ) {
		var kvp = pair.split( ":" );
		acc[ kvp[ 0 ] ] = parseInt( kvp[ 1 ] );
		return acc;
	}, {} );
}

function stringifyVector( vector ) {
	var pairs = _.filter( _.map( vector, function( v, k ) {
		return k && v ? `${k}:${v}` : "";
	} ) );
	return pairs.join( ";" );
}

function storeSnapshot( models, adapters, storeLib, cacheLib, nodeId, instance ) {
	var model = instance.model;
	var state = instance.state;
	var type = model.type;
	var cache = getCache( adapters, cacheLib, type );
	var store = getStore( adapters, storeLib, type );
	var vector = parseVector( state._vector || "" );
	vector = clock.increment( vector, nodeId );
	state._ancestor = state._vector;
	state._vector = stringifyVector( vector );
	state._version = getVersion( state._vector );
	function onCacheError( err ) {
		var error = format( "Failed to cache model '%s' of '%s' with %s", state.id, type, err );
		log.error( error );
		throw new Error( error );
	}

	function onStored() {
		return cache.store( state.id, state._vector, state )
			.then( null, onCacheError );
	}

	function onError( err ) {
		var error = format( "Failed to store model '%s' of '%s' with %s", state.id, type, err );
		log.error( error );
		throw new Error( error );
	}

	return store.store( state.id, state._vector, state )
		.then( onStored, onError );
}

module.exports = function( models, modelStoreLib, modelCacheLib, nodeId ) {
	var adapters = {
		store: {},
		cache: {}
	};
	return {
		adapters: adapters,
		fetch: getBaseline.bind( null, models, adapters, modelStoreLib, modelCacheLib ),
		store: storeSnapshot.bind( null, models, adapters, modelStoreLib, modelCacheLib, nodeId )
	};
};
