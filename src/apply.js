var _ = require( "lodash" );
var when = require( "when" );
var sliver = require( "sliver" )();

function apply( models, queue, topic, message, instance ) {
	var type = instance.model.type;
	var metadata = models[ type ].metadata;
	var parts = topic.split( "." );
	var alias = parts[ 0 ] === type ? parts.slice( 1 ).join( "." ) : topic;
	var isCommand = metadata.commands[ alias ];
	var getHandlers = isCommand ? getCommandHandlers : getEventHandlers;
	var handlers = getHandlers( metadata, instance, alias, message );
	var q = isCommand ? queue : immediateQueue();
	var processMessage = isCommand ? processCommand : processEvent;
	var results = _.map( handlers, function( handle ) {
		return q.add( instance.state.id, function() {
			return processMessage( models, handle, instance, message );
		} );
	} );
	return when.all( results )
		.then( _.filter );
}

function enrichEvent( model, command, event ) {
	event.id = sliver.getId();
	var ambientType = event.type ? event.type.split( "." )[ 0 ] : "";
	if ( ambientType === model.type ) {
		event._modelId = model.id;
		event._modelType = model.type;
	} else {
		event._modelType = ambientType;
	}
	event._commandType = command.type || command.topic;
	event._commandId = command.id || "";
	event._createdBy = model.type;
	event._createdById = model.id;
	event._createdByVector = model._vector || "";
	event._createdByVersion = model._version || "";
	event._createdOn = new Date().toISOString();
}

function filterHandlers( handlers, instance, message ) {
	var list = [];
	return _.reduce( handlers, function( acc, def ) {
		var predicate = def.when;
		var handle = def.then;
		var exclusive = def.exclusive;
		var should = false;
		if ( !exclusive || list.length === 0 ) {
			should = predicate === true ||
				( _.isString( predicate ) && instance.state.state === predicate ) ||
				( _.isFunction( predicate ) && predicate( instance.state, message ) );
			if ( should ) {
				acc.push( handle );
			}
		}
		return acc;
	}, list );
}

function getCommandHandlers( metadata, instance, topic, message ) {
	return filterHandlers( metadata.commands[ topic ], instance, message );
}

function getEventHandlers( metadata, instance, topic, message ) {
	return filterHandlers( metadata.events[ topic ], instance, message );
}

function immediateQueue() {
	return {
		add: function add ( id, cb ) {
			return cb();
		}
	};
}

function processCommand( models, handle, instance, command ) {
	var result = handle( instance.state, command );
	result = result && result.then ? result : when( result );
	function onSuccess( events ) {
		var model = instance.state;
		model.type = instance.model.type;
		var original = _.cloneDeep( model );
		events = _.filter( _.isArray( events ) ? events : [ events ] );
		model._lastCommandId = command.id;
		model._lastCommandHandledOn = new Date().toISOString();
		_.each( events, enrichEvent.bind( null, model, command ) );
		_.each( events, function( e ) {
			apply( models, immediateQueue(), e.type, e, instance );
		} );
		return {
			message: command,
			model: instance.model,
			state: instance.state,
			original: original,
			events: events || []
		};
	}

	function onError( err ) {
		return {
			rejected: true,
			message: command,
			model: instance.model,
			state: model,
			reason: err
		};
	}

	return result
		.then( onSuccess, onError )
		.then( ( set ) => {
			return set;
		} );
}

function processEvent( models, handle, instance, event ) {
	var original = _.cloneDeep( instance.state );
	handle( instance.state, event );
	if ( instance.model.aggregateFrom ) {
		instance.state._lastEventId = instance.state._lastEventId || {};
		instance.state._lastEventId[ event.modelType ] = event.id;
	} else {
		instance.state._lastEventId = event.id;
	}
	instance.state._lastEventAppliedOn = new Date().toISOString();
	return {
		events: [ event ],
		orginal: original,
		state: instance.state,
		model: instance.model
	};
}

module.exports = apply;
