const bitcoin = require('bitcoinjs-lib');
const bip39 = require('bip39');
const ecc = require('tiny-secp256k1');
const { BIP32Factory } = require('bip32');
const ECPairFactory = require('ecpair');

bitcoin.initEccLib(ecc);
// Khởi tạo BIP32
const bip32 = BIP32Factory(ecc);

function createWallet(mnemonic, network = bitcoin.networks.testnet){
    // Nếu không có mnemonic, tạo mới
  if (!mnemonic) {
    mnemonic = bip39.generateMnemonic();
  }

  // Chuyển đổi mnemonic thành seed
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  
  // Tạo master key từ seed
  const root = bip32.fromSeed(seed, network);

  function deriveNewAddress(addressIndex) {
    const path = `m/86'/1'/0'/0/${addressIndex}`;
    const child = root.derivePath(path);

    // Hàm chuyển đổi public key thành x-only
    function toXOnly(pubkey) {
      return pubkey.slice(1, 33);
    }
    
    // Tạo keypair từ child key
    const ECPair = ECPairFactory.ECPairFactory(ecc);
    const keyPair = ECPair.fromPrivateKey(Buffer.from(child.privateKey), { network });
    /*
    //make another random keypair for our hash-lock script
    const hash_lock_keypair = ECPair.makeRandom({ network });
    //construct hash-lock script
    const secret_bytes = Buffer.from('SECRET');
    const hash = crypto.hash160(secret_bytes);
    // Construct script to pay to hash_lock_keypair if the correct preimage/secret is provided
    const hash_script_asm = `OP_HASH160 ${hash.toString('hex')} OP_EQUALVERIFY ${toXOnly(hash_lock_keypair.publicKey).toString('hex')} OP_CHECKSIG`;
    const hash_lock_script = script.fromASM(hash_script_asm);

    const p2pk_script_asm = `${toXOnly(keypair.publicKey).toString('hex')} OP_CHECKSIG`;
    const p2pk_script = script.fromASM(p2pk_script_asm);

    const scriptTree = [
      {
          output: hash_lock_script
      },
      {
          output: p2pk_script
      }
    ];*/
/*
    // Hàm tweak signer
    function tweakSigner(keypair, { network }) {
      const privateKey = keypair.privateKey; // Lấy private key
      const publicKey = toXOnly(keypair.publicKey); // Lấy x-only public key
      const tweak = bitcoin.crypto.taggedHash('TapTweak', publicKey); // Tạo tweak
      const tweakedPrivKey =Buffer.from(ecc.privateAdd(privateKey, tweak)); // Tweak private key
      return ECPair.fromPrivateKey(tweakedPrivKey, { network }); // Tạo tweaked signer
    }

    const tweakedSigner = tweakSigner(keyPair, {network});
    */
    // Tạo địa chỉ P2PKH (legacy address)
    const { address: P2PKH } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network });
    const { address: P2WPKH} = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network });    
    const { address: P2SH_P2WPKH} = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network}), 
      network
    });
    const {address: P2TR} = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(keyPair.publicKey),
      network,
    });
    
    return {
      addressIndex,
      P2PKH,
      P2TR,
      P2WPKH,
      P2SH_P2WPKH,
      privateKey: keyPair.privateKey.toString('hex'),
      publicKey: keyPair.publicKey.toString('hex'),
      path
    };
  }

  return {
    mnemonic,
    deriveNewAddress
  };
}
module.exports = createWallet;
