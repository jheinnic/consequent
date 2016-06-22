var dispatchFn = require( "./dispatch" );
var loader = require( "./loader" );
var managerFn = require( "./manager" );
var actorsFn = require( "./actors" );
var eventsFn = require( "./events" );
var searchFn = require( "./search" );
var subscriptions = require( "./subscriptions" );
var path = require( "path" );
var apply = require( "./apply" );
var hashqueue = require( "hashqueue" );
var defaultNodeId = [ process.title, process.pid ].join( "-" );

var defaults = {
	actorCache: require( "./default/actorCache" )(),
	actorStore: require( "./default/actorStore" )(),
	eventCache: require( "./default/eventCache" )(),
	eventStore: require( "./default/eventStore" )(),
	searchAdapter: require( "./default/searchAdapter" )(),
};

function initialize( config ) {
	require( "./log" )( config.logging || {
		adapters: {}
	} );

	config.actorCache = config.actorCache || defaults.actorCache;
	config.actorStore = config.actorStore || defaults.actorStore;
	config.eventCache = config.eventCache || defaults.eventCache;
	config.eventStore = config.eventStore || defaults.eventStore;
	config.searchAdapter = config.searchAdapter || defaults.searchAdapter;

	if ( !config.fount ) {
		config.fount = require( "fount" );
	}

	var defaultQueue = hashqueue.create( config.concurrencyLimit || 8 );
	var queue = config.queue = ( config.queue || defaultQueue );
	var actorsPath = config.actors || path.join( process.cwd(), "./actors" );

	function onMetadata( actors ) {
		var lookup = subscriptions.getActorLookup( actors );
		var topics = subscriptions.getTopics( actors );
		var actorAdapter = actorsFn( actors, config.actorStore, config.actorCache, config.nodeId || defaultNodeId );
		var eventAdapter = eventsFn( config.eventStore, config.eventCache );
		var manager = managerFn( actors, actorAdapter, eventAdapter, queue );
		var search = searchFn( actors, config.searchAdapter );
		var dispatcher = dispatchFn( lookup, manager, actors, config.queue );

		return {
			apply: function( instance, message ) {
				return apply( actors, config.queue, message.type || message.topic, message, instance );
			},
			fetch: ( type, id, readOnly ) => {
				return manager.getOrCreate( type, id, readOnly )
					.then( ( instance ) => instance.state );
			},
			fetchRaw: manager.getOrCreate,
			find: search.find,
			handle: dispatcher.handle,
			topics: topics,
			actors: actors
		};
	}

	return loader( config.fount, actorsPath )
		.then( onMetadata );
}

module.exports = initialize;
