
// COMMAND HANDLERS
function close() {
	return {
		type: "account.closed"
	};
}

function deposit( account, amount ) {
	return {
		type: "account.deposited",
		amount: amount
	};
}

function open( account, accountHolder, accountNumber, initialDeposit ) {
	if( !isOpen(account ) ) {
		return [
			{
				type: "account.opened",
				accountHolder: accountHolder,
				accountNumber: accountNumber
			},
			{
				type: "account.deposited",
				initial: true,
				amount: initialDeposit
			}
		];
	} else {
		return [];
	}
}

function withdraw( account, amount ) {
	if( canWithdraw( account, amount ) ) {
		return [ {
			type: "account.withdrawn",
			amount: amount
		} ];
	} else if( account.open ) {
		return {
			type: "account.insufficientFunds",
			amount: amount
		}
	} else {
		return {
			type: "account.unavailableFunds",
			open: false
		}
	}
}

// PREDICATES
function canWithdraw( account, amount ) {
	return account.open &&
		account.balance >= amount;
}

function isOpen( account ) {
	return account.open;
}

// EVENT APPLICATION
function onOpen( account, accountHolder, accountNumber ) {
	account.holder = accountHolder;
	account.number = accountNumber;
	account.open = true;
}

function onClose( account ) {
	account.transactions.push( { credit: 0, debit: account.balance } );
	account.balance = 0;
	account.open = false;
}

function onDeposit( account, amount ) {
	account.balance += amount;
	account.transactions.push( { credit: amount, debit: 0 } );
}

function onWithdraw( account, amount ) {
	account.balance -= amount;
	account.transactions.push( { credit: 0, debit: amount } );
}

module.exports = {
	// predicates
	canWithdraw: canWithdraw,
	isOpen: isOpen,

	// commands
	close: close,
	deposit: deposit,
	open: open,
	withdraw: withdraw,

	// events
	closed: onClose,
	deposited: onDeposit,
	opened: onOpen,
	withdrawn: onWithdraw
};
