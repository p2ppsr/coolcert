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
      // TODO
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
