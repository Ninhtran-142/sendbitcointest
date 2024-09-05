const {sendBitcoin,sendBitcoinP2TR} = require("./sendbitcoin");
const createWallet = require("./wallet");
const { tapScriptTrans } = require("./tapScriptTrans");
/*
console.log("Create wallet: ");
const wallet = createWallet();
console.log("Mnemonic: ", wallet.mnemonic);

const address = wallet.deriveNewAddress(0);
console.log('Address P2PKH:', address.P2PKH);
console.log('Address P2WPKH:', address.P2WPKH);
console.log('Address P2SH_P2WPKH:', address.P2SH_P2WPKH);
console.log('Address P2TR:', address.P2TR);
console.log('Private Key:', address.privateKey);
console.log('Public Key:', address.publicKey);
console.log('Path:', address.path);
*/

tapScriptTrans("tb1pp8qxs6wwxcp4r8k0j3amdcnhslv7ka3lrnxtjkjd2n7se3p4vs0sdkf3hx", 0.0001, 'hashlock')
  .then((result) => {
    console.log(result);
  })
  .catch((error) => {
    console.log(error);
  });
  /*
sendBitcoinP2TR(address.P2TR,0.0001)
  .then((result) => {
    console.log(result);
  })
  .catch((error) => {
    console.log(error);
  });
/*
sendBitcoin("tb1pu2vvxaxpmvx6pnce94pm82k0zrf37mmz7tycx3edw04pdu3m2w2q37xsek", 0.0001)
  .then((result) => {
    console.log(result);
  })
  .catch((error) => {
    console.log(error);
  });
 */