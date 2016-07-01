var account = require( "./account" );

module.exports = function() {
	return {
		// enable the ability to provide function to produce/fetch initial state
		// split "config" concerns out of model property
		model: { // metadata and configuration not persisted
			namespace: "ledger",
			type: "account",
			eventThreshold: 5
		},
		state: { // initial stat for the model
			number: "",
			holder: "",
			balance: 0,
			open: false,
			transactions: []
		},
		commands: {
			open: account.open,
			close: account.close,
			deposit: account.deposit,
			withdraw: account.withdraw
		},
		events: {
			opened: account.opened,
			closed: account.closed,
			deposited: account.deposited,
			withdrawn: account.withdrawn
		}
	};
};
