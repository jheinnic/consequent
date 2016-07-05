# Consequent
An actor model based, event-sourcing library.

Conequent's goal is to provide a consistent approach to event sourcing while avoiding I/O implementation details (messaging transports and storage). Consequent is very opinionated and works best when models are implemented as modules of pure functions.

#### Please read the [concepts section](#concepts) before getting started.

## Use
Initialization requires two I/O adapters with the opportunity to enhance behavior with several more. The API for each is specified under the [I/O Adapters](#io-adapters) section.

```javascript
var fount = require( "fount" );
var consequentFn = require( "consequent" );

// minimum I/O adapters
// model storage
var models = require( ... );
// event store
var events = require( ... );

var consequent = consequentFn(
	{
		modelStore: models,
		eventStore: events,
		fount: fount
	} );

// message bus
var messages = require( ... );

// additional I/O adapters shown
// coordination provider
var coordinator = require( ... );

// modelCache
var modelCache = require( ... );

// eventCache
var eventCache = require( ... );

// searchProvider
var search = require( ... );

var consequent = consequentFn(
	{
		modelStore: models,
		modelCache: modelCache,
		eventStore: events,
		eventCache: eventCache,
		messageBus: messages,
		coordinator: coordinator,
		search: search,
		modelPath: "./models" // optional path to model modules
	} );
```

## API

### apply( model, events )
Applies a series of events to a model instance. The promise returned will resolve to a new instance of the model that is the result of applying ordered events against the model's initial state or reject with an error.

> Note: If you use this call to apply events from an event stream, keep in mind that it does not protect you from events arriving out of order.

### fetch( modelType, modelId, [ eventSpecifications ] )
Get the model's current state by finding the latests snapshot and applying events since that snapshot was taken. The promise returned will either resolve to the model's latest state or reject with an error.

Optionally, `eventSpecifications` can be supplied such that events from other models' event streams will be included; a common use case when fetching a view model that requires events from multiple domain models.

```js
// example event specifications

// when looking up events by an index defined on the event
[ {
	model: "modelName",
	index: { name: "index_name", value: "index_value" }
} ]

// when looking up events by search criteria
[ {
	model: "modelName",
	where: { // see the find criteria for specifics on how to specify criteria
		property: "value"
	}
} ]
```

### handle( modelId, topic|type, command|event )
Process a command or event and return a promise that resolves to the originating message, the model snapshot and resulting events. The promise will reject if any problems occur while processing the message.

Successful resolution should provide a hash with the following structure:
```javascript
{
	message: {},
	original: {}, // the snapshot (if one existed) of the model before applying the result of the command
	state: {}, // the state that results from applying the events resulting from the command
	events: []
}
```

Rejection will give an error object with the following structure:
```javascript
{
	rejected: true,
	reason: "",
	message: {},
	state: {}
}
```

### find( type, criteria )
Returns a promise for model instances of `type` that match the `criteria` provided if a search adapter has been supplied capable of doing so. If no search adapter exists, then the promise is rejected instead.

### mapEvents( modelType, modelId, events )
Takes events and rewrites them to modelType's event store owned by modelId. The intended use case for this is for view models that need access to a broad range of event streams that would be prohibitively expensive or difficult to acquire at read time via `eventSpecifications`.

## Model
Consequent will load model modules ending with `_model.js` from an `./models` path. This location can be changed during initialization. The model module's function should return a hash with the expected structure which includes the following properties:

 * `model` - metadata and configuration properties
 * `state` - default state hash or a factory to initialize the model instance
 * `commands` - command processors
 * `events` - event processors

Any arguments listed in the model module's exported function will be supplied via `fount`.

### Model fields

#### Required field

 * `type` - provides a name/namespace for the model

#### Optional fields

 * `eventThreshold` - set the number of events that will trigger a new snapshot
 * `storeEventPack` - record events contributing to snapshot as a pack, default is false
 * `snapshotDuringPartition` - sets whether snapshots can be created during partitions, default is false*
 * `snapshotOnRead` - sets whether or not snapshots should be created on reads, default is false for domain models

>* It is the model store's responsibility to determine if this is possible, in most cases, databases don't provide this capability.

### State fields
Consequent will add the following fields to model state:

 * `id`
 * `_vector`
 * `_version`
 * `_ancestor`
 * `_lastEventId`
 * `_lastCommandId`
 * `_lastCommandHandledOn` - ISO8601
 * `_lastEventAppliedOn` - ISO8601

Other than id, none of these fields should _ever_ be manipulated directly.

## Messages (Commands & Events)
Consequent supports two types of immutable messages - commands and events. Commands represent a message that is processed conditionally and results in one or more events as a result. Events represent something that's already taken place and are unconditionally applied to the model's state.

### Caution - events should not result in events or commands
Consequent may replay the same event against a model many times in a system before the resulting model state is captured as a snapshot. There are no built-in mechanisms to identify or eliminate events that result from replaying an event multiple times.

### Definition
The `commands` and `events` properties should be defined as a hash where each key is the message type/topic and the value is a function from an implementation module. 

### Command and Event Handler functions
A command handler returns an array of events or a promise that resolves to one. An event handler mutates the model's state directly based on the event and returns nothing. Command handlers may be asynchronous and result in a promise. Event application _must be synchronous_ and should never rely on outside I/O.

> Note: Event application isn't implemented as strictly _pure_ because Consequent is already constructing a new instance of the model for you to apply the events to. Consequent was built with stateless services in mind, so there should be no ambient state to pollute event application.

_Example_
```javascript
// command handler example
function handleCommand( model, command ) {
	return [ { type: "counterIncremented" } ];
}

// event handler example
function handleCounterIncremented( model, event ) {
	model.counter = model.counter + event.amount;
}
```

#### Examples

__Model Format - State as a hash of defaults__
```javascript

// predicates, command handlers and event handlers should be placed outside the model defintion
// in a module that defines the model using pure functions

module.exports = function() {
	return {
		model: { // defaults shown
			type: "", // required - no default
			eventThreshold: 100,
			snapshotDuringPartition: false,
			snapshotOnRead: false,
		},
		state: {
			// *reserved fields*
			id: "",
			_vector: "",
			_ancestor: "",
			_lastEventId: "",
			// other properties that track state
		},
		commands:
		{
			...
		},
		events:
		{
			...
		}
	}
};
```

__Model Format - State as a factory method__
```javascript

// a factory method is called with an id and can return a state hash or promise for one.
// the promise form is so that state can be initialized by accessing I/O - this is
// especially useful if migrating to this approach from a more traditional data access approach.

module.exports = function() {
	return {
		model: { // defaults shown
			type: "", // required - no default
			eventThreshold: 100,
			snapshotDuringPartition: false,
			snapshotOnRead: false,
		},
		state: function( id ) {
			return {
				// stuff and things
			};
		},
		commands:
		{
			...
		},
		events:
		{
			...
		}
	}
};
```

## Event
Events must specify a dot delimited `type` property where the first part is the name of the model that will "own" the event. In almost every case, this will be the name of the model producing the event. Below is a list of properties that will exist on an event after consequent has received the event:

### Required Properties
```js
{
	type: "model.eventName"
}
```

### Supplied Properties
```js
{
	id: "", // this will be a generated flake id for this event
	_modelType: "", // the type of the model the event was generated for
	_modelId: "modelId", // this is the addressable identity of the owning model
	_createdOn: "", // UTC ISO date time string when event was created
	_createdBy:  "", //
	_createdById:  "", //
	_createdByVector:  "", //
	_createdByVersion: "", //
	_initiatedBy: "", // the command type/topic that triggered the event
	_initiatedById: "", // the id of the message that triggered the event
}
```

### Optional Properties
```js
{
	_modelType: "", // override this to produce an event for another model
	_modelId: "", // override to control the id of the model the event is created for
	_indexBy: { // if indexing by values not already defined on the event
		indexName: "indexValue" // key value to index the event by
	},
	_indexBy: [ // if indexing by event properties
		indexName, // the name of the event property to index by for future lookup
	]
}
```

### Event Indexing
Event indexing exists so that events can be easily included in read models that require event streams from multiple models. This happens frequently in parent-child associations. Indexing the events with the parent id will make it possible to pull in child events 

# Concepts
Here's a breakdown of the primitives involved in this implementation:

## Domain Models vs. View Models
Models can represent either a domain model (an actor that processes commands and produces events), or a view model (a model that only aggregates events produced by domain models). The intent is to represent application behavior and features through domain models and use view models to satisfy read behavior for the application.

This satisfies CQRS at an architectural level in that domain model actors and view models can be hosted in separate processes that use specialized transports/topologies for communication.

## Event Sourced Domain Models Implemented as Actors
This approach borrows from event sourcing, CQRS and CRDT work done by others. It's not original, but perhaps a slightly different take on event sourcing.

### The Importance of Isolation
The expectation in this approach is that the domain models' messages will be processed in isolation at both a machine and process level. Another way to put this is that no two command messages for an actor should be processed at the same time in an environment. Consequent cannot provide this guarantee in the event of a network partition and does provide some mechanisms to help you avoid or detect these situations but it is up to implementing services to understand and handle them.

### Events
An event is generated as a result of an actor processing a comand message. State mutation happens later as a result of applying events against the model.

Each event will have a model id to specify which model produced the event. It will also have an event id, timestamp and initiatedBy field to indicate the command message id and type that triggered the event creation.

Any time a model's latest state is required, events are loaded and ordered by time + event id (as a means to get some approximation of total ordering) and then applied to the model's latest available snapshot to provide a 'best available state'.

### Model Snapshots
An model's snaphsot is identified by a unique id and a vector clock. Instead of mutating and persisting model state after each command message, models generate events. Before processing a command message, a model's last snapshot is loaded from storage, all events since that snapshot was persisted are loaded and applied then applied to the model.

After some threshold of applied events is crossed, the resulting model's state will be persisted with a new vector clock to create a new snapshot. This prevents replaying the same events every time the model is read and from having to read an ever-growing, unbounded list of events in order to determine the model's state over time.

### Divergent Replicas
In the event of a network partition, if commands or events are processed for the same actor on more than one partition, replicas can be created if snapshots are allowed. These replicas will result in multiple copies of the same model with different state. When this happens, multiple snapshots should be retrieved when the next message is processed.

To resolve this divergence, the system will walk the snapshot's ancestors to find the first shared ancestor and apply all events that have occured since that ancestor to produce a new, merged snapshot.

### Ancestors
An ancestor is a previous snapshot identified by the combination of the model id and the vector clock. Ancestors exist primarily to resolve divergent replicas that may occur during a partition.

> Note - some persistence adapaters may include configuration to control what circumstances snapshots (and therefore ancestors) can be created under. Avoiding divergence is preferable but will trade performance for simplicity if partitions are frequent or long-lived.

### Event Packs
Event packs are an optional additional level of safety that can be enabled in order to preserve history and used when resolving divergence. Whenever a new snapshot is created, all events that were applied will be stored as a single record identified by the model's vector and id. Whenever divergent actors are being resolved, event packs will be loaded to provide a deterministic set of events to apply against the common ancestor.

### Vector Clocks
The ideal circumstances should limit the number of nodes that would participate in creation of a snpashot. A small set of nodes participating in mutation of a record should result in a manageable vector clock. In reality, there could be a large number of nodes participating over time. The vector clock library in use allows for pruning these to keep them managable.

> Note - we don't rely on a database to supply these since we're handling detection of divergence and merging.

### k-ordered ids
I just liked saying k-ordered. It just means "use flake". This uses our node library, [sliver](https://npmjs.org/sliver).

## If Only Strong Consistency Will Do
If you want strong consistency guarantees, set your event threshold to 1. A snapshot will get created for every command. You'll need to set up a job to prune snapshots over time, but you'll get consistency.

# I/O Adapters

This section defines the expected behavior and API for each type of I/O adapter. For additional guidance on implementing a particular adapter, please see the [documents folder](.\/tree\/master\/doc).

--

# Storage Adapters
Consequent provides a consistent approach to event sourcing but avoids any direct I/O. This allows any application to use it with any storage technology that an adapter exists for. All adapter calls should return a promise.

Many of the calls are optional and only require that the adapter reject the promise and specify that they do not support tehe feature in their README.

## Event store
Responsibilities:

 * store events
 * retrieve events for an model since an event id
 * store event packs
 * retreive, unpack and merge event packs

### API

#### create( modelType )
Creates an eventStore instance for a specific type of model.

#### findEvents( criteria, lastEventId ) OPTIONAL
Retrieve events based on a set of criteria. When not implementing this call, the event store should resolve this to a rejected promise explaining that this is not or cannot be implemented.

#### getEventsFor( modelId, lastEventId )
Retrieve events for the `modelId` that occurred since the `lastEventId`.

#### getEventsByIndex( indexName, indexValue, lastEventId ) OPTIONAL
Retrieve events based on a previously established index value for the event. When not implementing this call, the event store should resolve this to a rejected promise explaining that this is not or cannot be implemented.

#### getEventPackFor( modelId, vectorClock ) OPTIONAL
Fetch and unpack events that were stored when the snapshot identified by `modelId` and `vectorClock` was created. When not implementing this call, the event store should resolve this to a rejected promise explaining that this is not or cannot be implemented.

#### storeEvents( modelId, events )
Store events for the model.

#### storeEventPack( modelId, vectorClock, events ) OPTIONAL
Pack and store the events for the snapshot identified by `modelId` and `vectorClock`.

## Model store
Responsibilities

 * retrieve the latest model snapshot by id; must provide replicas/siblings
 * store an model's snapshot
 * retrieve ancestors
 * detect ancestor cycles & other anomalies

> Note: everything related to partition tolerance is optional

### API

#### create( modelType )
Creates an model store instance for a specific type of model.

#### fetch( modelId )
Return the latest snapshot for the `modelId`. Must provide replicas/siblings if they exist. By default, all events that belong to modelId since the last snapshot will be included in determining the model's state. 

#### findAncestor( modelId, siblings, ancestry ) OPTIONAL
Search for a common ancestor for the modelId given the siblings list and ancestry. Likely implemented as a recursive call. Must be capable of identifying cycles in snapshot ancestry. Should resolve to nothing or the shared ancestor snapshot.

#### store( modelId, vectorClock, model )
Store the latest snapshot and create ancestor.

# Search Adapter

> ! Experimental ! - this API is highly experimental and subject to changes.

The goal behind this adapter is to provide a search abstraction that various storage implementations can implement. Please keep in mind that a search executed against snapshots will only be as accurate as the latest snapshots and not include changes from events that have not been persistd to a snapshot yet.

## API

### find( criteria )
Criteria is an array with one or more element where each element is a set of criteria which must be true. Each individual element in the array should effectively be OR'd together.

Specific operations are represented as unique key/value sets. Any adapter implementing this API should throw exceptions for any unsupported operations.

### operations

#### equal

```js
{
	x: 100
}
```

#### contains

```js
{
	x: { contains: 100 }
}
```

#### matching / like

```js
{
	x: { match: "pattern" }
}
```

#### in

```js
{
	x: { in: [ 100, 101, 102 ] }
}
```

#### not in

```js
{
	x: { not: [ 100, 101, 102 ] }
}
```

#### greater than

```js
{
	x: { gt: 100 }
}
```

#### less than

```js
{
	x: { lt: 100 }
}
```

#### greater than or equal to

```js
{
	x: { gte: 100 }
}
```

#### less than or equal to

```js
{
	x: { lte: 100 }
}
```

#### between

```js
{
	x: [ lower, upper ]
}
```

# Caching Adapters
While there may not always be a sensible way to implement all the same features in a caching adapter, a valid caching adapter should provide a consistent API even if certain calls are effectively a no-op. Consequent uses read-through/write-through such that cache misses should not have any impact on functionality.

Without detailed analysis, the simplest approach to cache invalidation is to set TTLs on snapshots and eventpacks since these cannot change but should become irrelevant over time.

## Event cache
Responsibilities:

 * store recent events
 * flush/remove events once applied to a snapshot
 * store recent eventpacks (OPTIONAL)
 * retrieve, unpack and merge event packs (OPTIONAL)

### API
> Note - the API is presently identical to the event store but implementation may choose to opt-out of features by returning a promise that resolves to undefined to cause Consequent to call through to the storage layer.

#### create( modelType )
Creates an eventCache instance for a specific type of model.

#### getEventsFor( modelId, lastEventId )
Retrieve events for the `modelId` that occurred since the `lastEventId`.

#### getEventPackFor( modelId, vectorClock )
Fetch and unpack events that were stored when the snapshot identified by `modelId` and `vectorClock` was created.

#### storeEvents( modelId, events )
Store events for the model.

#### storeEventPack( modelId, vectorClock, events )
Pack and store the events for the snapshot identified by `modelId` and `vectorClock`.

## Model cache
Responsibilities:

 * keep most recent model/snapshot in cache
 * retrieve an model by id
 * cache recent replicas/siblings
 * cache recent snapshots

### API
> Note - the API is presently identical to the event store but implementation may choose to opt-out of features by returning a promise that resolves to undefined to cause Consequent to call through to the storage layer.

#### create( modelType )
Creates an model cache instance for a specific type of model.

#### fetch( modelId )
Return the latest snapshot for the `modelId`. Must provide replicas/siblings if they exist.

#### findAncestor( modelId, siblings, ancestry )
Search for a common ancestor for the modelId given the siblings list and ancestry. Likely implemented as a recursive call. Must be capable of identifying cycles in snapshot ancestry. Should resolve to nothing or the shared ancestor snapshot.

#### store( modelId, vectorClock, model )
Store the latest snapshot and create ancestor.

# Coordination Adapter
Consequent can opt into using an external coordination service to provide guarantees around distributed mutual exclusion.

The expectation is that a lock will be acquired by a service using consequent and held during the lifecycle of the service. This assumes that commands and events will be routed via some form of consistent hashing. This is important as it avoids system-wide log-jams behind acquisition of a lock for ids that are seeing a lot of activity.

### API
Calls should return promises.

#### acquire( id, [timeout] )
Acquires a lock for an id. When in use, Consequent will not attempt to process a command or event until after the lock has been acquired.

#### release( id )
Release the lock to a specific id.

# Message Adapter
The message adapters job is to plug a potential stream of incoming commands and events into Consequent's models while also providing a means to publish events that result from processing commands.

The message adapter should handle all transport related concerns.

Responsibilites:

 * Manage connectivity to the transport
 * Serialization/Deserialization of messages
 * Routing, subscriptions and other transport implementations
 * Delivery of commands and events to Consequent
 * Publishing events that result from processing commands

### API
Calls should return promises.

#### onMessages( consequent.handle )
Wires consequent's `handle` method into the transport abstraction. This should handle both incoming and outgoing data as the `handle` method returns all events that result from processing incoming messages.

## Dependencies

 * sliver
 * pvclock
 * postal
 * monologue
 * machina
 * lodash
 * when
