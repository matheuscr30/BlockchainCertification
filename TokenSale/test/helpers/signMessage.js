async function sign(signer, hash) {
    const sig = await web3.eth.sign(hash, signer);
    let r = sig.substr(0, 66);
    let s = "0x" + sig.substr(66, 64);
    let v = parseInt(sig.substr(130, 2), 16) + 27
    return {r, s, v, sig}
}

module.exports = {
  sign
};
