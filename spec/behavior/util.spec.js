require( "../setup" );
var util = require( "../../src/util" );

describe( "Utility/Helpers", function() {
	describe( "when spreading message properties over function parameters", function() {
		function testCall( actor, argOne, argTwo, argThree ) {
			return [ actor, argOne, argTwo, argThree ];
		}

		var model = {
			test: testCall
		};
		var actor = { id: "testing" };

		describe( "with exact matches", function() {
			var message = { argOne: 1, argTwo: "two", argThree: true };
			var result;

			before( function() {
				var fn = util.mapCall( model.test, true );
				result = fn( actor, message );
			} );

			it( "should call the function with correct arguments", function() {
				result.should.eql( [ actor, 1, "two", true ] );
			} );
		} );

		describe( "with partial matches and a map", function() {
			describe( "and a map", function() {
				var message = { argOne: 1, arg2: "two", argThree: true };
				var result;

				before( function() {
					var fn = util.mapCall( model.test, {
						argTwo: "arg2"
					} );

					result = fn( actor, message );
				} );

				it( "should call the function with correct arguments", function() {
					result.should.eql( [ actor, 1, "two", true ] );
				} );
			} );

			describe( "and no map", function() {
				var message = { argOne: 1, arg2: "two", argThree: true };
				var result;

				before( function() {
					var fn = util.mapCall( model.test, true );

					result = fn( actor, message );
				} );

				it( "should call the function with correct arguments", function() {
					result.should.eql( [ actor, 1, undefined, true ] );
				} );
			} );
		} );

		describe( "with no matches", function() {
			describe( "and a map", function() {
				var message = { arg1: 1, arg2: "two", arg3: true };
				var result;

				before( function() {
					var fn = util.mapCall( model.test, {
						argOne: "arg1",
						argTwo: "arg2",
						argThree: "arg3"
					} );

					result = fn( actor, message );
				} );

				it( "should call the function with correct arguments", function() {
					result.should.eql( [ actor, 1, "two", true ] );
				} );
			} );

			describe( "and no valid map", function() {
				var message = { arg1: 1, arg2: "two", arg3: true };
				var result;

				before( function() {
					var fn = util.mapCall( model.test, true );
					result = fn( actor, message );
				} );

				it( "should call the function with undefined arguments", function() {
					result.should.eql( [ actor, undefined, undefined, undefined ] );
				} );
			} );
		} );

		describe( "with ES6 destructuring", function() {
			var nextLevel1 = ( actor, { a, b, c, d } ) => [ actor, a, b, c, d ];
			var nextLevel2 = ( actor, { a, b, c }, d ) => [ actor, a, b, c, d ];
			var nextLevel3 = ( actor, { a, b, c }, e ) => [ actor, a, b, c, e ];
			var nextLevel4 = ( actor, { a, b, c, e } ) => [ actor, a, b, c, e ];
			var actor = { id: 1 };
			var message = { a: "a", b: "b", c: "c", d: "d" };

			describe( "and complete match", function() {
				var result;
				before( function() {
					var fn = util.mapCall( nextLevel1, true );
					result = fn( actor, message );
				} );

				it( "should pass all arguments correctly", function() {
					result.should.eql( [ actor, "a", "b", "c", "d" ] );
				} );
			} );
		} );
	} );
} );
