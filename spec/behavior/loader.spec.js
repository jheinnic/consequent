require( "../setup" );
var loader = require( "../../src/loader" );
var fount = require( "fount" );

describe( "Loading models", function() {
	describe( "with bad path", function() {
		it( "should result in an error", function() {
			return loader( fount, "./noSuch" ).should.eventually.be.rejectedWith( "Could not load models from non-existent path '/git/labs/consequent/noSuch'" );
		} );
	} );

	describe( "with valid path", function() {
		var models;
		before( function() {
			return loader( fount, "./spec/models" )
				.then( function( res ) {
					models = res;
				} );
		} );
		it( "should resolve with models", function() {
			return models.should.have.property( "account" );
		} );

		it( "should return valid fmodely", function() {
			return models.account.metadata.should.include.keys( [ "model", "commands", "events" ] );
		} );
	} );
} );
