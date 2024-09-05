const axios = require('axios');
const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require('ecpair');
const ecc = require('tiny-secp256k1');
const { witnessStackToScriptWitness } =require("bitcoinjs-lib/src/psbt/psbtutils")

const network = bitcoin.networks.testnet;

function toXOnly(pubkey) {
    return pubkey.slice(1, 33);
    }

const tapScriptTrans = async (receiverAddress, amountToSend, spendMethod) =>{
    try {
        const privateKey = 'cV4RGKzYgq93hsxLE24Dz5c6FnDwDsF6nJdAw9QfjqgLjjMq3yus';
        const sourceAddress = 'tb1pu2vvxaxpmvx6pnce94pm82k0zrf37mmz7tycx3edw04pdu3m2w2q37xsek';
        const satoshiToSend = amountToSend * 100000000;

        const ECPair = ECPairFactory.ECPairFactory(ecc);
        const keyPair = ECPair.fromWIF(privateKey, network);

        const hash_lock_keypair = ECPair.makeRandom({ network });

        const secret_bytes = Buffer.from('SECRET');
        const hash = bitcoin.crypto.hash160(secret_bytes);

        const hash_script_asm = `OP_HASH160 ${hash.toString('hex')} OP_EQUALVERIFY ${toXOnly(hash_lock_keypair.publicKey).toString('hex')} OP_CHECKSIG`;
        const hash_lock_script = bitcoin.script.fromASM(hash_script_asm);

        const p2pk_script_asm = `${toXOnly(keyPair.publicKey).toString('hex')} OP_CHECKSIG`;
        const p2pk_script = bitcoin.script.fromASM(p2pk_script_asm);

        const scriptTree = [
            { output: hash_lock_script },
            { output: p2pk_script }
        ];
        let psbt;
        if (spendMethod === 'hashlock') {
            psbt = await spendWithHashLock(receiverAddress,sourceAddress,satoshiToSend,keyPair, hash_lock_keypair, secret_bytes, scriptTree,hash_lock_script);
        } else if (spendMethod === 'p2pk') {
            psbt = await spendWithP2PK(receiverAddress,sourceAddress,satoshiToSend,keyPair,scriptTree,p2pk_script);
        } else {
            throw new Error('Invalid spend method');
        }

        const txHex = psbt.extractTransaction().toHex();
        console.log(txHex);
        const result = await axios.post(`https://mempool.space/testnet/api/tx`, txHex);
        return result.data;
    } catch (error) {
        console.log(error);
    }
}
module.exports = {
    tapScriptTrans
  }
async function spendWithP2PK(receiverAddress,sourceAddress,satoshiToSend,keyPair,scriptTree,p2pk_script) {
    const p2pk_redeem = {
        output: p2pk_script,
        redeemVersion: 192
    }

    const p2pk_p2tr = payments.p2tr({
        internalPubkey: toXOnly(keyPair.publicKey),
        scriptTree,
        redeem: p2pk_redeem,
        network
    });
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
      if((inputCount*58 + 2*43 + 11)*feeRate + totalAmountAvailable < satoshiToSend){
        const hexRespone = await axios.get(`https://mempool.space/testnet/api/tx/${utxo.txid}/hex`);
        transHex = hexRespone.data;
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: p2pk_p2tr.output,
            value: utxo.value,
          },
          tapLeafScript: [{
            leafVersion: p2pk_redeem.redeemVersion,
            script: p2pk_redeem.output,
            controlBlock: p2pk_p2tr.witness[p2pk_p2tr.witness.length - 1]
        }]
        });
        
        psbt1.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: p2pk_p2tr.output,
            value: utxo.value,
          },
          tapLeafScript: [{
            leafVersion: p2pk_redeem.redeemVersion,
            script: p2pk_redeem.output,
            controlBlock: p2pk_p2tr.witness[p2pk_p2tr.witness.length - 1]
        }]
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
    await psbt.signAllInputsAsync(keyPair);
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
    await psbt1.signAllInputsAsync(keyPair);
    psbt1.finalizeAllInputs();
    return psbt1;
}
async function spendWithHashLock(receiverAddress,sourceAddress,satoshiToSend,keyPair, hash_lock_keypair, secret_bytes, scriptTree,hash_lock_script) {
    const hash_lock_redeem = {
        output: hash_lock_script,
        redeemVersion: 192
    };
    const hash_lock_p2tr = bitcoin.payments.p2tr({
        internalPubkey: toXOnly(keyPair.publicKey),
        scriptTree,
        redeem: hash_lock_redeem,
        network
    });
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
      if((inputCount*58 + 2*43 + 11)*feeRate + totalAmountAvailable < satoshiToSend){
        const hexRespone = await axios.get(`https://mempool.space/testnet/api/tx/${utxo.txid}/hex`);
        transHex = hexRespone.data;
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: hash_lock_p2tr.output ,
            value: utxo.value,
          },
          tapLeafScript: [{
            leafVersion: hash_lock_redeem.redeemVersion,
            script: hash_lock_redeem.output,
            controlBlock: hash_lock_p2tr.witness[hash_lock_p2tr.witness.length - 1]
        }]
        });
        
        psbt1.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: hash_lock_p2tr.output,
            value: utxo.value,
          },
          tapLeafScript: [{
            leafVersion: hash_lock_redeem.redeemVersion,
            script: hash_lock_redeem.output,
            controlBlock: hash_lock_p2tr.witness[hash_lock_p2tr.witness.length - 1]
        }]
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
    const customFinalizer = (_inputIndex, input) => {
        const scriptSolution = [
            input.tapScriptSig[0].signature,
            secret_bytes
        ];
        const witness = scriptSolution
            .concat(input.tapLeafScript[0].script)
            .concat(input.tapLeafScript[0].controlBlock);
    
        return {
            finalScriptWitness: witnessStackToScriptWitness(witness)
        }
    }
    await psbt.signAllInputsAsync(hash_lock_keypair);
    psbt.finalizeAllInputs(customFinalizer);

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
    await psbt1.signAllInputsAsync(hash_lock_keypair);
    psbt1.finalizeAllInputs(customFinalizer);
    return psbt1;
}



