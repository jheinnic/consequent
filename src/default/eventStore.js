var _ = require( "lodash" );
var when = require( "when" );

function getEventsFor( state, type, modelId, lastEventId ) {
	var modelEvents = state.events[ type ];
	if ( modelEvents ) {
		var events = _.filter( modelEvents[ modelId ], function( event ) {
			return !lastEventId || lastEventId < event.id;
		} );
		return when( events );
	}
	return when( undefined );
}

function getEventPackFor( state, type, modelId, vectorClock ) {
	var packs = state.packs[ type ];
	if ( packs ) {
		var key = [ modelId, vectorClock ].join( "-" );
		return when( packs[ key ] );
	}
	return when( undefined );
}

function storeEvents( state, type, modelId, events ) {
	var modelEvents = state.events[ type ] = state.events[ type ] || {};
	var list = modelEvents[ modelId ] = modelEvents[ modelId ] || [];
	list = events.concat( list );
	state.events[ type ][ modelId ] = list;
	return when();
}

function storeEventPackFor( state, type, modelId, vectorClock, events ) {
	var packs = state.packs[ type ] || {};
	var key = [ modelId, vectorClock ].join( "-" );
	packs[ key ] = events;
	state.packs[ type ] = packs;
	return when();
}

module.exports = function() {
	var state = {
		events: {},
		packs: {}
	};
	return {
		create: function( type ) {
			return {
				getEventsFor: getEventsFor.bind( null, state, type ),
				getEventPackFor: getEventPackFor.bind( null, state, type ),
				storeEvents: storeEvents.bind( null, state, type ),
				storeEventPackFor: storeEventPackFor.bind( null, state, type )
			};
		}
	};
};
