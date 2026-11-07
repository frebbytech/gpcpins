/** What to call an account in the UI: its name, else its number, else "Account N". */
export function accountName(account, index) {
  if (account?.label) return account.label;
  if (account?.phoneNumber) return `+${account.phoneNumber}`;
  return `Account ${index + 1}`;
}

export function findAccount(accounts, id) {
  const index = accounts.findIndex((a) => a.sessionId === id);
  return { account: index >= 0 ? accounts[index] : undefined, index };
}
