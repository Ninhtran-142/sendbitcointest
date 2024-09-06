const axios = require('axios');
const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require('ecpair');
const ecc = require('tiny-secp256k1');

const network = bitcoin.networks.testnet;

const sendBitcoin = async (receiverAddress, amountToSend) => {
  try {
    const privateKey = 'cTETFRAHCRLXQeTD7s3jcjDjEW5wTqY79CNUT5LjyH3BiBDNjoo8';
    const sourceAddress = 'tb1qnxewnafnk8me0fgxazhsgxluskcyspqeqdlv80';
    const satoshiToSend = amountToSend * 100000000;

    const ECPair = ECPairFactory.ECPairFactory(ecc);
    const keyPair = ECPair.fromWIF(privateKey, network);
    //đọc utxo 
    const utxosResponse = await axios.get(`https://mempool.space/testnet/api/address/${sourceAddress}/utxo`);
    const utxos = utxosResponse.data;
    utxos.sort((a, b) => b.value - a.value);
    console.log(utxos);
    

    const psbt = new bitcoin.Psbt({ network });//build transaction 
    const psbt1 = new bitcoin.Psbt({ network });
    const feeRateResponse = await axios.get('https://mempool.space/testnet/api/v1/fees/recommended');
    const feeRate = feeRateResponse.data.hourFee; // satoshis per byte
    let totalAmountAvailable = 0;
    let inputCount = 0;
    //input 
    for (const utxo of utxos) {
      if((inputCount*180 + 2*34 + 10)*feeRate + satoshiToSend >  totalAmountAvailable){
        const hexRespone = await axios.get(`https://mempool.space/testnet/api/tx/${utxo.txid}/hex`);
        transHex = hexRespone.data;
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          nonWitnessUtxo: Buffer.from(transHex, 'hex')
        });
        
        psbt1.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          nonWitnessUtxo: Buffer.from(transHex, 'hex')
        });
      inputCount += 1;
      totalAmountAvailable += utxo.value;
    }
  }
    //output
    psbt.addOutput({
      address: receiverAddress,
      value: satoshiToSend,
      });
    psbt1.addOutput({
      address: receiverAddress,
      value: satoshiToSend,
    })
    //tinh phi giao dich 
    
    const tx = psbt.__CACHE.__TX;
    const estimatedSize = tx.virtualSize();
    console.log(estimatedSize);
    
    const fee = estimatedSize * feeRate;

    if (totalAmountAvailable < satoshiToSend + fee) {
      throw new Error('Balance is too low for this transaction');//
    }

    const change = totalAmountAvailable - satoshiToSend - fee;//so tien thua se tao 1 output tra lai vi
    if (change > 0) {
      psbt.addOutput({
        address: sourceAddress,
        value: change,
      });
    }

    psbt.signAllInputs(keyPair);//ky giao dich
    psbt.finalizeAllInputs();
    
    const size = psbt.extractTransaction().virtualSize();
    console.log("Size: ",size);
    const fee1 = size * feeRate;
    const change1 = totalAmountAvailable - satoshiToSend - fee1;
    if(change1 > 0){
      psbt1.addOutput({
        address: sourceAddress,
        value: change1,
      });
    }
    psbt1.signAllInputs(keyPair);//ky giao dich
    psbt1.finalizeAllInputs();
    const txHex = psbt1.extractTransaction().toHex();
    console.log(txHex);
    const result = await axios.post(`https://mempool.space/testnet/api/tx`, txHex);
    return result.data;
  } catch (error) {
    return error;
  }
};
const sendBitcoinP2TR = async (receiverAddress,amountToSend) => {
  try {
    const privateKey = 'cV4RGKzYgq93hsxLE24Dz5c6FnDwDsF6nJdAw9QfjqgLjjMq3yus';
    const sourceAddress = 'tb1pu2vvxaxpmvx6pnce94pm82k0zrf37mmz7tycx3edw04pdu3m2w2q37xsek';
    const satoshiToSend = amountToSend * 100000000;

    function toXOnly(pubkey) {
      return pubkey.slice(1, 33);
    }

    const ECPair = ECPairFactory.ECPairFactory(ecc);
    const keyPair = ECPair.fromWIF(privateKey, network);
    
    function tweakSigner(keypair, { network }) {
      const privateKey = keypair.privateKey; // Lấy private key
      const publicKey = toXOnly(keypair.publicKey); // Lấy x-only public key
      const tweak = bitcoin.crypto.taggedHash('TapTweak', publicKey); // Tạo tweak
      const tweakedPrivKey =Buffer.from(ecc.privateAdd(privateKey, tweak)); // Tweak private key
      return ECPair.fromPrivateKey(tweakedPrivKey, { network }); // Tạo tweaked signer
    }

    const tweakedSigner = tweakSigner(keyPair, { network });
    const tweakedPubKey = toXOnly(tweakedSigner.publicKey);
    const script_p2tr = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(keyPair.publicKey),
      network,
    });

    //đọc utxo 
    const utxosResponse = await axios.get(`https://mempool.space/testnet/api/address/${sourceAddress}/utxo`);
    const utxos = utxosResponse.data;
    utxos.sort((a, b) => b.value - a.value);
    console.log(utxos);

    const psbt = new bitcoin.Psbt({ network });//build transaction 
    const psbt1 = new bitcoin.Psbt({ network });
    const feeRateResponse = await axios.get('https://mempool.space/testnet/api/v1/fees/recommended');
    const feeRate = feeRateResponse.data.hourFee; // satoshis per byte
    let totalAmountAvailable = 0;
    let inputCount = 0;

    //input 
    for (const utxo of utxos) {
      if((inputCount*58 + 2*43 + 11)*feeRate + satoshiToSend > totalAmountAvailable){
        const hexRespone = await axios.get(`https://mempool.space/testnet/api/tx/${utxo.txid}/hex`);
        transHex = hexRespone.data;
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: script_p2tr.output,
            value: utxo.value,
          },
          tapInternalKey: tweakedPubKey,
        });
        
        psbt1.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: script_p2tr.output,
            value: utxo.value,
          },
          tapInternalKey: tweakedPubKey,
        });
      inputCount += 1;
      totalAmountAvailable += utxo.value;
    }
  }
  psbt.addOutput({
    address: receiverAddress,
    value: satoshiToSend,
    });
  psbt1.addOutput({
    address: receiverAddress,
    value: satoshiToSend,
  })
  
  const tx = psbt.__CACHE.__TX;
    const estimatedSize = tx.virtualSize();
    console.log(estimatedSize);
    
    const fee = estimatedSize * feeRate;

    if (totalAmountAvailable < satoshiToSend + fee) {
      throw new Error('Balance is too low for this transaction');//
    }

    const change = totalAmountAvailable - satoshiToSend - fee;//so tien thua se tao 1 output tra lai vi
    if (change > 0) {
      psbt.addOutput({
        address: sourceAddress,
        value: change,
      });
    }

    psbt.signAllInputs(tweakedSigner);//ky giao dich
    psbt.finalizeAllInputs();
    
    const size = psbt.extractTransaction().virtualSize();
    console.log("Size: ",size);
    const fee1 = size * feeRate;
    const change1 = totalAmountAvailable - satoshiToSend - fee1;//so tien thua se tao 1 output tra lai vi
    if(change1 > 0){
      psbt1.addOutput({
        address: sourceAddress,
        value: change1,
      });
    }
    psbt1.signAllInputs(tweakedSigner);//ky giao dich
    psbt1.finalizeAllInputs();
    const txHex = psbt1.extractTransaction().toHex();
    console.log(txHex);
    const result = await axios.post(`https://mempool.space/testnet/api/tx`, txHex);
    return result.data;

  } catch (error) {
   return error 
  }
}
module.exports = {
  sendBitcoin,
  sendBitcoinP2TR,
}