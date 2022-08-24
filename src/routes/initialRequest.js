const { createNonce } = require('cryptononce')
const crypto = require('crypto')

module.exports = {
  type: 'post',
  path: '/initialRequest',
  summary: 'Generate an agreed upon validationKey and serialNumber',
  parameters: {
    clientNonce: ''
  },
  exampleResponse: {
    status: 'success',
    type: '4h2EuSOrHF2B0FgURmDZ4WsaYjnoY4mtGo2Q5IDf5wM=',
    serialNonce: 'kCD592Gbq+QqrmQzn9im6XvkK3oFkNF/rcgarLefkdM=',
    validationNonce: 'uEClilzHmF8n1d4AMxpACBg/8SMJEiJeJMycWAMoWg8=',
    serialNumber: '24lRlUndeq6ShMA8p2OQjBtR6UEWVVBySLEQPuPK44k=',
    validationKey: 'QIqLSq5Dw+DuFb5X5b1qstV5VXhFEq+UzFSSArk92Ps='
  },
  func: async (req, res) => {
    try {
      const clientNonce = req.body.clientNonce
      // Create nonces to use to generate the serialNumber and validation key
      const serverSerialNumberNonce = createNonce(process.env.SERVER_PRIVATE_KEY)
      const serverValidationKeyNonce = createNonce(process.env.SERVER_PRIVATE_KEY)
      // Calculate the serialNumber and validationKey to use
      const serialNumber = crypto.createHash('sha256').update(clientNonce + serverSerialNumberNonce).digest('base64')
      const validationKey = crypto.createHash('sha256').update(clientNonce + serverValidationKeyNonce).digest('base64')

      return res.status(200).json({
        status: 'success',
        type: process.env.CERTIFICATE_TYPE_ID,
        serialNonce: serverSerialNumberNonce,
        validationNonce: serverValidationKeyNonce,
        serialNumber,
        validationKey
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}
