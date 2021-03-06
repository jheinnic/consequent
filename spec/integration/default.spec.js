require( "../setup" );

var fn = require( "../../src/index" );

describe( "Consequent Example", function() {
	var consequent;
	before( function() {
		return fn( {
			actors: "./spec/actors"
		} ).then( function( x ) {
			consequent = x;
		} );
	} );

	describe( "when fetching for missing record", function() {
		it( "should result in a blank instance", function() {
			return consequent.fetch( "account", "0000001" )
				.should.eventually.partiallyEql( { state:
					{
						balance: 0,
						holder: "",
						number: "",
						open: false,
						transactions: []
					}
				} );
		} );
	} );

	describe( "when handling commands ", function() {
		describe( "with a create command", function() {
			var events = [];
			var command = {
				type: "account.open",
				accountHolder: "Test User",
				accountNumber: "0000001",
				initialDeposit: 100
			};
			before( function() {
				return consequent.handle( "0000001", "account.open", command )
					.then( function( result ) {
						events = result;
					}, console.log );
			} );

			it( "should produce opened and deposited events", function() {
				return events.should.partiallyEql( [
					{
						message: command,
						actor: {
							id: "0000001",
							balance: 0,
							transactions: []
						},
						events: [
							{
								correlationId: "0000001",
								actorType: "account",
								initiatedBy: "account.open",
								type: "account.opened",
								accountHolder: "Test User",
								accountNumber: "0000001"
							},
							{
								correlationId: "0000001",
								actorType: "account",
								initiatedBy: "account.open",
								type: "account.deposited",
								initial: true,
								amount: 100
							}
						]
					}
				] );
			} );

			it( "should apply events on next read", function() {
				return consequent.fetch( "account", "0000001" )
					.then( function( instance ) {
						return instance.state.should.partiallyEql(
							{
								id: "0000001",
								number: "0000001",
								holder: "Test User",
								balance: 100,
								open: true,
								transactions: [
									{ credit: 100, debit: 0 }
								]
							}
						);
					} );
			} );

			describe( "when sending commands to existing actor with outstanding events", function() {
				before( function() {
					var withdraw = {
						type: "account.withdraw",
						amount: 33.33
					};
					return consequent.handle( "0000001", "account.withdraw", withdraw );
				} );

				it( "should apply events on subsequent read", function() {
					return consequent.fetch( "account", "0000001" )
					.then( function( instance ) {
						return instance.state.should.partiallyEql(
							{
								id: "0000001",
								number: "0000001",
								holder: "Test User",
								balance: 66.67,
								open: true,
								transactions: [
									{ credit: 100, debit: 0 },
									{ credit: 0, debit: 33.33 }
								]
							}
						);
					} );
				} );
			} );
		} );
	} );
} );
