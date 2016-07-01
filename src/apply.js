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
	if( isCommand ) {
		var results = _.map( handlers, function( handle ) {
			return queue.add( instance.state.id, function() {
				return processCommand( models, handle, instance, message );
			} );
		} );
		return when.all( results )
			.then( _.filter );
	} else {
		var q = immediateQueue();
		_.each( handlers, function( handle ) {
			q.add( null, function() {
				processEvent( models, handle, instance, message );
			} );
		} );
		return when();
	}
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
	event._initiatedBy = command.type || command.topic;
	event._initiatedById = command.id;
	event._createdBy = model.type;
	event._createdById = model.id;
	event._createdByVector = model._vector;
	event._createdByVersion = model._version;
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
	var model = { type: instance.model.type };

	function onSuccess( events ) {
		_.merge( model, instance.state );
		var original = _.cloneDeep( model );
		events = _.isArray( events ) ? events : [ events ];
		_.each( events, enrichEvent.bind( null, model, command ) );
		model.lastCommandId = command.id;
		model.lastCommandHandledOn = new Date().toISOString();
		_.each( events, function( e ) {
			apply( models, immediateQueue(), e.type, e, instance );
		} );
		
		return {
			message: command,
			model: instance.state,
			original: original,
			events: events || []
		};
	}

	function onError( err ) {
		return {
			rejected: true,
			message: command,
			model: model,
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
	handle( instance.state, event );
	if ( instance.model.aggregateFrom ) {
		instance.state.lastEventId = instance.state.lastEventId || {};
		instance.state.lastEventId[ event.modelType ] = event.id;
	} else {
		instance.state.lastEventId = event.id;
	}
	instance.state.lastEventAppliedOn = new Date().toISOString();
}

module.exports = apply;
