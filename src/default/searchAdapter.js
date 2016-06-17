var when = require( "when" );

module.exports = () => {
	return {
		fetch: () => {
			return when.reject( "No default search adapter exists" );
		}
	};
};