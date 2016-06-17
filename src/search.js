function getAdapter( adapters, lib, type ) {
	var adapter = adapters[ type ];
	if ( !adapter ) {
		adapters[ type ] = lib.create( type );
	}
	return adapter;
}

function find( actors, adapters, lib, type, criteria ) {
	var adapter = getAdapter( adapters, lib, type );
	return adapter.find( criteria );
}

module.exports = function( actors, searchLib ) {
	var adapters = {};
	return {
		adapters: adapters,
		find: find.bind( null, actors, adapters, searchLib )
	};
};
