var _ = require( "lodash" );
var fs = require( "fs" );
var path = require( "path" );
var glob = require( "globulesce" );
var when = require( "when" );
var util = require( "./util" );
var log = require( "./log" )( "consequent.loader" );

// returns a list of resource files from a given parent directory
function getModels( filePath ) {
	if ( fs.existsSync( filePath ) ) {
		return glob( filePath, [ "*_model.js" ] );
	} else {
		var error = "Could not load models from non-existent path '" + filePath + "'";
		log.error( error );
		return when.reject( new Error( error ) );
	}
}

// loads a module based on the file path
function loadModule( modelPath ) {
	try {
		var key = path.resolve( modelPath );
		delete require.cache[ key ];
		return require( modelPath );
	} catch ( err ) {
		log.error( "Error loading model module at %s with %s", modelPath, err.stack );
		return undefined;
	}
}

// load models from path and returns the modules once they're loaded
function loadModels( fount, models ) {
	var result;

	function addModel( acc, instance ) {
		var factory = _.isFunction( instance.state ) ?
			instance.state :
			function() {
				return _.cloneDeep( instance.state );
			};
		try {
			processHandles( instance );
		}
		catch ( e ) {
			log( "Error processing model %s with %s", instance.model.type, e.stack ? e.stack : e );
		}
		acc[ instance.model.type ] = {
			factory: factory,
			metadata: instance
		};
		return acc;
	}

	function onModels( list ) {
		function onInstances( instances ) {
			return _.reduce( instances, addModel, {} );
		}

		var modules = _.filter( list );
		var promises = _.map( modules, function( modulePath ) {
			var modelFn = loadModule( modulePath );
			return fount.inject( modelFn );
		} );

		return when
			.all( promises )
			.then( onInstances );
	}

	if ( _.isString( models ) ) {
		var filePath = models;
		if ( !fs.existsSync( filePath ) ) {
			filePath = path.resolve( process.cwd(), filePath );
		}
		return getModels( filePath )
			.then( onModels );
	} else if ( _.isArray( models ) ) {
		result = _.reduce( models, function( acc, instance ) {
			addModel( acc, instance );
			return acc;
		}, {} );
		return when.resolve( result );
	} else if ( _.isObject( models ) ) {
		result = _.reduce( models, function( acc, instance ) {
			addModel( acc, instance );
			return acc;
		}, {} );
		return when.resolve( result );
	} else if ( _.isFunction( models ) ) {
		result = models();
		if ( !result.then ) {
			result = when.resolve( result );
		}
		return result.then( function( list ) {
			return _.reduce( list, function( acc, instance ) {
				addModel( acc, instance );
				return when.resolve( acc );
			}, {} );
		} );
	}
}

function processHandle( handle ) {
	var hash = handle;
	if ( _.isArray( handle ) ) {
		hash = {
			when: handle[ 0 ],
			then: handle[ 1 ],
			exclusive: handle[ 2 ],
			map: handle[ 3 ]
		};
	} else if ( _.isFunction( handle ) ) {
		hash = {
			when: true,
			then: handle,
			exclusive: true,
			map: true
		};
	} else if ( _.isObject( handle ) ) {
		hash = {
			when: _.has( handle, "when" ) ? handle.when : true,
			then: handle.then,
			exclusive: _.has( handle, "exclusive" ) ? handle.exclusive : true,
			map: _.has( handle, "map" ) ? handle.map : true
		};
	}

	var map = hash.map;
	if ( _.isFunction( hash.when ) ) {
		hash.when = util.mapCall( hash.when, map );
	}
	hash.then = util.mapCall( hash.then, map );

	return hash;
}

function processHandles( instance ) {
	instance.commands = _.reduce( instance.commands, function( acc, handlers, name ) {
		if ( _.isArray( handlers ) ) {
			acc[ name ] = _.map( handlers, processHandle );
		} else {
			acc[ name ] = _.map( [ handlers ], processHandle );
		}
		return acc;
	}, {} );
	instance.events = _.reduce( instance.events, function( acc, handlers, name ) {
		if ( _.isArray( handlers ) ) {
			acc[ name ] = _.map( handlers, processHandle );
		} else {
			acc[ name ] = _.map( [ handlers ], processHandle );
		}
		return acc;
	}, {} );
}

module.exports = loadModels;
