var when = require( "when" );

function get( state, type, id ) {
	if( state[ type ] ) {
		return when( state[ type ][ id ] );
	} else {
		return when( undefined );
	}
}

function set( state, type, id, instance ) {
	if( !state[ type ] ) {
		state[ type ] = {};
	}
	state[ type ][ id ] = instance;
}

function getEventsFor( state, type, actorId, lastEventId ) {
	var actorEvents = state.events[ type ];
	if( actorEvents ) {
		return when( actorEvents[ actorId ] );
	}
	return when( undefined );
}

function getEventPackFor( state, type, actorId, vectorClock ) {
	var packs = state.packs[ type ];
	if( packs ) {
		var key = [ actorId, vectorClock ].join( "-" );
		return when( packs[ key ] );
	}
	return when( undefined );
}

function storeEvents( state, type, actorId, events ) {
	var actorEvents = state.events[ type ] = state.events[ type ] || {};
	var list = actorEvents[ actorId ] = actorEvents[ actorId ] || [];
	list = events.concat( list );
	state.events[ type ][ actorId ] = list;
	return when();
}

function storeEventPackFor( state, type, actorId, vectorClock, events ) {
	var packs = state.packs[ type ] || {};
	var key = [ actorId, vectorClock ].join( "-" );
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
