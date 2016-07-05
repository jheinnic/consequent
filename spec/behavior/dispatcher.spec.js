require( "../setup" );
var dispatcherFn = require( "../../src/dispatch" );
var loader = require( "../../src/loader" );
var fount = require( "fount" );
var sliver = require( "sliver" )();

function mockQueue( id, fn ) {
	var queue = { add: function() {} };
	var mock = sinon.mock( queue );
	if ( id ) {
		mock
			.expects( "add" )
			.once()
			.withArgs( id, sinon.match.func )
			.resolves( fn() );
	} else {
		mock
			.expects( "add" )
			.never();
	}
	queue.restore = mock.restore;
	return queue;
}

function mockManager( type, id, result, calls ) {
	var manager = { 
		getOrCreate: _.noop,
		snapshot: _.noop,
		storeEvents: _.noop
	};
	var mock = sinon.mock( manager );
	if ( type ) {
		var getExpectation = mock
			.expects( "getOrCreate" )
			.exactly( calls || 1 )
			.withArgs( type, id );
		if ( result.name ) {
			getExpectation.rejects( result );
		} else {
			getExpectation.resolves( result );
		}

		var snapshotExpectation = mock
			.expects( "snapshot" )
			.exactly( calls || 1 )
			.resolves( result );
	} else {
		mock
			.expects( "getOrCreate" )
			.never();
	}
	manager.restore = mock.restore;
	return manager;
}

describe( "Dispatch", function() {
	describe( "when dispatching unmatched topic", function() {
		var queue, lookup, manager, dispatcher;

		before( function() {
			queue = mockQueue();
			manager = mockManager();
			lookup = {};
			dispatcher = dispatcherFn( sliver, lookup, manager, {}, queue );
		} );

		it( "should not queue a task", function() {
			return dispatcher.handle( "badid", "nomatch", {} )
				.should.eventually.eql( [] );
		} );

		after( function() {
			queue.restore();
			manager.restore();
		} );
	} );

	describe( "dispatching with manager error", function() {
		var queue, lookup, manager, dispatcher;

		before( function() {
			var models = {
				test: {
					metadata: {
						model: {
							type: "test"
						},
						commands: {
							doAThing: [ [] ]
						}
					}
				}
			};
			queue = mockQueue();
			manager = mockManager( "test", 100, new Error( ":(" ) );
			lookup = { doAThing: [ "test" ] };
			dispatcher = dispatcherFn( sliver, lookup, manager, models, queue );
		} );

		it( "should not queue a task", function() {
			return dispatcher.handle( 100, "doAThing", {} )
				.should.be.rejectedWith( "Failed to instantiate model \'test\'" );
		} );

		after( function() {
			queue.restore();
			manager.restore();
		} );
	} );

	describe( "dispatching to existing model", function() {
		var queue, lookup, manager, dispatcher, models, instance, command, event;

		before( function() {
			var metadata = {
				test: {
					model: {
						type: "test"
					},
					state: {

					},
					commands: {
						doAThing: [
							[
								function( model ) {
									return model.canDo;
								},
								function( model, thing ) {
									return [ { type: "test.thingDid", degree: thing.howMuch } ];
								}
							]
						]
					},
					events: {
						thingDid: [
							[ true, function( model, did ) {
								model.doneDidfulness = did.degree;
							} ]
						]
					}
				}
			};
			queue = {
				add: function( id, fn ) {
					return when.resolve( fn() );
				}
			};

			return loader( fount, metadata )
				.then( function( list ) {
					models = list;
					instance = _.cloneDeep( models.test.metadata );
					instance.state = { id: 100, canDo: true };
					command = { type: "doAThing", howMuch: "totes mcgoats" };
					event = { type: "thindDid", degree: "totes mcgoats" };
					manager = mockManager( "test", 100, instance, 2 );

					lookup = {
						doAThing: [ "test" ],
						thingDid: [ "test" ]
					};
					dispatcher = dispatcherFn( sliver, lookup, manager, models, queue );
				} );
		} );

		it( "should queue the command successfully", function() {
			return dispatcher.handle( 100, "doAThing", command )
				.should.eventually.partiallyEql(
					[
						{
							state: _.omit( instance.state, "lastCommandId", "lastCommandHandledOn" ),
							events: [
								{
									_modelType: "test",
									_modelId: 100,
									_commandType: "doAThing",
									type: "test.thingDid",
									degree: "totes mcgoats"
								}
							],
							message: command
						}
					]
				);
		} );

		it( "should queue the event successfully", function() {
			return dispatcher.handle( 100, "thingDid", event )
				.should.eventually.resolve;
		} );

		it( "should mutate model state", function() {
			instance.state.doneDidfulness.should.eql( "totes mcgoats" );
		} );

		after( function() {
			manager.restore();
		} );
	} );
} );
