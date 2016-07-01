require( "../setup" );
var apply = require( "../../src/apply" );
var loader = require( "../../src/loader" );
var fount = require( "fount" );
var hashqueue = require( "hashqueue" );
var queue = hashqueue.create( 4 );

function yep() {
	return true;
 }
function nope() {
	return false;
 }

function createMetadata() {
	return {
		test: {
			model: {
				type: "test"
			},
			state: {
				id: 1
			},
			commands: {
				doOne: [
					{
						when: nope,
						then: function( model, command ) {
							return [
								{ type: "one.zero", id: 1 }
							];
						}
					},
					{
						when: yep,
						then: function( model, command ) {
							return [
								{ type: "one.one", id: 1 }
							];
						}
					},
					{
						when: yep,
						then: function( model, command ) {
							return [
								{ type: "one.two", id: 2 }
							];
						}
					}
				],
				doTwo: [
					{
						when: yep,
						then: function( model, command ) {
							return [
								{ type: "two.one", id: 3 }
							];
						},
						exclusive: false
					},
					{
						then: function( model, command ) {
							return [
								{ type: "two.two", id: 4 }
							];
						},
						exclusive: false
					}
				],
				doThree: [
					{
						when: function( model ) {
							return model.canDoThree;
						},
						then: function( model, command ) {
							return [
								{ type: "three.one", id: 5 }
							];
						},
						exclusive: false
					},
					{
						when: function( model ) {
							return model.canDoThree;
						},
						then: function( model, command ) {
							return [
								{ type: "three.two", id: 6 }
							];
						},
						exclusive: false
					}
				]
			},
			events: {
				onOne: [
					{
						when: false,
						then: function( model, event ) {
							model.zero = true;
						},
						exclusive: true
					},
					{
						when: true,
						then: function( model, event ) {
							model.one = true;
						},
						exclusive: true
					},
					{
						when: false,
						then: function( model, event ) {
							model.two = true;
						},
						exclusive: true
					}
				],
				onTwo: [
					{
						when: yep,
						then: function( model, event ) {
							model.applied = model.applied || [];
							model.applied.push( "two.a" );
						},
						exclusive: false
					},
					{
						when: true,
						then: function( model, event ) {
							model.applied = model.applied || [];
							model.applied.push( "two.b" );
						},
						exclusive: false
					}
				],
				onThree: [
					{
						when: function( model ) {
							return model.canApplyThree;
						},
						then: function( model, event ) {
							model.applied.push( "three" );
						}
					}
				]
			}
		}
	};
}

describe( "Apply", function() {
	var models;
	var instance;
	before( function() {
		var metadata = createMetadata();
		return loader( fount, metadata )
			.then( function( list ) {
				models = list;
				instance = models.test.metadata;
			} );
	} );
	describe( "when applying commands", function() {
		describe( "with matching exclusive filter", function() {
			it( "should result in only the first matching handler's event", function() {
				return apply( models, queue, "doOne", {}, instance )
					.should.eventually.partiallyEql( [
						{
							model: {
								id: 1
							},
							events: [
								{
									type: "one.one"
								}
							],
							message: {}
						}
					] );
			} );
		} );

		describe( "with multiple non-exclusive matching filters", function() {
			it( "should result in all matching handlers' events", function() {
				return apply( models, queue, "doTwo", {}, instance )
					.should.eventually.partiallyEql( [
						{
							model: {
								id: 1
							},
							events: [
								{
									type: "two.one"
								}
							],
							message: {}
						},
						{
							model: {
								id: 1
							},
							events: [
								{
									type: "two.two"
								}
							],
							message: {}
						}
					] );
			} );
		} );

		describe( "with no matching filters", function() {
			it( "should not result in any events", function() {
				return apply( models, queue, "doThree", {}, instance )
					.should.eventually.eql( [] );
			} );
		} );
	} );

	describe( "when applying events", function() {
		describe( "with matching exclusive filter", function() {
			before( function() {
				return apply( models, queue, "onOne", {}, instance );
			} );

			it( "should apply the event according to the first matching handler only", function() {
				instance.state.should.not.have.property( "zero" );
				instance.state.should.not.have.property( "two" );
				instance.state.one.should.be.true;
			} );
		} );

		describe( "with multiple non-exclusive matching filters", function() {
			before( function() {
				return apply( models, queue, "onTwo", {}, instance );
			} );

			it( "should apply the event according to the first matching handler only", function() {
				instance.state.applied.should.eql( [ "two.a", "two.b" ] );
			} );
		} );

		describe( "with no matching filters", function() {
			before( function() {
				return apply( models, queue, "onThree", {}, instance );
			} );

			it( "should apply the event according to the first matching handler only", function() {
				instance.state.applied.should.eql( [ "two.a", "two.b" ] );
			} );
		} );
	} );
} );
