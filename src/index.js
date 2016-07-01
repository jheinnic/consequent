var dispatchFn = require( "./dispatch" );
var loader = require( "./loader" );
var managerFn = require( "./manager" );
var modelsFn = require( "./model" );
var eventsFn = require( "./events" );
var searchFn = require( "./search" );
var subscriptions = require( "./subscriptions" );
var path = require( "path" );
var apply = require( "./apply" );
var hashqueue = require( "hashqueue" );
var sliver = require( "sliver" )();
var defaultNodeId = [ process.title, process.pid ].join( "-" );

var defaults = {
	modelCache: require( "./default/modelCache" )(),
	modelStore: require( "./default/modelStore" )(),
	eventCache: require( "./default/eventCache" )(),
	eventStore: require( "./default/eventStore" )(),
	searchAdapter: require( "./default/searchAdapter" )(),
};

function initialize( config ) {
	require( "./log" )( config.logging || {
		adapters: {}
	} );

	config.modelCache = config.modelCache || defaults.modelCache;
	config.modelStore = config.modelStore || defaults.modelStore;
	config.eventCache = config.eventCache || defaults.eventCache;
	config.eventStore = config.eventStore || defaults.eventStore;
	config.searchAdapter = config.searchAdapter || defaults.searchAdapter;

	if ( !config.fount ) {
		config.fount = require( "fount" );
	}

	var defaultQueue = hashqueue.create( config.concurrencyLimit || 8 );
	var queue = config.queue = ( config.queue || defaultQueue );
	var modelsPath = config.models || path.join( process.cwd(), "./models" );

	function onMetadata( models ) {
		var lookup = subscriptions.getModelLookup( models );
		var topics = subscriptions.getTopics( models );
		var modelAdapter = modelsFn( models, config.modelStore, config.modelCache, config.nodeId || defaultNodeId );
		var eventAdapter = eventsFn( sliver, config.eventStore, config.eventCache );
		var manager = managerFn( models, modelAdapter, eventAdapter, queue );
		var search = searchFn( models, config.searchAdapter );
		var dispatcher = dispatchFn( sliver, lookup, manager, models, config.queue );

		return {
			apply: function( instance, message ) {
				return apply( models, config.queue, message.type || message.topic, message, instance );
			},
			fetch: ( type, id, readOnly ) => {
				return manager.getOrCreate( type, id, readOnly )
					.then( ( instance ) => instance.state );
			},
			fetchRaw: manager.getOrCreate,
			mapEvents: eventAdapter.mapEvents,
			find: search.find,
			handle: dispatcher.handle,
			topics: topics,
			models: models
		};
	}

	return loader( config.fount, modelsPath )
		.then( onMetadata );
}

module.exports = initialize;
