const crypto = require('crypto')

const verifyNonce = (nonce, serverPrivateKey) => {
  const buffer = Buffer.from(nonce, 'base64')
  const firstHalf = buffer.slice(0, 16)
  const secondHalf = buffer.slice(16)

  const hmac = crypto.createHmac('sha256', serverPrivateKey)
  const actualBuffer = hmac.update(firstHalf).digest()
  const actualSecondHalf = actualBuffer.slice(0, 16)

  return Buffer.compare(secondHalf, actualSecondHalf) === 0
}

module.exports = verifyNonce
