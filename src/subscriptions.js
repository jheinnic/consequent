var _ = require( "lodash" );

function createReverseLookup( map ) {
	return _.reduce( map, function( acc, topics, type ) {
		_.each( topics.events, function( topic ) {
			acc[ topic ] = acc[ topic ] ? ( _.uniq( acc[ topic ].push( type ) ).sort() ) : [ type ];
		} );
		_.each( topics.commands, function( topic ) {
			acc[ topic ] = acc[ topic ] ? ( _.uniq( acc[ topic ].push( type ) ).sort() ) : [ type ];
		} );
		return acc;
	}, {} );
}

function getSubscriptionMap( models ) {
	return _.reduce( models, function( acc, model ) {
		var metadata = model.metadata;
		function prefix( topic ) {
			return [ metadata.model.type, topic ].join( "." );
		}
		var events = _.map( _.keys( metadata.events || {} ), prefix );
		var commands = _.map( _.keys( metadata.commands || {} ), prefix );
		acc[ metadata.model.type ] = {
			events: events,
			commands: commands
		};
		return acc;
	}, {} );
}

function getTopicList( map ) {
	var lists = _.reduce( map, function( acc, lists ) {
		acc = acc.concat( lists.events || [] );
		acc = acc.concat( lists.commands || [] );
		return acc;
	}, [] );
	return _.uniq( lists ).sort();
}

module.exports = {
	getModelLookup: function( models ) {
		return createReverseLookup( getSubscriptionMap( models ) );
	},
	getSubscriptions: getSubscriptionMap,
	getTopics: function( models ) {
		return getTopicList( getSubscriptionMap( models ) );
	}
};
