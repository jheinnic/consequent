require( "../setup" );
var loader = require( "../../src/loader" );
var fount = require( "fount" );

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

var modelAdapter = {
	fetch: _.noop,
	findAncestor: _.noop,
	store: _.noop
};

var eventAdapter = {
	fetch: _.noop,
	storePack: _.noop
};

var applySpy = sinon.spy( function( a, q, t, e, x ) {
	x.applied = x.applied || [];
	x.applied.push( e );
	return when();
} );

var managerFn = proxyquire( "../src/manager", {
	"./apply": applySpy
} );

describe( "Manager", function() {
	var models;
	before( function() {
		return loader( fount, "./spec/models" )
			.then( function( list ) {
				models = list;
			} );
	} );
	describe( "when model fetch fails", function() {
		var modelMock, manager;
		before( function() {
			modelMock = sinon.mock( modelAdapter );
			modelMock.expects( "fetch" )
				.withArgs( "account", 100 )
				.rejects( new Error( "Nope sauce" ) );
			manager = managerFn( models, modelAdapter, eventAdapter, mockQueue() );
		} );

		it( "should reject with an error", function() {
			return manager.getOrCreate( "account", 100 )
				.should.be.rejectedWith( "Nope sauce" );
		} );

		it( "should call fetch on model adapter", function() {
			modelMock.verify();
		} );
	} );

	describe( "when single model instance exists", function() {
		var modelMock, eventMock, manager, model, state, events;
		before( function() {
			state = {
				lastEventId: 1,
				id: 100
			};
			model = {
				type: "account"
			};
			events = [ { id: 2 }, { id: 3 } ];
			var instance = {
				model: model,
				state: state
			};
			modelMock = sinon.mock( modelAdapter );
			modelMock.expects( "fetch" )
				.withArgs( "account", 100 )
				.resolves( instance );
			modelMock.expects( "store" ).never();
			eventMock = sinon.mock( eventAdapter );
			eventMock.expects( "fetch" )
				.withArgs( "account", 100, 1 )
				.resolves( events );
			eventMock.expects( "storePack" ).never();

			manager = managerFn( models, modelAdapter, eventAdapter, mockQueue() );
		} );

		it( "should result in updated model", function() {
			return manager.getOrCreate( "account", 100 )
				.should.eventually.eql( {
					state: state,
					model: model,
					applied: events
				} );
		} );

		it( "should call fetch on model adapter", function() {
			modelMock.verify();
		} );

		it( "should call fetch on event adapter", function() {
			eventMock.verify();
		} );
	} );

	describe( "when multiple model instances exist", function() {
		var modelMock, eventMock, manager, instances, model, state, events;
		before( function() {
			model = { type: "account" };
			instances = [
				{
					model: model,
					state: {
						lastEventId: 4,
						id: 100
					}
				},
				{
					model: model,
					state: {
						lastEventId: 5,
						id: 100
					}
				}
			];
			state = {
				lastEventId: 1,
				id: 100
			};
			events = [ { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 } ];
			var instance = {
				model: model,
				state: state
			};
			modelMock = sinon.mock( modelAdapter );
			modelMock.expects( "fetch" )
				.withArgs( "account", 100 )
				.resolves( instances );
			modelMock.expects( "findAncestor" )
				.withArgs( 100, instances, [] )
				.resolves( instance );
			modelMock.expects( "store" ).never();
			eventMock = sinon.mock( eventAdapter );
			eventMock.expects( "fetch" )
				.withArgs( "account", 100, 1 )
				.resolves( events );
			eventMock.expects( "storePack" ).never();

			manager = managerFn( models, modelAdapter, eventAdapter, mockQueue() );
		} );

		it( "should result in updated model", function() {
			return manager.getOrCreate( "account", 100 )
				.should.eventually.eql( {
					model: model,
					state: state,
					applied: events
				} );
		} );

		it( "should call fetch on model adapter", function() {
			modelMock.verify();
		} );

		it( "should call fetch on event adapter", function() {
			eventMock.verify();
		} );
	} );

	describe( "when event threshold is exceeded", function() {
		describe( "in normal mode", function() {
			var modelMock, eventMock, manager, model, state, events;
			before( function() {
				model = {
					type: "account",
					eventThreshold: 2,
					storeEventPack: true
				};
				state = {
					lastEventId: 1,
					id: 100
				};
				events = [ { id: 2 }, { id: 3 } ];
				var instance = {
					model: model,
					state: state
				};
				modelMock = sinon.mock( modelAdapter );
				modelMock.expects( "fetch" )
					.withArgs( "account", 100 )
					.resolves( instance );
				modelMock.expects( "store" )
					.withArgs( instance )
					.once()
					.resolves( {} );
				eventMock = sinon.mock( eventAdapter );
				eventMock.expects( "fetch" )
					.withArgs( "account", 100, 1 )
					.resolves( events );
				eventMock.expects( "storePack" )
					.withArgs( "account", state.id, undefined, 1, events )
					.once()
					.resolves();

				manager = managerFn( models, modelAdapter, eventAdapter, mockQueue() );
			} );

			it( "should result in updated model", function() {
				return manager.getOrCreate( "account", 100 )
					.should.eventually.eql( {
						model: model,
						state: state,
						applied: events
					} );
			} );

			it( "should call fetch on model adapter", function() {
				modelMock.verify();
			} );

			it( "should call fetch on event adapter", function() {
				eventMock.verify();
			} );
		} );

		describe( "in readOnly without snapshotOnRead", function() {
			var modelMock, eventMock, manager, model, state, events;
			before( function() {
				model = {
					type: "account",
					eventThreshold: 2,
					storeEventPack: true
				};
				state = {
					lastEventId: 1,
					id: 100
				};
				events = [ { id: 2 }, { id: 3 } ];
				var instance = {
					model: model,
					state: state
				};
				modelMock = sinon.mock( modelAdapter );
				modelMock.expects( "fetch" )
					.withArgs( "account", 100 )
					.resolves( instance );
				modelMock.expects( "store" ).never();
				eventMock = sinon.mock( eventAdapter );
				eventMock.expects( "fetch" )
					.withArgs( "account", 100, 1 )
					.resolves( events );
				eventMock.expects( "storePack" ).never();

				manager = managerFn( models, modelAdapter, eventAdapter, mockQueue() );
			} );

			it( "should result in updated model", function() {
				return manager.getOrCreate( "account", 100, [], true )
					.should.eventually.eql( {
						model: model,
						state: state,
						applied: events
					} );
			} );

			it( "should call fetch on model adapter", function() {
				modelMock.verify();
			} );

			it( "should call fetch on event adapter", function() {
				eventMock.verify();
			} );
		} );

		describe( "in readOnly with snapshotOnRead", function() {
			var modelMock, eventMock, manager, model, state, events;
			before( function() {
				model = {
					type: "account",
					eventThreshold: 2,
					storeEventPack: true,
					snapshotOnRead: true
				};
				state = {
					lastEventId: 1,
					id: 100
				};
				events = [ { id: 2 }, { id: 3 } ];
				var instance = {
					model: model,
					state: state
				};
				modelMock = sinon.mock( modelAdapter );
				modelMock.expects( "fetch" )
					.withArgs( "account", 100 )
					.resolves( instance );
				modelMock.expects( "store" )
					.withArgs( instance )
					.once()
					.resolves( {} );
				eventMock = sinon.mock( eventAdapter );
				eventMock.expects( "fetch" )
					.withArgs( "account", 100, 1 )
					.resolves( events );
				eventMock.expects( "storePack" )
					.withArgs( "account", state.id, undefined, 1, events )
					.once()
					.resolves();

				manager = managerFn( models, modelAdapter, eventAdapter, mockQueue() );
			} );

			it( "should result in updated model", function() {
				return manager.getOrCreate( "account", 100, true )
					.should.eventually.eql( {
						model: model,
						state: state,
						applied: events
					} );
			} );

			it( "should call fetch on model adapter", function() {
				modelMock.verify();
			} );

			it( "should call fetch on event adapter", function() {
				eventMock.verify();
			} );
		} );
	} );
} );
