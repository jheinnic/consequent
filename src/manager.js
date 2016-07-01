var _ = require( "lodash" );
var when = require( "when" );
var sequence = require( "when/sequence" );
var apply = require( "./apply" );

function getSourceId( instance, source, id ) {
	var state = instance.state;
	var propId = state[ source + "Id" ];
	var nestedId = state[ source ] ? state[ source ].id : undefined;
	return propId || nestedId || id;
}

function onModel( applyFn, modelAdapter, eventAdapter, eventCriteria, readOnly, instance ) {
	if ( _.isArray( instance ) ) {
		var first = instance[ 0 ];
		return modelAdapter.findAncestor( first.state.id, instance, [] )
			.then( onModel.bind( null, applyFn, modelAdapter, eventAdapter, eventCriteria, readOnly ) );
	} else {
		var type = instance.model.type;
		var id = instance.state.id;
		var lastEventId = instance.state.lastEventId;
		var factory = applyFn.bind( null, instance );

		if ( instance.model.aggregateFrom ) {
			var promises = _.map( instance.model.aggregateFrom, function( source ) {
				var last = instance.state.lastEventId[ source ];
				var sourceId = getSourceId( instance, source, id );
				return eventAdapter.fetch( source, sourceId, last );
			} );
			return when.all( promises )
				.then( function( lists ) {
					var list = _.sortBy( _.flatten( lists ), "id" );
					return onEvents( modelAdapter, eventAdapter, instance, factory, readOnly, list );
				} );
		} else if( eventCriteria && eventCriteria.length ) {
			var promises = _.map( eventCriteria, function( criteria ) {
				var last = instance.state.lastEventId[ criteria.model ];
				if( criteria.index ) {
					return evenAdapter.fetchByIndex( criteria.model, criteria.index.name, criteria.index.value, last );
				} else {
					return eventAdapter.find( criteria.model, criteria.where, last );
				}
			} );
			return when.all( promises )
				.then( function( lists ) {
					var list = _.sortBy( _.flatten( lists ), "id" );
					return onEvents( modelAdapter, eventAdapter, instance, factory, readOnly, list );
				} );
		} else {
			return eventAdapter.fetch( type, id, lastEventId )
				.then( onEvents.bind( null, modelAdapter, eventAdapter, instance, factory, readOnly ) );
		}
	}
}

function onEvents( modelAdapter, eventAdapter, instance, factory, readOnly, events ) {
	var calls = _.map( events, factory );
	return sequence( calls )
		.then( function() {
			return snapshot( modelAdapter, eventAdapter, events, readOnly, instance );
		} );
}

function getLatest( models, modelAdapter, eventAdapter, queue, type, id, eventCriteria, readOnly ) {
	function applyFn( instance, event ) {
		return function() {
			return apply( models, queue, event.type, event, instance );
		};
	}
	return modelAdapter.fetch( type, id )
		.then( onModel.bind( null, applyFn, modelAdapter, eventAdapter, eventCriteria, readOnly ) );
}

function snapshot( modelAdapter, eventAdapter, events, readOnly, instance ) {
	var model = instance.model;
	var state = instance.state;
	var limit = model.eventThreshold || 50;
	var skip = model.snapshotOnRead ? false : readOnly;
	var underLimit = events.length < limit;

	function onSnapshot() {
		if( model.storeEventPack ) {
			return eventAdapter.storePack( model.type, state.id, state.vector, state.lastEventId, events )
				.then( onEventpack, onEventpackError );
		} else {
			return instance;
		}
	}

	function onSnapshotError() {
		return instance;
	}

	function onEventpack() {
		return instance;
	}

	function onEventpackError() {
		return instance;
	}
	if ( skip || underLimit ) {
		return instance;
	} else {
		return modelAdapter.store( instance )
			.then( onSnapshot, onSnapshotError );
	}
}

module.exports = function( models, modelAdapter, eventAdapter, queue ) {
	return {
		models: modelAdapter,
		events: eventAdapter,
		getOrCreate: getLatest.bind( null, models, modelAdapter, eventAdapter, queue ),
		storeActor: modelAdapter.store,
		storeEvents: eventAdapter.store
	};
};
