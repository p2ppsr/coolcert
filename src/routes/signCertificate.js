const verifyNonce = require('../utils/verifyNonce')
module.exports = {
  type: 'post',
  path: '/signCertificate',
  summary: 'Use this route to fufill a certificate signing request.',
  parameters: { // Should these be in the request header?
    messageType: '',
    type: '',
    clientNonce: '',
    serverNonce: '',
    validationKey: '',
    serialNumber: ''
  },
  exampleResponse: {
  },
  func: async (req, res) => {
    try {
      if (req.body.messageType !== 'certificateSigningRequestForm') {
        res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_REQUEST',
          description: 'Invalid message type!'
        })
      }
      if (req.body.type !== process.env.CERTIFICATE_TYPE_ID) {
        res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_REQUEST',
          description: 'Invalid certificate type ID!'
        })
      }
      // TODO: The server checks that the hashes match

      // Validate serverNonce
      if (!verifyNonce(req.body.serverNonce, process.env.SERVER_PRIVATE_KEY)) {
        res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_NONCE',
          description: 'Server nonce provided was not created by this server!'
        })
      }
      // TODO: Sign the cert
      // 1. Derive public key used for signing
      // 2. Verify signature
      // 3. Check encrypted fields and decrypt them
      // 4. Create a spendable revocation outpoint
      // 5. Derive the certificate signing public key
      // 6. Signs the cert
      // 7. Returns signed cert to the requester
      return res.status(200).json({
        status: 'Certificate Signed!'
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
