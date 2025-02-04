const algosdk = require("algosdk");
const baseServer = "https://testnet-algorand.api.purestake.io/ps2";
const port = "";
const token = {
  "X-API-Key": "", //Your APi key here
};
const algoClient = new algosdk.Algodv2(token, baseServer, port);

const keypress = async () => {
  process.stdin.setRawMode(true);
  return new Promise((resolve) =>
    process.stdin.once("data", () => {
      process.stdin.setRawMode(false);
      resolve();
    })
  );
};
const waitForConfirmation = async (algodClient, txId, timeout) => {
  if (algodClient == null || txId == null || timeout < 0) {
    throw new Error("Bad arguments");
  }

  const status = await algodClient.status().do();
  if (status === undefined) {
    throw new Error("Unable to get node status");
  }

  const startround = status["last-round"] + 1;
  let currentround = startround;

  while (currentround < startround + timeout) {
    const pendingInfo = await algodClient
      .pendingTransactionInformation(txId)
      .do();
    if (pendingInfo !== undefined) {
      if (
        pendingInfo["confirmed-round"] !== null &&
        pendingInfo["confirmed-round"] > 0
      ) {
        //Got the completed Transaction
        return pendingInfo;
      } else {
        if (
          pendingInfo["pool-error"] != null &&
          pendingInfo["pool-error"].length > 0
        ) {
          // If there was a pool error, then the transaction has been rejected!
          throw new Error(
            "Transaction " +
              txId +
              " rejected - pool error: " +
              pendingInfo["pool-error"]
          );
        }
      }
    }
    await algodClient.statusAfterBlock(currentround).do();
    currentround++;
  }
  throw new Error(
    "Transaction " + txId + " not confirmed after " + timeout + " rounds!"
  );
};
const atomicTf = async () => {
  try {
    let mrA = algosdk.generateAccount();
    let mrB = algosdk.generateAccount();
    let mrC = algosdk.generateAccount();
    let mnemonicMrA = algosdk.secretKeyToMnemonic(mrA.sk);
    let mnemonicMrB = algosdk.secretKeyToMnemonic(mrB.sk);
    let mnemonicMrC = algosdk.secretKeyToMnemonic(mrC.sk);
    console.log(mrA.addr, mrB.addr, mrC.addr);
    console.log(mnemonicMrA, mnemonicMrB, mnemonicMrC);
    await keypress();
    let params = await algoClient.getTransactionParams().do();
    // Transaction A to C
    let transaction1 = algosdk.makePaymentTxnWithSuggestedParams(
      mrA.addr,
      mrB.addr,
      100000,
      undefined,
      undefined,
      params
    );
    // Create transaction B to A
    let transaction2 = algosdk.makePaymentTxnWithSuggestedParams(
      mrB.addr,
      mrA.addr,
      100000,
      undefined,
      undefined,
      params
    );
    // Combine transactions
    let txns = [transaction1, transaction2];
    // Sign each transaction in the group

    let txGroup = algosdk.assignGroupID(txns);
    let signedTx1 = transaction1.signTxn(mrA.sk);
    let signedTx2 = transaction2.signTxn(mrB.sk);
    let signed = [];
    signed.push(signedTx1);
    signed.push(signedTx2);
    let tx = await algoClient.sendRawTransaction(signed).do();
    console.log("Transaction : " + tx.txId);

    // Wait for transaction to be confirmed
    await waitForConfirmation(algoClient, tx.txId, 10);
  } catch (error) {
    console.log(error);
  }
};

atomicTf();
