var _ = require( "lodash" );

function getArguments( fn ) {
	var fnString = fn.toString();
	var argsRegex = /[(][^)]*[)]/;
	if ( argsRegex.test( fnString ) ) {
		var argList = argsRegex.exec( fnString )[ 0 ];
		var argRegex = /(\w+|[{]\s*(\w+[,]?\s?)*\s*[}])/g;
		var list = [];
		do {
			var arg = argRegex.exec( argList );
			if( arg ) {
				list.push( arg[ 0 ] );
			}
		} while( arg );
		return list;
	} else {
		return undefined;
	}
}

function mapMessageToCall( method, map ) {
	var argumentList = getArguments( method ).slice( 1 );
	if ( map === false || map === undefined ) {
		return method;
	} else if ( _.isObject( map ) ) {
		return function( actor, message ) {
			var appliedArgs = [ actor ];
			_.each( argumentList, function( arg ) {
				if( /[{].*[}]/.test( arg ) ) {
					appliedArgs.push( message );
				} else {
					var prop = map[ arg ] ? map[ arg ] : arg;
					appliedArgs.push( message[ prop ] );
				}
			} );
			return method.apply( undefined, appliedArgs );
		};
	} else {
		return function( actor, message ) {
			var appliedArgs = [ actor ];
			_.each( argumentList, function( arg ) {
				if( /[{].*[}]/.test( arg ) ) {
					appliedArgs.push( message );
				} else {
					appliedArgs.push( message[ arg ] );
				}
			} );
			return method.apply( undefined, appliedArgs );
		};
	}
}

function trimString( str ) {
	return str.trim();
}

function trim( list ) {
	return ( list && list.length ) ? _.filter( list.map( trimString ) ) : [];
}

module.exports = {
	mapCall: mapMessageToCall,
	getArguments: getArguments
};
