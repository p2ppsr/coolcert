const crypto = require('crypto')

const createNonce = (serverPrivateKey) => {
  const firstHalf = crypto.randomBytes(16)

  const hmac = crypto.createHmac('sha256', serverPrivateKey)
  const buffer = hmac.update(firstHalf).digest()
  const secondHalf = buffer.slice(0, 16)

  return Buffer.concat([firstHalf, secondHalf]).toString('base64')
}

module.exports = createNonce
