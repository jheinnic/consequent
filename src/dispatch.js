var _ = require( "lodash" );
var when = require( "when" );
var hashqueue = require( "hashqueue" );
var format = require( "util" ).format;
var apply = require( "./apply" );
var log = require( "./log" )( "consequent.dispatch" );
var sliver;

function handle( queue, lookup, manager, models, id, topic, message ) {
	var types = lookup[ topic ] || [];
	var error;

	var dispatches = _.map( types, function( type ) {
		if ( !models[ type ] ) {
			error = format( "No registered models handle messages of type '%s'", topic );
			log.error( error );
			return when.reject( new Error( error ) );
		}

		return manager.getOrCreate( type, id )
			.then(
				onInstance.bind( null, models, queue, manager, topic, message, id ),
				onInstanceError.bind( null, type )
			);
	} );
	return when.all( dispatches )
		.then( _.flatten );
}

function onApplied( manager, result ) {
	if ( result && !result.rejected && result !== [ undefined ] && result !== [] ) {
		return storeEvents( manager, result );
	} else {
		return result;
	}
}

function onInstance( models, queue, manager, topic, message, id, instance ) {
	instance.state.id = instance.state.id || id;
	return apply( models, queue, topic, message, instance )
		.then( onApplied.bind( null, manager ) )
		.then( ( x ) => {
			return x[ 0 ]; 
		} )
		.then( onResult.bind( null, manager ) );
}

function onInstanceError( type, err ) {
	var error = format( "Failed to instantiate model '%s' with %s", type, err.stack );
	log.error( error );
	return when.reject( new Error( error ) );
}

function onResult( manager, result ) {
	var instance = {
		state: result.state,
		model: result.model
	};
	return manager.snapshot( instance, result.events )
		.then( () => result );
}

function storeEvents( manager, result ) {
	var promises = _.reduce( result, function( acc, set ) {
		var types = _.groupBy( set.events, "_modelType" );
		_.each( types, function( events, modelType ) {
			var promise = manager.storeEvents( modelType, events[ 0 ]._modelId, events );
			acc.push( promise );
		} );
		return acc;
	}, [] );
	return when.all( promises )
		.then( function() {
			return result;
		} );
}

module.exports = function( sliverFn, lookup, manager, models, queue, limit ) {
	sliver = sliverFn;
	queue = queue || hashqueue.create( limit || 8 );
	return {
		apply: apply.bind( undefined, models, queue ),
		handle: handle.bind( undefined, queue, lookup, manager, models )
	};
};
