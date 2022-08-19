const createNonce = require('../utils/createNonce')
// const verifyNonce = require('../utils/verifyNonce')
const crypto = require('crypto')

// const TEST_CLIENT_KEY = '24c0d7f3a03d3da2f0dc563eae119d8079fdc21c76b639e6c36f8c59e016b6fb'
module.exports = {
  type: 'post',
  path: '/initialRequest',
  summary: 'Generate an agreed upon validationKey and serialNumber',
  parameters: {
    clientNonce: ''
  },
  exampleResponse: {
  },
  func: async (req, res) => {
    try {
      const clientNonce = req.body.clientNonce
      // Create nonces to use to generate the serialNumber and validation key
      // Should these be done in seperate requests?
      const serverSerialNumberNonce = createNonce(process.env.SERVER_PRIVATE_KEY)
      const serverValidationKeyNonce = createNonce(process.env.SERVER_PRIVATE_KEY)
      // Calculate the serialNumber and validationKey to use
      const serialNumber = crypto.createHmac('sha256', clientNonce).update(serverSerialNumberNonce).digest('base64')
      const validationKey = crypto.createHmac('sha256', clientNonce).update(serverValidationKeyNonce).digest('base64')

      return res.status(200).json({
        status: 'success',
        type: process.env.CERTIFICATE_TYPE_ID,
        serialNumber,
        validationKey,
        nonce: '?'
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
